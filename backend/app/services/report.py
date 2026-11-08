import logging
from datetime import date, datetime, timezone

from app.core.supabase import get_supabase
from app.services.email_service import send_email

logger = logging.getLogger(__name__)


async def generate_daily_report() -> None:
    """Generate and send the daily error report to managers and affected employees."""
    supabase = get_supabase()
    today = date.today().isoformat()

    # Erros do dia: pasta errada + pendentes em revisão há mais de 24h
    erros_res = (
        supabase.schema("gestao_docs")
        .from_("relatorio_erro")
        .select("*, empresa:empresa_id(nome, codigo), documento:documento_id(nome_arquivo, tipo, status)")
        .gte("data", today)
        .is_("notificado_em", "null")
        .execute()
    )
    erros = erros_res.data or []

    if not erros:
        logger.info("Nenhum erro para reportar hoje (%s)", today)
        return

    # Busca destinatários: gestores + funcionários das empresas afetadas
    empresa_ids = list({e["empresa_id"] for e in erros if e.get("empresa_id")})
    destinatarios = await _get_destinatarios(supabase, empresa_ids)

    if not destinatarios:
        logger.warning("Nenhum destinatário encontrado para o relatório")
        return

    html = _build_html(erros, today)
    await send_email(destinatarios, f"Relatório de Erros — {today}", html)

    # Marca erros como notificados
    ids = [e["id"] for e in erros]
    supabase.schema("gestao_docs").from_("relatorio_erro").update(
        {"notificado_em": datetime.now(timezone.utc).isoformat()}
    ).in_("id", ids).execute()

    logger.info("Relatório enviado para %d destinatários, %d erros", len(destinatarios), len(erros))


async def _get_destinatarios(supabase, empresa_ids: list[str]) -> list[str]:
    emails: set[str] = set()

    # Gestores recebem sempre
    gestores = (
        supabase.schema("gestao_docs")
        .from_("funcionario")
        .select("email")
        .eq("perfil", "gestor")
        .execute()
    )
    for g in gestores.data or []:
        emails.add(g["email"])

    # Funcionários com as empresas na carteira
    if empresa_ids:
        func_emp = (
            supabase.schema("gestao_docs")
            .from_("funcionario_empresa")
            .select("funcionario:funcionario_id(email)")
            .in_("empresa_id", empresa_ids)
            .execute()
        )
        for row in func_emp.data or []:
            if row.get("funcionario"):
                emails.add(row["funcionario"]["email"])

    return list(emails)


def _build_html(erros: list[dict], today: str) -> str:
    rows = ""
    for e in erros:
        empresa_nome = (e.get("empresa") or {}).get("nome", "—")
        doc_nome = (e.get("documento") or {}).get("nome_arquivo", "—")
        tipo_erro = e.get("tipo_erro", "—")
        rows += f"<tr><td>{empresa_nome}</td><td>{doc_nome}</td><td>{tipo_erro}</td></tr>"

    return f"""
    <html><body>
    <h2>Relatório de Erros — {today}</h2>
    <p>Foram encontrados <strong>{len(erros)}</strong> problema(s) hoje.</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead><tr><th>Empresa</th><th>Documento</th><th>Tipo de Erro</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
    <p>Acesse o sistema para mais detalhes.</p>
    </body></html>
    """
