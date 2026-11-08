from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.supabase import get_supabase
from app.models.schemas import DocumentoStatus, FilaRevisao

router = APIRouter(prefix="/revisao", tags=["revisao"])


class ResolvePayload(BaseModel):
    tipo: str
    mes_referencia: str | None = None
    observacao: str | None = None


@router.get("/", response_model=list[dict])
async def list_fila():
    supabase = get_supabase()
    res = (
        supabase.from_("fila_revisao")
        .select("*, documento:documento_id(nome_arquivo, tipo, status, empresa:empresa_id(nome))")
        .is_("resolvido_em", "null")
        .order("criado_em")
        .execute()
    )
    return res.data or []


@router.post("/{fila_id}/resolver", response_model=dict)
async def resolver_item(fila_id: UUID, payload: ResolvePayload):
    supabase = get_supabase()

    fila_res = (
        supabase.from_("fila_revisao")
        .select("documento_id")
        .eq("id", str(fila_id))
        .single()
        .execute()
    )
    if not fila_res.data:
        raise HTTPException(status_code=404, detail="Item da fila não encontrado")

    documento_id = fila_res.data["documento_id"]
    now = datetime.now(timezone.utc).isoformat()

    supabase.from_("documento").update(
        {
            "tipo": payload.tipo,
            "mes_referencia": payload.mes_referencia,
            "status": DocumentoStatus.revisado.value,
            "classificado_em": now,
        }
    ).eq("id", documento_id).execute()

    supabase.from_("fila_revisao").update(
        {"resolvido_em": now}
    ).eq("id", str(fila_id)).execute()

    return {"ok": True, "documento_id": documento_id}
