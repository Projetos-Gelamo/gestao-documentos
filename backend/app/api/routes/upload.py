import logging
import re
import unicodedata
import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.supabase import STORAGE_BUCKET, get_supabase
from app.models.schemas import DocumentoStatus, UploadResult
from app.services.classifier import classify_document
from app.services.extractor import extract_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["upload"])

_MESES = {
    "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril",
    "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
    "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro",
}

_DEPARTAMENTO_MAP: dict[str, str] = {
    "extrato_bancario":      "contabil",
    "balancete":             "contabil",
    "dre":                   "contabil",
    "planilha_financeira":   "contabil",
    "guia_pagamento":        "contabil",
    "comprovante_pagamento": "contabil",
    "contrato_emprestimo":   "contabil",
    "nota_fiscal":           "fiscal",
    "folha_pagamento":       "dp",
    "recibo":                "dp",
    "contrato":              "legal",
}


def _sanitize_filename(name: str) -> str:
    """Remove acentos, substitui espaços por _ e remove caracteres inválidos para o Storage."""
    # Normaliza unicode → remove marcas de acento
    normalized = unicodedata.normalize("NFD", name)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    # Substitui espaços e caracteres problemáticos por _
    safe = re.sub(r"[^\w.\-]", "_", ascii_name)
    # Colapsa múltiplos _ consecutivos
    safe = re.sub(r"_+", "_", safe).strip("_")
    return safe or "arquivo"


def _nome_sugerido(tipo: str | None, mes: str | None, banco: str | None, conta: str | None) -> str | None:
    tipo_label = {
        "extrato_bancario": "Extrato",
        "nota_fiscal": "NF-e",
        "guia_pagamento": "Guia de Pagamento",
        "contrato": "Contrato",
        "recibo": "Recibo",
        "balancete": "Balancete",
        "dre": "DRE",
        "folha_pagamento": "Folha de Pagamento",
        "comprovante_pagamento": "Comprovante de Pagamento",
        "contrato_emprestimo": "Contrato de Empréstimo",
        "planilha_financeira": "Planilha Financeira",
        "outros": "Documento",
    }.get(tipo or "", None)

    if not tipo_label:
        return None

    parts = [tipo_label]
    if banco:
        parts.append(banco)
    if conta:
        parts.append(f"CC {conta}")
    if mes and len(mes) == 7:
        ano, m = mes.split("-")
        parts.append(f"{_MESES.get(m, m)}/{ano}")

    return " — ".join(parts)


