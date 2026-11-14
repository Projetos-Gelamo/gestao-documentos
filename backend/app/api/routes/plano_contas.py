from fastapi import APIRouter, HTTPException

from app.core.supabase import get_supabase
from app.models.schemas import PlanoContas, PlanoContasCreate

router = APIRouter(tags=["plano_contas"])


@router.get("/empresas/{empresa_id}/plano-contas", response_model=list[PlanoContas])
def listar_plano(empresa_id: str):
    supabase = get_supabase()
    res = (
        supabase.schema("gestao_docs").from_("plano_contas")
        .select("*")
        .eq("empresa_id", empresa_id)
        .order("codigo")
        .execute()
    )
    return res.data or []


@router.post("/empresas/{empresa_id}/plano-contas", response_model=PlanoContas, status_code=201)
def criar_conta(empresa_id: str, body: PlanoContasCreate):
    if str(body.empresa_id) != empresa_id:
        raise HTTPException(status_code=400, detail="empresa_id inconsistente")
    supabase = get_supabase()
    data = body.model_dump()
    data["empresa_id"] = str(data["empresa_id"])
    res = supabase.schema("gestao_docs").from_("plano_contas").insert(data).execute()
    return res.data[0]


@router.post("/empresas/{empresa_id}/plano-contas/importar", status_code=201)
def importar_plano(empresa_id: str, contas: list[PlanoContasCreate]):
    """Importa várias contas de uma vez (usado na importação de planilha)."""
    supabase = get_supabase()
    rows = []
    for c in contas:
        d = c.model_dump()
        d["empresa_id"] = empresa_id
        rows.append(d)
    if not rows:
        return {"importadas": 0}
    res = supabase.schema("gestao_docs").from_("plano_contas").upsert(
        rows, on_conflict="empresa_id,codigo"
    ).execute()
    return {"importadas": len(res.data or [])}


@router.delete("/plano-contas/{conta_id}", status_code=204)
def remover_conta(conta_id: str):
    supabase = get_supabase()
    supabase.schema("gestao_docs").from_("plano_contas").delete().eq("id", conta_id).execute()
