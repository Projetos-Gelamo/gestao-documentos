import traceback

from fastapi import APIRouter, BackgroundTasks

from app.core.drive import list_new_files
from app.core.supabase import get_supabase
from app.services.monitor import run_monitor
from app.services.report import generate_daily_report

router = APIRouter(prefix="/relatorios", tags=["relatorios"])


@router.get("/erros")
async def list_erros(data: str | None = None):
    """Lista relatórios de erro. Filtra por data (YYYY-MM-DD) se fornecida."""
    supabase = get_supabase()
    query = (
        supabase.schema("gestao_docs").from_("relatorio_erro")
        .select("*, empresa:empresa_id(nome), documento:documento_id(nome_arquivo)")
        .order("data", desc=True)
    )
    if data:
        query = query.gte("data", data).lt("data", data + "T23:59:59")
    res = query.limit(200).execute()
    return res.data or []


@router.post("/disparar")
async def disparar_relatorio(background_tasks: BackgroundTasks):
    """Dispara o relatório diário manualmente (apenas gestores devem chamar)."""
    background_tasks.add_task(generate_daily_report)
    return {"ok": True, "message": "Relatório sendo gerado em segundo plano"}


@router.post("/monitor/executar")
async def disparar_monitor(background_tasks: BackgroundTasks):
    """Dispara o monitoramento do Drive manualmente."""
    background_tasks.add_task(run_monitor)
    return {"ok": True, "message": "Monitor do Drive iniciado em segundo plano"}


@router.get("/monitor/debug-extracao")
async def debug_extracao(file_id: str, mime_type: str = ""):
    """Baixa um arquivo do Drive e retorna os primeiros 500 chars extraídos."""
    from app.core.drive import download_file_bytes
    from app.services.extractor import extract_text
    try:
        file_bytes = download_file_bytes(file_id, mime_type)
        text = extract_text(file_bytes, f"test.{mime_type.split('/')[-1] if '/' in mime_type else 'txt'}")
        return {
            "file_id": file_id,
            "mime_type": mime_type,
            "bytes_len": len(file_bytes),
            "text_len": len(text),
            "text_preview": text[:500] if text else "(vazio)",
        }
    except Exception as exc:
        return {"error": str(exc)}
