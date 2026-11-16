import logging
import re
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


def _build_conta_lookups(supabase, excluir_empresa_id: str | None = None):
    """Retorna (conta_lookup, conta_suffix, emp_map) para detectar empresa por banco+conta."""
    conta_lookup: dict[str, str] = {}
    conta_suffix: dict[str, str] = {}
    emp_map: dict[str, str] = {}
    try:
        emp_res = supabase.schema("gestao_docs").from_("empresa").select("id,nome").execute()
        emp_map = {e["id"]: e.get("nome", "") for e in (emp_res.data or [])}
        q = supabase.schema("gestao_docs").from_("conta_bancaria").select("banco,conta,empresa_id")
        if excluir_empresa_id:
            q = q.neq("empresa_id", excluir_empresa_id)
        cb_res = q.execute()
        for cb in (cb_res.data or []):
            b = (cb.get("banco") or "").lower().strip()
            c = re.sub(r"[^\d]", "", cb.get("conta") or "")
            eid = cb.get("empresa_id", "")
            if c and eid:
                conta_lookup[f"{b}|{c}"] = eid
                conta_lookup.setdefault(f"|{c}", eid)
                if len(c) >= 5:
                    conta_suffix.setdefault(c, eid)
    except Exception as exc:
        logger.warning("_build_conta_lookups: %s", exc)
    return conta_lookup, conta_suffix, emp_map


def _sugerir_empresa_por_conta(banco: str, conta_raw: str, conta_lookup, conta_suffix) -> str | None:
    b = (banco or "").lower().strip()
    c_full = re.sub(r"[^\d]", "", conta_raw or "")
    c_sem_ag = c_full
    if "/" in (conta_raw or ""):
        c_sem_ag = re.sub(r"[^\d]", "", conta_raw.split("/", 1)[1])
    for c in dict.fromkeys([c_full, c_sem_ag]):
        if b:
            match = conta_lookup.get(f"{b}|{c}")
            if match:
                return match
        match = conta_lookup.get(f"|{c}")
        if match:
            return match
    if len(c_full) >= 5:
        for suf_c, suf_eid in conta_suffix.items():
            if len(suf_c) >= 5 and (suf_c in c_full or c_full in suf_c):
                return suf_eid
    return None


@router.get("/fila-global")
def fila_global():
    """Todos os documentos aguardando roteamento com sugestão de empresa por CNPJ e banco+conta."""
    supabase = get_supabase()
    try:
        res = (
            supabase.schema("gestao_docs").from_("documento")
            .select("*, empresa:empresa_id(id,nome,codigo)")
            .eq("status", "aguardando_roteamento")
            .is_("excluido_em", None)
            .order("detectado_em", desc=True)
            .execute()
        )
        docs = res.data or []
        conta_lookup, conta_suffix, emp_map = _build_conta_lookups(supabase)
        for doc in docs:
            sug_id = _sugerir_empresa_por_conta(
                doc.get("banco") or "", doc.get("conta") or "",
                conta_lookup, conta_suffix,
            )
            doc["empresa_sugerida_por_conta"] = (
                {"id": sug_id, "nome": emp_map.get(sug_id)} if sug_id else None
            )
        return docs
    except Exception as exc:
        logger.warning("fila_global: %s", exc)
        return []


@router.post("/fila-global/auto-rotear")
def auto_rotear_fila():
    """Auto-roteia documentos da fila usando CNPJ e banco+conta cadastrados."""
    supabase = get_supabase()
    roteados: list[dict] = []
    nao_roteados: list[str] = []
    try:
        docs_res = (
            supabase.schema("gestao_docs").from_("documento")
            .select("id,banco,conta,cnpj_extraido")
            .eq("status", "aguardando_roteamento")
            .is_("excluido_em", None)
            .execute()
        )
        docs = docs_res.data or []
        emp_res = supabase.schema("gestao_docs").from_("empresa").select("id,cnpj,nome").execute()
        empresas = emp_res.data or []
        conta_lookup, conta_suffix, emp_map = _build_conta_lookups(supabase)

        def norm_cnpj(c: str) -> str:
            return re.sub(r"[^\d]", "", c or "")

        for doc in docs:
            doc_id = doc["id"]
            sug_id: str | None = None

            # 1. CNPJ
            if doc.get("cnpj_extraido"):
                cnpj_doc = norm_cnpj(doc["cnpj_extraido"])
                for e in empresas:
                    if norm_cnpj(e.get("cnpj") or "") == cnpj_doc:
                        sug_id = e["id"]
                        break

            # 2. Banco+conta
            if not sug_id and doc.get("conta"):
                sug_id = _sugerir_empresa_por_conta(
                    doc.get("banco") or "", doc.get("conta") or "",
                    conta_lookup, conta_suffix,
                )

            if sug_id:
                try:
                    supabase.schema("gestao_docs").from_("documento").update({
                        "empresa_id": sug_id,
                        "status": "classificado",
                    }).eq("id", doc_id).execute()
                    try:
                        supabase.schema("gestao_docs").from_("fila_revisao").delete().eq("documento_id", doc_id).execute()
                    except Exception:
                        pass
                    roteados.append({"id": doc_id, "empresa_id": sug_id, "nome": emp_map.get(sug_id)})
                except Exception as exc:
                    logger.warning("auto_rotear: erro ao mover %s: %s", doc_id, exc)
                    nao_roteados.append(doc_id)
            else:
                nao_roteados.append(doc_id)
    except Exception as exc:
        logger.error("auto_rotear_fila: %s", exc)
        return {"roteados": [], "nao_roteados": [], "erro": str(exc)}
    return {"roteados": roteados, "nao_roteados": nao_roteados}


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