@router.post("/", response_model=UploadResult)
async def upload_documento(
    empresa_id: str = Form(...),
    file: UploadFile = File(...),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio")

    filename = file.filename or "arquivo"
    content_type = file.content_type or "application/octet-stream"

    # Caminho no Storage: empresa_id/YYYY-MM/uuid_safe_filename
    mes_upload = datetime.now().strftime("%Y-%m")
    file_id = str(uuid.uuid4())[:8]
    safe_filename = _sanitize_filename(filename)
    storage_path = f"{empresa_id}/{mes_upload}/{file_id}_{safe_filename}"

    # Busca CNPJ da empresa destino para validação posterior
    supabase = get_supabase()
    cnpj_empresa: str | None = None
    try:
        emp_res = supabase.schema("gestao_docs").from_("empresa").select("cnpj").eq("id", empresa_id).single().execute()
        cnpj_empresa = emp_res.data.get("cnpj") if emp_res.data else None
    except Exception:
        pass

    # Salva no Storage
    try:
        supabase.storage.from_(STORAGE_BUCKET).upload(
            path=storage_path,
            file=content,
            file_options={"content-type": content_type, "upsert": "true"},
        )
    except Exception as exc:
        logger.error("Erro ao salvar no Storage: %s", exc)
        raise HTTPException(status_code=500, detail=f"Erro ao salvar arquivo: {exc}")

    # Extrai texto e classifica (passa content para vision quando texto vazio)
    text = extract_text(content, filename)
    result, status = await classify_document(text, filename, file_bytes=content)

    # Valida CNPJ: documento pertence a esta empresa?
    empresa_errada = False
    empresa_destino_id: str | None = None

    def _normaliza_cnpj(c: str) -> str:
        return "".join(ch for ch in c if ch.isdigit())

    if (
        result.cnpj
        and cnpj_empresa
        and status not in (DocumentoStatus.nao_reconhecido,)
        and result.confidence >= 0.80
    ):
        cnpj_doc = _normaliza_cnpj(result.cnpj)
        cnpj_emp = _normaliza_cnpj(cnpj_empresa)
        if cnpj_doc and cnpj_emp and cnpj_doc != cnpj_emp:
            empresa_errada = True
            status = DocumentoStatus.empresa_errada
            logger.warning(
                "Empresa errada: doc CNPJ=%s, empresa CNPJ=%s (empresa_id=%s)",
                cnpj_doc, cnpj_emp, empresa_id,
            )
            # Tenta encontrar a empresa correta pelo CNPJ do documento
            try:
                todas = supabase.schema("gestao_docs").from_("empresa").select("id,cnpj").execute()
                for e in (todas.data or []):
                    if _normaliza_cnpj(e.get("cnpj") or "") == cnpj_doc:
                        empresa_destino_id = e["id"]
                        break
            except Exception:
                pass

    # Detecta duplicata: mesmo empresa + tipo + mes + banco (fuzzy) + conta (só se não for empresa errada)
    duplicata_de: str | None = None
    if not empresa_errada and result.doc_type and result.doc_type != "nao_reconhecido" and result.mes_referencia:
        try:
            q = (
                supabase.schema("gestao_docs")
                .from_("documento")
                .select("id,banco,conta")
                .eq("empresa_id", empresa_id)
                .eq("tipo", result.doc_type)
                .eq("mes_referencia", result.mes_referencia)
                .not_.eq("status", "duplicata")
                .execute()
            )
            for existing in q.data:
                banco_esp = (result.banco or "").lower().strip()
                banco_doc = (existing.get("banco") or "").lower().strip()
                conta_esp = (result.conta or "").lower().replace("-", "").replace(".", "").strip()
                conta_doc = (existing.get("conta") or "").lower().replace("-", "").replace(".", "").strip()
                banco_match = (not banco_esp) or (banco_esp in banco_doc) or (banco_doc and banco_doc in banco_esp)
                if not conta_esp and not conta_doc:
                    conta_match = True
                elif conta_esp and conta_doc:
                    conta_match = (conta_esp in conta_doc) or (conta_doc in conta_esp)
                else:
                    conta_match = not conta_esp
                if banco_match and conta_match:
                    duplicata_de = existing["id"]
                    status = DocumentoStatus.duplicata
                    logger.info("Duplicata detectada: novo arquivo duplica documento %s", duplicata_de)
                    break
        except Exception as exc:
            logger.warning("Erro ao checar duplicata: %s", exc)

    # Persiste documento no banco
    doc_data = {
        "empresa_id": empresa_id,
        "storage_path": storage_path,
        "nome_arquivo": filename,
        "tipo": result.doc_type,
        "departamento": _DEPARTAMENTO_MAP.get(result.doc_type or "", "outros"),
        "mes_referencia": result.mes_referencia,
        "status": status.value,
        "cnpj_extraido": result.cnpj,
        "banco": result.banco,
        "conta": result.conta,
        "confianca": result.confidence,
        "ficticio": False,
    }
    try:
        doc_res = supabase.schema("gestao_docs").from_("documento").insert(doc_data).execute()
        doc_id = doc_res.data[0]["id"]
    except Exception as exc:
        logger.error("Erro ao inserir documento: %s", exc)
        raise HTTPException(status_code=500, detail=f"Erro ao salvar metadados: {exc}")

    # Fila de revisão: documentos não reconhecidos e empresa errada
    na_fila = status in (DocumentoStatus.nao_reconhecido, DocumentoStatus.empresa_errada)
    if na_fila:
        try:
            supabase.schema("gestao_docs").from_("fila_revisao").insert(
                {"documento_id": doc_id}
            ).execute()
        except Exception as exc:
            logger.warning("Erro ao inserir na fila de revisão: %s", exc)

    # Relatório de erro: nao_reconhecido, empresa_errada, duplicata
    _TIPO_ERRO_MAP = {
        DocumentoStatus.nao_reconhecido: "pendente_revisao",
        DocumentoStatus.empresa_errada:   "pasta_errada",
        DocumentoStatus.duplicata:        "pasta_errada",
    }
    tipo_erro = _TIPO_ERRO_MAP.get(status)
    if tipo_erro:
        try:
            supabase.schema("gestao_docs").from_("relatorio_erro").insert({
                "data": datetime.now().isoformat(),
                "empresa_id": empresa_id,
                "documento_id": doc_id,
                "tipo_erro": tipo_erro,
            }).execute()
        except Exception as exc:
            logger.warning("Erro ao registrar relatorio_erro: %s", exc)

    return UploadResult(
        id=doc_id,
        nome_arquivo=filename,
        storage_path=storage_path,
        tipo=result.doc_type,
        mes_referencia=result.mes_referencia,
        banco=result.banco,
        conta=result.conta,
        cnpj=result.cnpj,
        confidence=result.confidence,
        status=status,
        na_fila_revisao=na_fila,
        nome_sugerido=_nome_sugerido(result.doc_type, result.mes_referencia, result.banco, result.conta),
        duplicata_de=duplicata_de,
        cnpj_empresa_esperado=cnpj_empresa if empresa_errada else None,
        empresa_destino_id=empresa_destino_id,
    )


# ── Fluxo de upload em 3 etapas ──────────────────────────────────────────────

class ConfirmarItem(BaseModel):
    documento_id: str
    acao: str  # "salvar_aqui" | "fila_espera" | "baixar"
    is_nova_conta: bool = False  # se True e acao=salvar_aqui, cria tipo_esperado
    allow_format_duplicate: bool = False  # se True, pula checagem de duplicata (formatos intencionais)

class ConfirmarRequest(BaseModel):
    empresa_id: str          # empresa atual (para "salvar_aqui")
    mapeamentos: List[ConfirmarItem]


def _norm_cnpj(c: str) -> str:
    return "".join(ch for ch in c if ch.isdigit())


@router.post("/scan")
async def scan_upload(
    empresa_id: str = Form(...),
    files: List[UploadFile] = File(...),
):
    """Etapa 1: armazena arquivos e extrai info. Sem checagem de duplicatas ainda."""
    supabase = get_supabase()

    # Carrega todas as empresas uma vez para sugerir pelo CNPJ
    empresas_cache: list[dict] = []
    try:
        r = supabase.schema("gestao_docs").from_("empresa").select("id,cnpj,nome").execute()
        empresas_cache = r.data or []
    except Exception:
        pass

    # Contas já confirmadas para esta empresa (banco+conta normalizados)
    contas_conhecidas: set[str] = set()
    try:
        te_res = (
            supabase.schema("gestao_docs").from_("tipo_documento_esperado")
            .select("banco,conta").eq("empresa_id", empresa_id).execute()
        )
        for t in (te_res.data or []):
            b = (t.get("banco") or "").lower().strip()
            c = re.sub(r"[^\d]", "", t.get("conta") or "")
            if b and c:
                contas_conhecidas.add(f"{b}|{c}")
    except Exception:
        pass

    # Lookup global: conta_bancaria de OUTRAS empresas → sugere empresa certa no scan
    # Chave dupla: "banco|conta_digits" (exato) e "|conta_digits" (fallback se banco difere)
    conta_empresa_map: dict[str, tuple[str, str | None]] = {}
    # Mapa de sufixo para OFX que combina agência+conta sem separador (ex: "0143118107" → "118107")
    conta_suffix_map: dict[str, tuple[str, str | None]] = {}
    try:
        cb_res = (
            supabase.schema("gestao_docs").from_("conta_bancaria")
            .select("banco,conta,empresa_id")
            .neq("empresa_id", empresa_id)
            .execute()
        )
        emp_nome_map = {e["id"]: e.get("nome") for e in empresas_cache}
        for cb in (cb_res.data or []):
            b = (cb.get("banco") or "").lower().strip()
            c = re.sub(r"[^\d]", "", cb.get("conta") or "")
            eid = cb.get("empresa_id", "")
            nome = emp_nome_map.get(eid)
            if c:
                conta_empresa_map[f"{b}|{c}"] = (eid, nome)
                # Chave só por conta (fallback quando nome do banco varia entre PDF e BD)
                conta_empresa_map.setdefault(f"|{c}", (eid, nome))
                # Sufixo: OFX pode emitir agência+conta como string única
                if len(c) >= 5:
                    conta_suffix_map.setdefault(c, (eid, nome))
    except Exception as exc:
        logger.warning("upload scan: falha ao carregar conta_empresa_map: %s", exc)

    results = []

    for file in files:
        content = await file.read()
        if not content:
            continue

        filename = file.filename or "arquivo"
        content_type = file.content_type or "application/octet-stream"
        mes_upload = datetime.now().strftime("%Y-%m")
        file_id = str(uuid.uuid4())[:8]
        safe_filename = _sanitize_filename(filename)
        storage_path = f"{empresa_id}/{mes_upload}/{file_id}_{safe_filename}"

        try:
            supabase.storage.from_(STORAGE_BUCKET).upload(
                path=storage_path,
                file=content,
                file_options={"content-type": content_type, "upsert": "true"},
            )
        except Exception as exc:
            logger.error("Scan: erro ao salvar '%s': %s", filename, exc)
            results.append({"nome_arquivo": filename, "erro": str(exc), "status": "erro"})
            continue

        text = extract_text(content, filename)
        result, status = await classify_document(text, filename, file_bytes=content)

        # Sugere empresa pelo CNPJ extraído
        empresa_sugerida_id: str = empresa_id
        empresa_sugerida_nome: str | None = None
        if result.cnpj:
            cnpj_doc = _norm_cnpj(result.cnpj)
            for e in empresas_cache:
                if _norm_cnpj(e.get("cnpj") or "") == cnpj_doc:
                    empresa_sugerida_id = e["id"]
                    empresa_sugerida_nome = e.get("nome")
                    break

        # Se CNPJ não identificou outra empresa, tenta pelo banco+conta cadastrado
        if empresa_sugerida_id == empresa_id and result.conta:
            b = (result.banco or "").lower().strip()
            c_full = re.sub(r"[^\d]", "", result.conta)
            # PDF pode trazer agencia/conta (ex: "0143/11810-7") — tenta também só dígitos pós "/"
            c_sem_ag = c_full
            if "/" in result.conta:
                c_sem_ag = re.sub(r"[^\d]", "", result.conta.split("/", 1)[1])
            match = None
            for c in dict.fromkeys([c_full, c_sem_ag]):  # preserva ordem, sem duplicatas
                if b:
                    match = conta_empresa_map.get(f"{b}|{c}")
                if not match:
                    match = conta_empresa_map.get(f"|{c}")
                if match:
                    break
            # Fallback por containment: OFX combina agência+conta sem separador
            # "0143118107" contém "118107" (BD) e "118107" está contido em "0143118107"
            if not match and len(c_full) >= 5:
                for suf_c, suf_val in conta_suffix_map.items():
                    if len(suf_c) >= 5 and (suf_c in c_full or c_full in suf_c):
                        match = suf_val
                        break
            if match:
                empresa_sugerida_id, empresa_sugerida_nome = match

        # Conta é nova para esta empresa?
        conta_nova = True
        if result.banco and result.conta:
            b = result.banco.lower().strip()
            c = re.sub(r"[^\d]", "", result.conta)
            if b and c:
                conta_nova = f"{b}|{c}" not in contas_conhecidas

        doc_status = "nao_reconhecido" if status == DocumentoStatus.nao_reconhecido else "aguardando_classificacao"
        doc_data = {
            "empresa_id": empresa_id,
            "storage_path": storage_path,
            "nome_arquivo": filename,
            "tipo": result.doc_type,
            "departamento": _DEPARTAMENTO_MAP.get(result.doc_type or "", "outros"),
            "mes_referencia": result.mes_referencia,
            "status": doc_status,
            "cnpj_extraido": result.cnpj,
            "banco": result.banco,
            "conta": result.conta,
            "confianca": result.confidence,
            "ficticio": False,
        }
        try:
            doc_res = supabase.schema("gestao_docs").from_("documento").insert(doc_data).execute()
            doc_id = doc_res.data[0]["id"]
        except Exception as exc:
            logger.error("Scan: erro ao inserir '%s': %s", filename, exc)
            try:
                supabase.storage.from_(STORAGE_BUCKET).remove([storage_path])
            except Exception:
                pass
            results.append({"nome_arquivo": filename, "erro": str(exc), "status": "erro"})
            continue

        results.append({
            "id": doc_id,
            "nome_arquivo": filename,
            "tipo": result.doc_type,
            "banco": result.banco,
            "conta": result.conta,
            "cnpj_extraido": result.cnpj,
            "mes_referencia": result.mes_referencia,
            "confidence": result.confidence,
            "status": doc_status,
            "empresa_sugerida_id": empresa_sugerida_id,
            "empresa_sugerida_nome": empresa_sugerida_nome,
            "conta_nova": conta_nova,
        })

    return {"arquivos": results}


@router.post("/confirmar")
async def confirmar_upload(body: ConfirmarRequest):
    """Etapa 2: processa cada documento conforme acao do usuario."""
    supabase = get_supabase()
    results = []

    for item in body.mapeamentos:
        doc_id = item.documento_id
        acao = item.acao  # "salvar_aqui" | "fila_espera" | "baixar"

        try:
            doc_res = (
                supabase.schema("gestao_docs").from_("documento")
                .select("*").eq("id", doc_id).single().execute()
            )
            doc = doc_res.data
        except Exception as exc:
            results.append({"id": doc_id, "status": "erro", "nome_arquivo": "", "erro": str(exc)})
            continue

        if not doc:
            results.append({"id": doc_id, "status": "erro", "nome_arquivo": "", "erro": "Não encontrado"})
            continue

        tipo = doc.get("tipo")
        banco = doc.get("banco")
        conta = doc.get("conta")
        mes_ref = doc.get("mes_referencia")
        filename = doc.get("nome_arquivo", "")

        # ── Fila de espera ────────────────────────────────────────────────────
        if acao == "fila_espera":
            supabase.schema("gestao_docs").from_("documento").update(
                {"status": "aguardando_roteamento"}
            ).eq("id", doc_id).execute()
            try:
                supabase.schema("gestao_docs").from_("fila_revisao").insert(
                    {"documento_id": doc_id}
                ).execute()
            except Exception:
                pass
            results.append({
                "id": doc_id, "nome_arquivo": filename, "tipo": tipo,
                "banco": banco, "conta": conta, "mes_referencia": mes_ref,
                "status": "aguardando_roteamento", "duplicata_de": None,
                "empresa_id": doc.get("empresa_id"),
                "cnpj_extraido": doc.get("cnpj_extraido"),
                "confidence": doc.get("confianca", 0),
                "nome_sugerido": _nome_sugerido(tipo, mes_ref, banco, conta),
                "download_url": None,
            })
            continue

        # ── Baixar e descartar ────────────────────────────────────────────────
        if acao == "baixar":
            download_url: str | None = None
            storage_path = doc.get("storage_path")
            if storage_path:
                try:
                    r = supabase.storage.from_(STORAGE_BUCKET).create_signed_url(storage_path, 300)
                    download_url = r.get("signedURL") or r.get("signed_url")
                except Exception as exc:
                    logger.warning("Baixar: erro ao gerar URL: %s", exc)
                # Soft-delete
                from datetime import timezone
                agora = datetime.now(timezone.utc).isoformat()
                supabase.schema("gestao_docs").from_("documento").update({
                    "status": "excluido",
                    "excluido_em": agora,
                    "excluido_por": "usuario",
                }).eq("id", doc_id).execute()
                try:
                    supabase.storage.from_(STORAGE_BUCKET).remove([storage_path])
                except Exception:
                    pass
            results.append({
                "id": doc_id, "nome_arquivo": filename, "tipo": tipo,
                "banco": banco, "conta": conta, "mes_referencia": mes_ref,
                "status": "baixado", "duplicata_de": None,
                "empresa_id": doc.get("empresa_id"),
                "cnpj_extraido": doc.get("cnpj_extraido"),
                "confidence": doc.get("confianca", 0),
                "nome_sugerido": None,
                "download_url": download_url,
            })
            continue

        # ── Salvar aqui (padrão) ──────────────────────────────────────────────
        empresa_destino_id = body.empresa_id

        # Nao reconhecido: vai para fila de revisão
        if doc.get("status") == "nao_reconhecido":
            supabase.schema("gestao_docs").from_("documento").update(
                {"empresa_id": empresa_destino_id}
            ).eq("id", doc_id).execute()
            try:
                supabase.schema("gestao_docs").from_("fila_revisao").insert({"documento_id": doc_id}).execute()
            except Exception:
                pass
            try:
                supabase.schema("gestao_docs").from_("relatorio_erro").insert({
                    "data": datetime.now().isoformat(),
                    "empresa_id": empresa_destino_id,
                    "documento_id": doc_id,
                    "tipo_erro": "pendente_revisao",
                }).execute()
            except Exception:
                pass
            results.append({
                "id": doc_id, "nome_arquivo": filename, "tipo": tipo,
                "banco": banco, "conta": conta, "mes_referencia": mes_ref,
                "status": "nao_reconhecido", "duplicata_de": None,
                "empresa_id": empresa_destino_id,
                "cnpj_extraido": doc.get("cnpj_extraido"),
                "confidence": doc.get("confianca", 0),
                "nome_sugerido": _nome_sugerido(tipo, mes_ref, banco, conta),
                "download_url": None,
            })
            continue

        # Checa duplicata na empresa destino
        duplicata_de = None
        final_status = "classificado"

        if tipo and mes_ref and not item.allow_format_duplicate:
            try:
                q = (
                    supabase.schema("gestao_docs").from_("documento")
                    .select("id,banco,conta")
                    .eq("empresa_id", empresa_destino_id)
                    .eq("tipo", tipo)
                    .eq("mes_referencia", mes_ref)
                    .not_.in_("status", ["duplicata", "aguardando_classificacao", "aguardando_roteamento", "excluido"])
                    .neq("id", doc_id)
                    .is_("excluido_em", None)
                    .execute()
                )
                for existing in (q.data or []):
                    banco_esp = (banco or "").lower().strip()
                    banco_doc = (existing.get("banco") or "").lower().strip()
                    conta_esp = (conta or "").lower().replace("-", "").replace(".", "").strip()
                    conta_doc = (existing.get("conta") or "").lower().replace("-", "").replace(".", "").strip()
                    banco_match = (not banco_esp) or (banco_esp in banco_doc) or (banco_doc and banco_doc in banco_esp)
                    if not conta_esp and not conta_doc:
                        conta_match = True
                    elif conta_esp and conta_doc:
                        conta_match = (conta_esp in conta_doc) or (conta_doc in conta_esp)
                    else:
                        conta_match = not conta_esp
                    if banco_match and conta_match:
                        duplicata_de = existing["id"]
                        final_status = "duplicata"
                        break
            except Exception as exc:
                logger.warning("Confirmar: erro ao checar duplicata: %s", exc)

        supabase.schema("gestao_docs").from_("documento").update({
            "empresa_id": empresa_destino_id,
            "status": final_status,
        }).eq("id", doc_id).execute()

        # Registra tipo_esperado quando o usuário confirma uma conta nova
        # Para extrato_bancario: exige banco+conta. Para outros tipos: só o tipo basta.
        _cria_tipo = (
            final_status == "classificado" and item.is_nova_conta and tipo
            and (tipo != "extrato_bancario" or (banco and conta))
        )
        if _cria_tipo:
            try:
                supabase.schema("gestao_docs").from_("tipo_documento_esperado").insert({
                    "empresa_id": empresa_destino_id,
                    "tipo": tipo,
                    "banco": banco,
                    "conta": conta,
                    "periodicidade": "mensal",
                }).execute()
            except Exception:
                pass  # já existe ou outro erro não crítico

        duplicata_nome_arquivo: str | None = None
        if final_status == "duplicata":
            # Busca nome do arquivo original para exibir ao usuário
            if duplicata_de:
                try:
                    orig = (
                        supabase.schema("gestao_docs").from_("documento")
                        .select("nome_arquivo").eq("id", duplicata_de).single().execute()
                    )
                    duplicata_nome_arquivo = (orig.data or {}).get("nome_arquivo")
                except Exception:
                    pass
            # Adiciona duplicata à fila de revisão
            try:
                supabase.schema("gestao_docs").from_("fila_revisao").insert(
                    {"documento_id": doc_id}
                ).execute()
            except Exception:
                pass
            try:
                supabase.schema("gestao_docs").from_("relatorio_erro").insert({
                    "data": datetime.now().isoformat(),
                    "empresa_id": empresa_destino_id,
                    "documento_id": doc_id,
                    "tipo_erro": "pasta_errada",
                }).execute()
            except Exception:
                pass

        results.append({
            "id": doc_id, "nome_arquivo": filename, "tipo": tipo,
            "banco": banco, "conta": conta, "mes_referencia": mes_ref,
            "status": final_status, "duplicata_de": duplicata_de,
            "duplicata_nome_arquivo": duplicata_nome_arquivo,
            "empresa_id": empresa_destino_id,
            "cnpj_extraido": doc.get("cnpj_extraido"),
            "confidence": doc.get("confianca", 0),
            "nome_sugerido": _nome_sugerido(tipo, mes_ref, banco, conta),
            "download_url": None,
        })

    return {"resultados": results}
