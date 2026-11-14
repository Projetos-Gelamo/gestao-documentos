import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.core.supabase import get_supabase
from app.models.schemas import ChecklistItem, ChecklistMensal, TipoDocumentoEsperado, TipoDocumentoEsperadoCreate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tipos_esperados"])


@router.get("/empresas/{empresa_id}/tipos-esperados", response_model=list[TipoDocumentoEsperado])
def listar_tipos_esperados(empresa_id: str):
    supabase = get_supabase()
    res = supabase.schema("gestao_docs").from_("tipo_documento_esperado").select("*").eq("empresa_id", empresa_id).execute()
    return res.data


@router.post("/empresas/{empresa_id}/tipos-esperados", response_model=TipoDocumentoEsperado, status_code=201)
def criar_tipo_esperado(empresa_id: str, body: TipoDocumentoEsperadoCreate):
    if str(body.empresa_id) != empresa_id:
        raise HTTPException(status_code=400, detail="empresa_id inconsistente")
    supabase = get_supabase()
    data = body.model_dump()
    data["empresa_id"] = str(data["empresa_id"])
    data["periodicidade"] = data["periodicidade"].value if hasattr(data["periodicidade"], "value") else data["periodicidade"]
    res = supabase.schema("gestao_docs").from_("tipo_documento_esperado").insert(data).execute()
    return res.data[0]


@router.delete("/tipos-esperados/{tipo_id}", status_code=204)
def remover_tipo_esperado(tipo_id: str):
    supabase = get_supabase()
    supabase.schema("gestao_docs").from_("tipo_documento_esperado").delete().eq("id", tipo_id).execute()


@router.get("/empresas/{empresa_id}/checklist", response_model=ChecklistMensal)
def get_checklist(empresa_id: str, mes: str):
    """Retorna checklist de documentos esperados vs recebidos para um mês (YYYY-MM)."""
    supabase = get_supabase()

    tipos_res = (
        supabase.schema("gestao_docs")
        .from_("tipo_documento_esperado")
        .select("*")
        .eq("empresa_id", empresa_id)
        .execute()
    )
    tipos = tipos_res.data

    docs_res = (
        supabase.schema("gestao_docs")
        .from_("documento")
        .select("id,tipo,banco,conta,nome_arquivo,status")
        .eq("empresa_id", empresa_id)
        .eq("mes_referencia", mes)
        .execute()
    )
    docs = docs_res.data

    itens: list[ChecklistItem] = []
    for tipo in tipos:
        tipo_val = tipo.get("tipo", "")
        banco_esp = (tipo.get("banco") or "").lower().strip()
        conta_esp = (tipo.get("conta") or "").lower().strip()

        matching = None
        for doc in docs:
            if doc.get("tipo") != tipo_val:
                continue
            # Para extrato_bancario, verifica banco/conta se definidos
            if tipo_val == "extrato_bancario" and banco_esp:
                banco_doc = (doc.get("banco") or "").lower()
                if banco_esp not in banco_doc and banco_doc not in banco_esp:
                    continue
            if tipo_val == "extrato_bancario" and conta_esp:
                conta_doc = (doc.get("conta") or "").lower().replace("-", "").replace(".", "")
                conta_esp_norm = conta_esp.replace("-", "").replace(".", "")
                if conta_esp_norm not in conta_doc and conta_doc not in conta_esp_norm:
                    continue
            matching = doc
            break

        label = tipo.get("descricao") or _tipo_label(tipo_val, tipo.get("banco"), tipo.get("conta"))
        itens.append(ChecklistItem(
            tipo_id=tipo["id"],
            tipo=tipo_val,
            descricao=label,
            banco=tipo.get("banco"),
            conta=tipo.get("conta"),
            recebido=matching is not None,
            documento_id=matching["id"] if matching else None,
            documento_nome=matching["nome_arquivo"] if matching else None,
        ))

    recebidos = sum(1 for i in itens if i.recebido)
    return ChecklistMensal(
        mes=mes,
        empresa_id=empresa_id,
        total=len(itens),
        recebidos=recebidos,
        pendentes=len(itens) - recebidos,
        itens=itens,
    )


