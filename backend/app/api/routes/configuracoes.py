import io
import logging
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.supabase import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(tags=["configuracoes"])

TIPOS_DOC = [
    "extrato_bancario", "nota_fiscal", "guia_pagamento", "contrato",
    "recibo", "balancete", "dre", "folha_pagamento", "comprovante_pagamento",
    "contrato_emprestimo", "planilha_financeira", "outros",
]

# ── Modelos ────────────────────────────────────────────────────────────────

def _norm_cnpj(cnpj: str | None) -> str:
    if not cnpj:
        return ""
    return "".join(c for c in str(cnpj) if c.isdigit())


class ContaBancariaIn(BaseModel):
    banco: str
    agencia: str | None = None
    conta: str
    tipo: str = "corrente"
    cnpj: str | None = None
    ativo: bool = True

class ContaBancariaUpdate(BaseModel):
    banco: str | None = None
    agencia: str | None = None
    conta: str | None = None
    tipo: str | None = None
    cnpj: str | None = None
    ativo: bool | None = None

class DocumentoEsperadoIn(BaseModel):
    conta_bancaria_id: str | None = None
    tipo: str
    descricao: str
    frequencia: str = "mensal"
    ativo: bool = True

class ContaPreviewItem(BaseModel):
    linha: int
    banco: str
    agencia: str | None
    conta: str
    tipo: str
    cnpj: str | None
    empresa_id_destino: str
    empresa_nome_destino: str
    diferente: bool

class ContaConfirmarItem(BaseModel):
    empresa_id_destino: str
    banco: str
    agencia: str | None = None
    conta: str
    tipo: str = "corrente"
    cnpj: str | None = None

class DocumentoEsperadoUpdate(BaseModel):
    conta_bancaria_id: str | None = None
    tipo: str | None = None
    descricao: str | None = None
    frequencia: str | None = None
    ativo: bool | None = None

# ── Contas bancárias ───────────────────────────────────────────────────────

@router.get("/empresas/{empresa_id}/contas-bancarias")
def listar_contas(empresa_id: UUID):
    supabase = get_supabase()
    try:
        res = (
            supabase.schema("gestao_docs").from_("conta_bancaria")
            .select("*")
            .eq("empresa_id", str(empresa_id))
            .order("criado_em")
            .execute()
        )
        return res.data or []
    except Exception as exc:
        logger.error("listar_contas: %s", exc)
        return []


