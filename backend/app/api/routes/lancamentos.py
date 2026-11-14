from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

from app.core.supabase import get_supabase
from app.models.schemas import (
    LancamentoContabil,
    LancamentoContabilCreate,
    RegraLancamento,
    RegraLancamentoCreate,
)

router = APIRouter(tags=["lancamentos"])


# ---------------------------------------------------------------------------
# Regras de lançamento
# ---------------------------------------------------------------------------

@router.get("/empresas/{empresa_id}/regras-lancamento", response_model=list[RegraLancamento])
def listar_regras(empresa_id: str):
    supabase = get_supabase()
    res = (
        supabase.schema("gestao_docs").from_("regra_lancamento")
        .select("*")
        .eq("empresa_id", empresa_id)
        .order("usos", desc=True)
        .execute()
    )
    return res.data or []


@router.post("/empresas/{empresa_id}/regras-lancamento", response_model=RegraLancamento, status_code=201)
def criar_regra(empresa_id: str, body: RegraLancamentoCreate):
    supabase = get_supabase()
    data = body.model_dump()
    data["empresa_id"] = empresa_id
    res = supabase.schema("gestao_docs").from_("regra_lancamento").insert(data).execute()
    return res.data[0]


@router.delete("/regras-lancamento/{regra_id}", status_code=204)
def remover_regra(regra_id: str):
    supabase = get_supabase()
    supabase.schema("gestao_docs").from_("regra_lancamento").delete().eq("id", regra_id).execute()


# ---------------------------------------------------------------------------
# Lançamentos contábeis
# ---------------------------------------------------------------------------

@router.get("/empresas/{empresa_id}/lancamentos", response_model=list[LancamentoContabil])
def listar_lancamentos(empresa_id: str, status: str | None = None):
    supabase = get_supabase()
    q = (
        supabase.schema("gestao_docs").from_("lancamento_contabil")
        .select("*")
        .eq("empresa_id", empresa_id)
        .order("data_lancamento", desc=True)
    )
    if status:
        q = q.eq("status", status)
    return q.execute().data or []


@router.post("/empresas/{empresa_id}/lancamentos", response_model=LancamentoContabil, status_code=201)
def criar_lancamento(empresa_id: str, body: LancamentoContabilCreate):
    supabase = get_supabase()
    data = body.model_dump()
    data["empresa_id"] = empresa_id
    if data.get("documento_id"):
        data["documento_id"] = str(data["documento_id"])
    res = supabase.schema("gestao_docs").from_("lancamento_contabil").insert(data).execute()
    return res.data[0]


@router.patch("/lancamentos/{lancamento_id}/confirmar", response_model=LancamentoContabil)
def confirmar_lancamento(lancamento_id: str):
    """Confirma um lançamento pendente, aprende a regra se não existir."""
    supabase = get_supabase()
    from datetime import datetime, timezone

    res = (
        supabase.schema("gestao_docs").from_("lancamento_contabil")
        .update({"status": "confirmado", "confirmado_em": datetime.now(timezone.utc).isoformat()})
        .eq("id", lancamento_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    lancamento = res.data[0]

    # Aprender regra se o lançamento veio de IA e não tem regra ainda
    if lancamento.get("origem") == "ia" and not lancamento.get("regra_id") and lancamento.get("historico"):
        padrao = lancamento["historico"]
        empresa_id = lancamento["empresa_id"]
        # Verifica se já existe regra igual
        existe = (
            supabase.schema("gestao_docs").from_("regra_lancamento")
            .select("id, usos")
            .eq("empresa_id", empresa_id)
            .eq("padrao", padrao)
            .execute()
        ).data
        if existe:
            usos_atual = existe[0]["usos"]
            supabase.schema("gestao_docs").from_("regra_lancamento").update({"usos": usos_atual + 1}).eq("id", existe[0]["id"]).execute()
        else:
            nova_regra = {
                "empresa_id": empresa_id,
                "padrao": padrao,
                "conta_debito": lancamento["conta_debito"],
                "conta_credito": lancamento["conta_credito"],
                "historico": lancamento.get("historico"),
                "cod_historico": lancamento.get("cod_historico"),
                "confianca": 1.0,
                "usos": 1,
            }
            regra_res = supabase.schema("gestao_docs").from_("regra_lancamento").insert(nova_regra).execute()
            if regra_res.data:
                supabase.schema("gestao_docs").from_("lancamento_contabil").update({"regra_id": regra_res.data[0]["id"]}).eq("id", lancamento_id).execute()

    return lancamento


@router.get("/empresas/{empresa_id}/lancamentos/exportar-dominio", response_class=PlainTextResponse)
def exportar_dominio(empresa_id: str, mes: str | None = None):
    """
    Gera arquivo TXT no formato Domínio para importação de lançamentos.
    Formato: data;conta_debito;conta_credito;valor;cod_historico;complemento;lote;cod_empresa
    Dataset: Lançamentos Contábeis (Partida Simples/Múltiplas) (3.1)
    Caminho: Utilitários → Importação → Importador → Importar
    """
    supabase = get_supabase()

    empresa_res = supabase.schema("gestao_docs").from_("empresa").select("codigo").eq("id", empresa_id).execute()
    cod_empresa = empresa_res.data[0]["codigo"] if empresa_res.data else ""

    q = (
        supabase.schema("gestao_docs").from_("lancamento_contabil")
        .select("*")
        .eq("empresa_id", empresa_id)
        .eq("status", "confirmado")
        .is_("exportado_em", "null")
        .order("data_lancamento")
    )
    if mes:
        q = q.gte("data_lancamento", f"{mes}-01").lte("data_lancamento", f"{mes}-31")

    lancamentos = q.execute().data or []
    if not lancamentos:
        return ""

    linhas = []
    for l in lancamentos:
        data_fmt = l["data_lancamento"].replace("-", "")  # YYYYMMDD → DDMMAAAA
        if len(data_fmt) == 8:
            data_fmt = data_fmt[6:8] + data_fmt[4:6] + data_fmt[0:4]
        valor_fmt = f"{l['valor']:.2f}".replace(".", ",")
        complemento = (l.get("complemento_historico") or "").replace(";", " ")
        lote = l.get("lote") or "1"
        cod_hist = l.get("cod_historico") or ""
        linha = f"{data_fmt};{l['conta_debito']};{l['conta_credito']};{valor_fmt};{cod_hist};{complemento};{lote};{cod_empresa}"
        linhas.append(linha)

    # Marcar como exportados
    ids = [l["id"] for l in lancamentos]
    from datetime import datetime, timezone
    agora = datetime.now(timezone.utc).isoformat()
    for id_ in ids:
        supabase.schema("gestao_docs").from_("lancamento_contabil").update({"exportado_em": agora}).eq("id", id_).execute()

    return "\n".join(linhas)