@router.post("/empresas/{empresa_id}/configuracao-automatica")
def configuracao_automatica(empresa_id: str, dry_run: bool = True):
    """
    Analisa documentos classificados da empresa e sugere (ou cria) entradas em
    tipo_documento_esperado para combinações (tipo, banco, conta) ainda não cadastradas.
    dry_run=True (padrão) → apenas preview. dry_run=False → cria no banco.
    """
    supabase = get_supabase()

    docs_res = (
        supabase.schema("gestao_docs").from_("documento")
        .select("tipo,banco,conta")
        .eq("empresa_id", empresa_id)
        .eq("status", "classificado")
        .execute()
    )
    docs = docs_res.data or []

    existentes_res = (
        supabase.schema("gestao_docs").from_("tipo_documento_esperado")
        .select("tipo,banco,conta")
        .eq("empresa_id", empresa_id)
        .execute()
    )
    existentes_set = {
        (e.get("tipo") or "", (e.get("banco") or "").lower().strip(), (e.get("conta") or "").lower().strip())
        for e in (existentes_res.data or [])
    }

    seen: set[tuple] = set()
    novos: list[dict] = []
    for doc in docs:
        tipo = doc.get("tipo") or ""
        if not tipo:
            continue
        banco = (doc.get("banco") or "").strip()
        conta = (doc.get("conta") or "").strip()
        key = (tipo, banco.lower(), conta.lower())
        if key in seen or key in existentes_set:
            continue
        seen.add(key)
        novos.append({
            "empresa_id": empresa_id,
            "tipo": tipo,
            "banco": banco or None,
            "conta": conta or None,
            "periodicidade": "mensal",
        })

    if dry_run or not novos:
        return {"dry_run": True, "preview": novos, "total": len(novos)}

    try:
        res = supabase.schema("gestao_docs").from_("tipo_documento_esperado").insert(novos).execute()
        return {"dry_run": False, "criados": len(res.data or []), "preview": res.data or []}
    except Exception as exc:
        logger.error("Erro ao inserir tipos esperados: %s", exc)
        raise HTTPException(status_code=500, detail=f"Erro ao salvar: {exc}")


@router.get("/empresas/{empresa_id}/visao-anual")
def get_visao_anual(empresa_id: str, ano: int | None = None):
    """Matriz anual: tipos_esperados × 12 meses → recebido/pendente."""
    if ano is None:
        ano = datetime.now().year

    supabase = get_supabase()

    tipos_res = (
        supabase.schema("gestao_docs")
        .from_("tipo_documento_esperado")
        .select("*")
        .eq("empresa_id", empresa_id)
        .execute()
    )
    tipos = tipos_res.data

    docs_res = (
        supabase.schema("gestao_docs")
        .from_("documento")
        .select("id,tipo,banco,conta,nome_arquivo,mes_referencia")
        .eq("empresa_id", empresa_id)
        .like("mes_referencia", f"{ano}-%")
        .execute()
    )
    docs = docs_res.data

    meses = [f"{ano}-{str(m).zfill(2)}" for m in range(1, 13)]

    tipos_data = []
    for tipo in tipos:
        tipo_val = tipo.get("tipo", "")
        banco_esp = (tipo.get("banco") or "").lower().strip()
        conta_esp = (tipo.get("conta") or "").lower().strip()

        meses_data = {}
        for mes in meses:
            docs_mes = [d for d in docs if d.get("mes_referencia") == mes]
            matching = None
            for doc in docs_mes:
                if doc.get("tipo") != tipo_val:
                    continue
                if tipo_val == "extrato_bancario" and banco_esp:
                    banco_doc = (doc.get("banco") or "").lower()
                    if banco_esp not in banco_doc and banco_doc not in banco_esp:
                        continue
                if tipo_val == "extrato_bancario" and conta_esp:
                    conta_doc = (doc.get("conta") or "").lower().replace("-", "").replace(".", "")
                    conta_esp_norm = conta_esp.replace("-", "").replace(".", "")
                    if conta_esp_norm not in conta_doc and conta_doc not in conta_esp_norm:
                        continue
                matching = doc
                break

            meses_data[mes] = {
                "recebido": matching is not None,
                "documento_id": matching["id"] if matching else None,
                "documento_nome": matching["nome_arquivo"] if matching else None,
            }

        label = tipo.get("descricao") or _tipo_label(tipo_val, tipo.get("banco"), tipo.get("conta"))
        tipos_data.append({
            "tipo_id": tipo["id"],
            "tipo": tipo_val,
            "descricao": label,
            "banco": tipo.get("banco"),
            "conta": tipo.get("conta"),
            "meses": meses_data,
        })

    return {"ano": ano, "empresa_id": empresa_id, "tipos": tipos_data}


def _tipo_label(tipo: str, banco: str | None, conta: str | None) -> str:
    base = {
        "extrato_bancario": "Extrato Bancário",
        "nota_fiscal": "Nota Fiscal",
        "guia_pagamento": "Guia de Pagamento",
        "contrato": "Contrato",
        "recibo": "Recibo",
        "balancete": "Balancete",
        "dre": "DRE",
        "folha_pagamento": "Folha de Pagamento",
        "comprovante_pagamento": "Comprovante de Pagamento",
        "contrato_emprestimo": "Contrato de Empréstimo",
        "planilha_financeira": "Planilha Financeira",
        "outros": "Outros",
    }.get(tipo, tipo)
    parts = [base]
    if banco:
        parts.append(banco)
    if conta:
        parts.append(f"CC {conta}")
    return " — ".join(parts)
