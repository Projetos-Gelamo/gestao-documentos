from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.core.supabase import get_supabase
from app.models.schemas import Empresa, EmpresaCreate

router = APIRouter(prefix="/empresas", tags=["empresas"])


@router.get("/", response_model=list[Empresa])
async def list_empresas():
    supabase = get_supabase()
    res = supabase.schema("gestao_docs").from_("empresa").select("*").order("nome").execute()
    return res.data or []


@router.get("/{empresa_id}", response_model=Empresa)
async def get_empresa(empresa_id: UUID):
    supabase = get_supabase()
    res = (
        supabase.schema("gestao_docs")
        .from_("empresa")
        .select("*")
        .eq("id", str(empresa_id))
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    return res.data


@router.post("/", response_model=Empresa, status_code=201)
async def create_empresa(empresa: EmpresaCreate):
    supabase = get_supabase()
    res = supabase.schema("gestao_docs").from_("empresa").insert(empresa.model_dump()).execute()
    return res.data[0]
