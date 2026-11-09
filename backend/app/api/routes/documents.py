import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query

from app.core.supabase import STORAGE_BUCKET, get_supabase
from app.models.schemas import Documento, DocumentoUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documentos", tags=["documentos"])


@router.get("/", response_model=list[Documento])
async def list_documentos(
    empresa_id: UUID | None = Query(None),
    mes_referencia: str | None = Query(None, description="Formato YYYY-MM"),
    status: str | None = Query(None),
):
    supabase = get_supabase()
    query = supabase.schema("gestao_docs").from_("documento").select("*")
    if empresa_id:
        query = query.eq("empresa_id", str(empresa_id))
    if mes_referencia:
        query = query.eq("mes_referencia", mes_referencia)
    if status:
        query = query.eq("status", status)
    else:
        # Oculta excluídos por padrão
        query = query.neq("status", "excluido")
    res = query.order("detectado_em", desc=True).execute()
    return res.data or []


@router.get("/{documento_id}", response_model=Documento)
async def get_documento(documento_id: UUID):
    supabase = get_supabase()
    res = (
        supabase.schema("gestao_docs").from_("documento")
        .select("*")
        .eq("id", str(documento_id))
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    return res.data


@router.patch("/{documento_id}", response_model=Documento)
async def update_documento(documento_id: UUID, update: DocumentoUpdate):
    supabase = get_supabase()
    payload = update.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    res = (
        supabase.schema("gestao_docs").from_("documento")
        .update(payload)
        .eq("id", str(documento_id))
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    return res.data[0]


@router.delete("/{documento_id}", status_code=200)
async def delete_documento(
    documento_id: UUID,
    excluido_por: str | None = Header(None, alias="X-Excluido-Por"),
    remover_arquivo: bool = Query(True, description="Remove o arquivo do Storage também"),
):
    """Soft-delete: marca excluido_em/excluido_por. Remove arquivo do Storage se solicitado."""
    supabase = get_supabase()

    # Busca o documento para obter o storage_path
    res = (
        supabase.schema("gestao_docs").from_("documento")
        .select("id,storage_path,nome_arquivo,excluido_em")
        .eq("id", str(documento_id))
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Documento não encontrado")

    doc = res.data
    if doc.get("excluido_em"):
        raise HTTPException(status_code=409, detail="Documento já foi excluído anteriormente")

    agora = datetime.now(timezone.utc).isoformat()

    # Soft-delete no banco
    supabase.schema("gestao_docs").from_("documento").update({
        "excluido_em": agora,
        "excluido_por": excluido_por or "sistema",
        "status": "excluido",
    }).eq("id", str(documento_id)).execute()

    # Remove da fila de revisão se estiver lá
    try:
        supabase.schema("gestao_docs").from_("fila_revisao").delete().eq(
            "documento_id", str(documento_id)
        ).execute()
    except Exception:
        pass

    # Remove arquivo do Storage
    storage_removed = False
    if remover_arquivo and doc.get("storage_path"):
        try:
            supabase.storage.from_(STORAGE_BUCKET).remove([doc["storage_path"]])
            storage_removed = True
        except Exception as exc:
            logger.warning("Não foi possível remover arquivo do Storage: %s", exc)

    return {
        "id": str(documento_id),
        "nome_arquivo": doc["nome_arquivo"],
        "excluido_em": agora,
        "excluido_por": excluido_por or "sistema",
        "arquivo_removido": storage_removed,
    }
