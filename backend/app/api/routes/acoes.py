import logging
from uuid import UUID

from fastapi import APIRouter

from app.core.supabase import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(tags=["acoes"])


@router.post("/acoes", status_code=201)
def registrar_acao(body: dict):
    supabase = get_supabase()
    data: dict = {}
    if body.get("empresa_id"):
        data["empresa_id"] = str(body["empresa_id"])
    if body.get("documento_id"):
        data["documento_id"] = str(body["documento_id"])
    data["tipo_acao"] = body.get("tipo_acao", "")
    if body.get("detalhes"):
        data["detalhes"] = body["detalhes"]
    try:
        res = supabase.schema("gestao_docs").from_("acao_usuario").insert(data).execute()
        return res.data[0] if res.data else {}
    except Exception as exc:
        logger.warning("Erro ao registrar ação: %s", exc)
        return {}


@router.get("/empresas/{empresa_id}/acoes")
def listar_acoes(empresa_id: UUID, limit: int = 50):
    supabase = get_supabase()
    try:
        res = (
            supabase.schema("gestao_docs").from_("acao_usuario")
            .select("*")
            .eq("empresa_id", str(empresa_id))
            .order("criado_em", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []
    except Exception:
        return []


@router.get("/empresas/{empresa_id}/revisao-pendente")
def revisao_pendente(empresa_id: UUID):
    """Documentos que precisam de ação: nao_reconhecido, empresa_errada, duplicata, aguardando_roteamento."""
    supabase = get_supabase()
    try:
        res = (
            supabase.schema("gestao_docs").from_("documento")
            .select("*")
            .eq("empresa_id", str(empresa_id))
            .in_("status", ["nao_reconhecido", "empresa_errada", "duplicata", "aguardando_roteamento"])
            .is_("excluido_em", None)
            .order("detectado_em", desc=True)
            .execute()
        )
        return res.data or []
    except Exception:
        return []
