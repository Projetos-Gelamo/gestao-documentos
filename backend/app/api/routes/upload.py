import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.supabase import STORAGE_BUCKET, get_supabase
from app.models.schemas import DocumentoStatus, UploadResult
from app.services.classifier import classify_document
from app.services.extractor import extract_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["upload"])

_MESES = {
    "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril",
    "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
    "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro",
}


def _nome_sugerido(tipo: str | None, mes: str | None, banco: str | None, conta: str | None) -> str | None:
    tipo_label = {
        "extrato_bancario": "Extrato",
        "nota_fiscal": "NF-e",
        "guia_pagamento": "Guia de Pagamento",
        "contrato": "Contrato",
        "recibo": "Recibo",
        "balancete": "Balancete",
        "dre": "DRE",
        "folha_pagamento": "Folha de Pagamento",
        "comprovante_pagamento": "Comprovante de Pagamento",
        "contrato_emprestimo": "Contrato de Empréstimo",
        "planilha_financeira": "Planilha Financeira",
        "outros": "Documento",
    }.get(tipo or "", None)

    if not tipo_label:
        return None

    parts = [tipo_label]
    if banco:
        parts.append(banco)
    if conta:
        parts.append(f"CC {conta}")
    if mes and len(mes) == 7:
        ano, m = mes.split("-")
        parts.append(f"{_MESES.get(m, m)}/{ano}")

    return " — ".join(parts)


@router.post("/", response_model=UploadResult)
async def upload_documento(
    empresa_id: str = Form(...),
    file: UploadFile = File(...),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio")

    filename = file.filename or "arquivo"
    content_type = file.content_type or "application/octet-stream"

    # Caminho no Storage: empresa_id/YYYY-MM/uuid_filename
    mes_upload = datetime.now().strftime("%Y-%m")
    file_id = str(uuid.uuid4())[:8]
    storage_path = f"{empresa_id}/{mes_upload}/{file_id}_{filename}"

    # Salva no Storage
    supabase = get_supabase()
    try:
        supabase.storage.from_(STORAGE_BUCKET).upload(
            path=storage_path,
            file=content,
            file_options={"content-type": content_type, "upsert": "true"},
        )
    except Exception as exc:
        logger.error("Erro ao salvar no Storage: %s", exc)
        raise HTTPException(status_code=500, detail=f"Erro ao salvar arquivo: {exc}")

    # Extrai texto e classifica
    text = extract_text(content, filename)
    result, status = await classify_document(text, filename)

    # Persiste documento no banco
    doc_data = {
        "empresa_id": empresa_id,
        "storage_path": storage_path,
        "nome_arquivo": filename,
        "tipo": result.doc_type,
        "mes_referencia": result.mes_referencia,
        "status": status.value,
        "cnpj_extraido": result.cnpj,
        "banco": result.banco,
        "conta": result.conta,
        "confianca": result.confidence,
        "ficticio": False,
    }
    try:
        doc_res = supabase.schema("gestao_docs").from_("documento").insert(doc_data).execute()
        doc_id = doc_res.data[0]["id"]
    except Exception as exc:
        logger.error("Erro ao inserir documento: %s", exc)
        raise HTTPException(status_code=500, detail=f"Erro ao salvar metadados: {exc}")

    # Documento não reconhecido → fila de revisão
    na_fila = status == DocumentoStatus.nao_reconhecido
    if na_fila:
        try:
            supabase.schema("gestao_docs").from_("fila_revisao").insert(
                {"documento_id": doc_id}
            ).execute()
        except Exception as exc:
            logger.warning("Erro ao inserir na fila de revisão: %s", exc)

    return UploadResult(
        id=doc_id,
        nome_arquivo=filename,
        storage_path=storage_path,
        tipo=result.doc_type,
        mes_referencia=result.mes_referencia,
        banco=result.banco,
        conta=result.conta,
        cnpj=result.cnpj,
        confidence=result.confidence,
        status=status,
        na_fila_revisao=na_fila,
        nome_sugerido=_nome_sugerido(result.doc_type, result.mes_referencia, result.banco, result.conta),
    )
