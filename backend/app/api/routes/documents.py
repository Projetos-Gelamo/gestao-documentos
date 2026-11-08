from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.core.supabase import get_supabase
from app.models.schemas import Documento, DocumentoUpdate

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
    res = query.order("detectado_em", desc=True).execute()
    return res.data or []


@router.get("/{documento_id}", response_model=Documento)
async def get_documento(documento_id: UUID):
    supabase = get_supabase()
    res = (
        supabase.schema("gestao_docs")
        .from_("documento")
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
        supabase.schema("gestao_docs")
        .from_("documento")
        .update(payload)
        .eq("id", str(documento_id))
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    return res.data[0]