@router.post("/empresas/{empresa_id}/contas-bancarias", status_code=201)
def criar_conta(empresa_id: UUID, body: ContaBancariaIn):
    supabase = get_supabase()
    data = body.model_dump()
    data["empresa_id"] = str(empresa_id)
    try:
        res = supabase.schema("gestao_docs").from_("conta_bancaria").insert(data).execute()
        return res.data[0] if res.data else {}
    except Exception as exc:
        logger.error("criar_conta: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.put("/empresas/{empresa_id}/contas-bancarias/{conta_id}")
def atualizar_conta(empresa_id: UUID, conta_id: UUID, body: ContaBancariaUpdate):
    supabase = get_supabase()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    try:
        res = (
            supabase.schema("gestao_docs").from_("conta_bancaria")
            .update(updates)
            .eq("id", str(conta_id))
            .eq("empresa_id", str(empresa_id))
            .execute()
        )
        return res.data[0] if res.data else {}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/empresas/{empresa_id}/contas-bancarias/{conta_id}", status_code=204)
def deletar_conta(empresa_id: UUID, conta_id: UUID):
    supabase = get_supabase()
    try:
        supabase.schema("gestao_docs").from_("conta_bancaria").delete().eq("id", str(conta_id)).eq("empresa_id", str(empresa_id)).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Documentos esperados ───────────────────────────────────────────────────

@router.get("/empresas/{empresa_id}/documentos-esperados")
def listar_docs_esperados(empresa_id: UUID):
    supabase = get_supabase()
    try:
        res = (
            supabase.schema("gestao_docs").from_("documento_esperado")
            .select("*, conta_bancaria:conta_bancaria_id(id,banco,conta,tipo)")
            .eq("empresa_id", str(empresa_id))
            .order("criado_em")
            .execute()
        )
        return res.data or []
    except Exception as exc:
        logger.error("listar_docs_esperados: %s", exc)
        return []


@router.post("/empresas/{empresa_id}/documentos-esperados", status_code=201)
def criar_doc_esperado(empresa_id: UUID, body: DocumentoEsperadoIn):
    supabase = get_supabase()
    if body.tipo not in TIPOS_DOC:
        raise HTTPException(status_code=400, detail=f"Tipo inválido: {body.tipo}")
    data = body.model_dump()
    data["empresa_id"] = str(empresa_id)
    try:
        res = supabase.schema("gestao_docs").from_("documento_esperado").insert(data).execute()
        return res.data[0] if res.data else {}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.put("/empresas/{empresa_id}/documentos-esperados/{doc_id}")
def atualizar_doc_esperado(empresa_id: UUID, doc_id: UUID, body: DocumentoEsperadoUpdate):
    supabase = get_supabase()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    try:
        res = (
            supabase.schema("gestao_docs").from_("documento_esperado")
            .update(updates)
            .eq("id", str(doc_id))
            .eq("empresa_id", str(empresa_id))
            .execute()
        )
        return res.data[0] if res.data else {}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/empresas/{empresa_id}/documentos-esperados/{doc_id}", status_code=204)
def deletar_doc_esperado(empresa_id: UUID, doc_id: UUID):
    supabase = get_supabase()
    try:
        supabase.schema("gestao_docs").from_("documento_esperado").delete().eq("id", str(doc_id)).eq("empresa_id", str(empresa_id)).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Importar via planilha ──────────────────────────────────────────────────

@router.post("/empresas/{empresa_id}/importar-contas", status_code=201)
async def importar_contas(empresa_id: UUID, file: UploadFile = File(...)):
    """
    Importa contas bancárias de planilha XLSX.
    Colunas esperadas (ordem): Banco | Agência | Conta | Tipo | CNPJ
    """
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl não instalado no servidor")

    content = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        ws = wb.active
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Erro ao ler planilha: {exc}")

    supabase = get_supabase()
    inseridos = 0
    erros: list[str] = []

    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not any(row):
            continue
        try:
            banco = str(row[0] or "").strip()
            agencia = str(row[1] or "").strip() or None
            conta = str(row[2] or "").strip()
            tipo_raw = str(row[3] or "corrente").strip().lower()
            cnpj = str(row[4] or "").strip() or None

            if not banco or not conta:
                erros.append(f"Linha {idx}: banco e conta são obrigatórios")
                continue

            tipo = tipo_raw if tipo_raw in ("corrente", "poupanca", "investimento") else "corrente"

            supabase.schema("gestao_docs").from_("conta_bancaria").insert({
                "empresa_id": str(empresa_id),
                "banco": banco,
                "agencia": agencia,
                "conta": conta,
                "tipo": tipo,
                "cnpj": cnpj,
            }).execute()
            inseridos += 1
        except Exception as exc:
            erros.append(f"Linha {idx}: {exc}")

    return {"inseridos": inseridos, "erros": erros}


@router.post("/empresas/{empresa_id}/preview-importar-contas")
async def preview_importar_contas(empresa_id: UUID, file: UploadFile = File(...)):
    """
    Lê a planilha e retorna preview com a empresa destino de cada linha (sem salvar).
    Cruza o CNPJ da planilha com as empresas cadastradas no sistema.
    """
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl não instalado")

    content = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        ws = wb.active
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Erro ao ler planilha: {exc}")

    supabase = get_supabase()
    try:
        empresas = (supabase.schema("gestao_docs").from_("empresa")
                    .select("id,nome,cnpj").execute()).data or []
    except Exception:
        empresas = []

    def _find_empresa(cnpj_planilha: str | None) -> tuple[str, str, bool]:
        """Returns (empresa_id_destino, empresa_nome_destino, cnpj_desconhecido)."""
        norm = _norm_cnpj(cnpj_planilha)
        if norm:
            for emp in empresas:
                if _norm_cnpj(emp.get("cnpj")) == norm:
                    return emp["id"], emp.get("nome") or emp["id"], False
            # CNPJ fornecido mas não encontrado no sistema — avisa o usuário
            return str(empresa_id), f"CNPJ {cnpj_planilha} (empresa não cadastrada)", True
        return str(empresa_id), next(
            (emp.get("nome") or emp["id"] for emp in empresas if emp["id"] == str(empresa_id)),
            str(empresa_id),
        ), False

    items: list[ContaPreviewItem] = []
    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not any(row):
            continue
        banco = str(row[0] or "").strip()
        agencia = str(row[1] or "").strip() or None
        conta = str(row[2] or "").strip()
        tipo_raw = str(row[3] or "corrente").strip().lower().replace(" ", "_")
        cnpj = str(row[4] or "").strip() or None
        if not banco or not conta:
            continue
        tipo = tipo_raw if tipo_raw in ("corrente", "poupanca", "investimento", "conta_garantida") else "corrente"
        emp_id, emp_nome, cnpj_desconhecido = _find_empresa(cnpj)
        items.append(ContaPreviewItem(
            linha=idx, banco=banco, agencia=agencia, conta=conta, tipo=tipo, cnpj=cnpj,
            empresa_id_destino=emp_id, empresa_nome_destino=emp_nome,
            diferente=(emp_id != str(empresa_id)) or cnpj_desconhecido,
        ))
    return items


@router.post("/empresas/{empresa_id}/confirmar-importar-contas", status_code=201)
async def confirmar_importar_contas(empresa_id: UUID, items: list[ContaConfirmarItem]):
    """Salva contas confirmadas pelo usuário, cada uma na empresa destino resolvida.
    Ignora contas cujo número já existe na empresa destino (evita duplicatas)."""
    supabase = get_supabase()

    # Carrega contas existentes de todas as empresas destino para deduplicar
    dest_ids = list({item.empresa_id_destino for item in items})
    existing_keys: set[tuple[str, str]] = set()
    for eid in dest_ids:
        try:
            res = (supabase.schema("gestao_docs").from_("conta_bancaria")
                   .select("empresa_id,conta").eq("empresa_id", eid).execute())
            for row in res.data or []:
                existing_keys.add((row["empresa_id"], (row["conta"] or "").strip()))
        except Exception:
            pass

    inseridos = 0
    ignorados = 0
    erros: list[str] = []
    for item in items:
        key = (item.empresa_id_destino, item.conta.strip())
        if key in existing_keys:
            ignorados += 1
            continue
        try:
            supabase.schema("gestao_docs").from_("conta_bancaria").insert({
                "empresa_id": item.empresa_id_destino,
                "banco": item.banco,
                "agencia": item.agencia,
                "conta": item.conta,
                "tipo": item.tipo,
                "cnpj": item.cnpj,
            }).execute()
            inseridos += 1
            existing_keys.add(key)
        except Exception as exc:
            err_str = str(exc)
            if "tipo_check" in err_str or ("tipo" in err_str and "check" in err_str):
                erros.append(f"{item.banco} / {item.conta}: tipo '{item.tipo}' não é aceito pelo banco de dados")
            elif "duplicate" in err_str.lower() or "unique" in err_str.lower():
                erros.append(f"{item.banco} / {item.conta}: conta já cadastrada")
            else:
                erros.append(f"{item.banco} / {item.conta}: erro ao salvar")
    return {"inseridos": inseridos, "ignorados": ignorados, "erros": erros}


@router.post("/empresas/{empresa_id}/importar-documentos", status_code=201)
async def importar_documentos(empresa_id: UUID, file: UploadFile = File(...)):
    """
    Importa documentos esperados de planilha XLSX.
    Colunas esperadas (ordem): Tipo | Banco | Conta | Descrição | Frequência
    """
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl não instalado no servidor")

    content = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        ws = wb.active
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Erro ao ler planilha: {exc}")

    supabase = get_supabase()

    # Carrega contas da empresa para resolver banco+conta → conta_bancaria_id
    try:
        contas_res = supabase.schema("gestao_docs").from_("conta_bancaria").select("id,banco,conta").eq("empresa_id", str(empresa_id)).execute()
        contas_emp = contas_res.data or []
    except Exception:
        contas_emp = []

    def _find_conta(banco_str: str, conta_str: str) -> str | None:
        b = banco_str.lower().strip()
        c = conta_str.lower().strip()
        for ct in contas_emp:
            if b in (ct.get("banco") or "").lower() and c in (ct.get("conta") or "").lower():
                return ct["id"]
        return None

    inseridos = 0
    erros: list[str] = []

    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not any(row):
            continue
        try:
            tipo = str(row[0] or "").strip().lower().replace(" ", "_")
            banco = str(row[1] or "").strip()
            # suporta planilha com 5 colunas (sem agencia) ou 6 colunas (com agencia)
            if len(row) >= 6 and row[2] is not None and str(row[2]).strip():
                conta = str(row[3] or "").strip()
                descricao = str(row[4] or "").strip()
                freq_raw = str(row[5] or "mensal").strip().lower()
            else:
                conta = str(row[2] or "").strip()
                descricao = str(row[3] or "").strip()
                freq_raw = str(row[4] or "mensal").strip().lower()

            if tipo not in TIPOS_DOC:
                erros.append(f"Linha {idx}: tipo '{tipo}' inválido")
                continue
            if not descricao:
                descricao = f"{tipo.replace('_', ' ').title()} {banco} {conta}".strip()

            freq = freq_raw if freq_raw in ("mensal", "trimestral", "semestral", "anual") else "mensal"
            conta_id = _find_conta(banco, conta) if banco and conta else None

            supabase.schema("gestao_docs").from_("documento_esperado").insert({
                "empresa_id": str(empresa_id),
                "conta_bancaria_id": conta_id,
                "tipo": tipo,
                "descricao": descricao,
                "frequencia": freq,
            }).execute()
            inseridos += 1
        except Exception as exc:
            erros.append(f"Linha {idx}: {exc}")

    return {"inseridos": inseridos, "erros": erros}


# ── Pendências do mês ──────────────────────────────────────────────────────

@router.get("/empresas/{empresa_id}/pendencias/{ano}/{mes}")
def pendencias_mes(empresa_id: UUID, ano: int, mes: int):
    """
    Retorna lista de documentos esperados com status de recebimento para o mês/ano.
    """
    supabase = get_supabase()
    mes_ref = f"{ano:04d}-{mes:02d}"

    try:
        esperados = (
            supabase.schema("gestao_docs").from_("documento_esperado")
            .select("*, conta_bancaria:conta_bancaria_id(id,banco,conta,tipo)")
            .eq("empresa_id", str(empresa_id))
            .eq("ativo", True)
            .execute()
        ).data or []
    except Exception as exc:
        logger.error("pendencias_mes esperados: %s", exc)
        return []

    # Para frequência trimestral/semestral/anual filtra os meses que se aplicam
    def _aplica_mes(freq: str, m: int) -> bool:
        if freq == "mensal":
            return True
        if freq == "trimestral":
            return m in (1, 4, 7, 10)
        if freq == "semestral":
            return m in (1, 7)
        if freq == "anual":
            return m == 1
        return True

    esperados_mes = [e for e in esperados if _aplica_mes(e.get("frequencia", "mensal"), mes)]

    if not esperados_mes:
        return []

    # Busca documentos já recebidos neste mês para esta empresa
    try:
        recebidos = (
            supabase.schema("gestao_docs").from_("documento")
            .select("id,tipo,banco,conta,mes_referencia,status")
            .eq("empresa_id", str(empresa_id))
            .eq("mes_referencia", mes_ref)
            .not_.in_("status", ["duplicata", "baixado"])
            .is_("excluido_em", None)
            .execute()
        ).data or []
    except Exception:
        recebidos = []

    def _doc_matches(esperado: dict, recebido: dict) -> bool:
        if esperado["tipo"] != recebido.get("tipo"):
            return False
        cb = esperado.get("conta_bancaria")
        if not cb:
            return True
        def _n(s: str) -> str:
            return (s or "").lower().replace("-", "").replace(".", "").strip()
        banco_ok = not cb.get("banco") or _n(cb["banco"]) in _n(recebido.get("banco") or "") or _n(recebido.get("banco") or "") in _n(cb["banco"])
        conta_ok = not cb.get("conta") or _n(cb["conta"]) in _n(recebido.get("conta") or "")
        return banco_ok and conta_ok

    result = []
    for esp in esperados_mes:
        doc_recebido = next((r for r in recebidos if _doc_matches(esp, r)), None)
        result.append({
            **esp,
            "mes_referencia": mes_ref,
            "recebido": doc_recebido is not None,
            "documento_id": doc_recebido["id"] if doc_recebido else None,
        })

    return result


# ── Templates para download ────────────────────────────────────────────────

def _make_xlsx(headers: list[str], example_row: list) -> bytes:
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl não instalado")

    wb = openpyxl.Workbook()
    ws = wb.active

    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(fill_type="solid", fgColor="2563EB")

    for col, value in enumerate(example_row, 1):
        ws.cell(row=2, column=col, value=value)

    for col in range(1, len(headers) + 1):
        ws.column_dimensions[ws.cell(row=1, column=col).column_letter].width = 22

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


@router.get("/templates/contas-bancarias.xlsx")
def template_contas():
    headers = ["Banco", "Agência", "Conta", "Tipo", "CNPJ"]
    example = ["Banco do Brasil", "0001-9", "12345-6", "corrente", "00.000.000/0001-00"]
    content = _make_xlsx(headers, example)
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=modelo_contas_bancarias.xlsx"},
    )


@router.get("/templates/documentos-esperados.xlsx")
def template_documentos():
    headers = ["Tipo", "Banco", "Agência", "Conta", "Descrição", "Frequência"]
    example = [
        "extrato_bancario",
        "Banco do Brasil",
        "0001-9",
        "12345-6",
        "Extrato conta corrente BB",
        "mensal",
    ]
    content = _make_xlsx(headers, example)
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=modelo_documentos_esperados.xlsx"},
    )
