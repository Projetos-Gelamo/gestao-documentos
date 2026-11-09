import logging
from datetime import datetime, timezone

from app.core.drive import download_file_bytes, list_new_files
from app.core.supabase import get_supabase
from app.models.schemas import DocumentoCreate, DocumentoStatus, DocumentoUpdate, FilaRevisaoCreate
from app.services.classifier import classify_document
from app.services.extractor import extract_text

logger = logging.getLogger(__name__)


async def run_monitor() -> None:
    """Poll all monitored Drive folders for new files and process them."""
    supabase = get_supabase()

    # Busca empresas com folder_id configurado no modo ativo
    config_res = supabase.schema("gestao_docs").from_("configuracao_sistema").select("modo_ficticio").limit(1).execute()
    modo_ficticio = (config_res.data or [{}])[0].get("modo_ficticio", False)

    empresas_res = (
        supabase.schema("gestao_docs").from_("empresa")
        .select("id, pasta_id_drive, ultima_verificacao_em")
        .eq("ficticio", modo_ficticio)
        .not_.is_("pasta_id_drive", "null")
        .execute()
    )

    for empresa in empresas_res.data or []:
        await _process_empresa_folder(supabase, empresa, modo_ficticio)


async def _process_empresa_folder(supabase, empresa: dict, modo_ficticio: bool) -> None:
    folder_id = empresa["pasta_id_drive"]
    empresa_id = empresa["id"]
    last_checked = empresa.get("ultima_verificacao_em")
    since = datetime.fromisoformat(last_checked) if last_checked else None

    try:
        new_files = list_new_files(folder_id, since)
    except Exception as exc:
        logger.error("Erro ao listar arquivos da empresa %s: %s", empresa_id, exc)
        return

    for file_meta in new_files:
        # Deduplicação: pula se já existe no banco
        exists = (
            supabase.schema("gestao_docs").from_("documento")
            .select("id")
            .eq("arquivo_id_drive", file_meta.id)
            .execute()
        )
        if exists.data:
            continue

        await _process_file(supabase, file_meta, empresa_id, modo_ficticio)

    # Atualiza timestamp da última verificação
    supabase.schema("gestao_docs").from_("empresa").update(
        {"ultima_verificacao_em": datetime.now(timezone.utc).isoformat()}
    ).eq("id", empresa_id).execute()


async def _process_file(supabase, file_meta, empresa_id: str, modo_ficticio: bool) -> None:
    logger.info("Processando arquivo: %s (%s)", file_meta.name, file_meta.id)

    try:
        file_bytes = download_file_bytes(file_meta.id)
        text = extract_text(file_bytes, file_meta.name)
        result, status = await classify_document(text, file_meta.name)
    except Exception as exc:
        logger.error("Erro ao processar arquivo %s: %s", file_meta.name, exc)
        status = DocumentoStatus.nao_reconhecido
        result = None

    doc_data = {
        "empresa_id": empresa_id,
        "arquivo_id_drive": file_meta.id,
        "nome_arquivo": file_meta.name,
        "tipo": result.doc_type if result else None,
        "mes_referencia": result.mes_referencia if result else None,
        "status": status.value,
        "cnpj_extraido": result.cnpj if result else None,
        "confianca": result.confidence if result else None,
        "ficticio": modo_ficticio,
        "detectado_em": file_meta.created_time.isoformat(),
        "classificado_em": datetime.now(timezone.utc).isoformat() if result else None,
    }

    doc_res = supabase.schema("gestao_docs").from_("documento").insert(doc_data).execute()
    doc_id = (doc_res.data or [{}])[0].get("id")

    if status == DocumentoStatus.nao_reconhecido and doc_id:
        supabase.schema("gestao_docs").from_("fila_revisao").insert(
            {"documento_id": doc_id}
        ).execute()
        logger.info("Documento %s adicionado à fila de revisão", doc_id)
