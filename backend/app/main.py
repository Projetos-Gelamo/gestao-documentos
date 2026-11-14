import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import companies, documents, reports, review
from app.api.routes import upload, tipos_esperados, plano_contas, lancamentos
from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")

app = FastAPI(title="Gestão de Documentos", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(companies.router)
app.include_router(documents.router)
app.include_router(review.router)
app.include_router(reports.router)
app.include_router(upload.router)
app.include_router(tipos_esperados.router)
app.include_router(plano_contas.router)
app.include_router(lancamentos.router)

scheduler = AsyncIOScheduler()


@app.on_event("startup")
async def startup():
    from app.core.supabase import ensure_storage_bucket
    from app.services.monitor import run_monitor
    from app.services.report import generate_daily_report

    ensure_storage_bucket()

    scheduler.add_job(
        run_monitor,
        "interval",
        minutes=settings.drive_poll_interval_minutes,
        id="drive_monitor",
        replace_existing=True,
    )

    cron_parts = settings.daily_report_cron.split()
    if len(cron_parts) == 5:
        minute, hour, day, month, day_of_week = cron_parts
        scheduler.add_job(
            generate_daily_report,
            CronTrigger(
                minute=minute, hour=hour, day=day,
                month=month, day_of_week=day_of_week,
            ),
            id="daily_report",
            replace_existing=True,
        )

    scheduler.start()


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown(wait=False)


@app.get("/health")
async def health():
    return {"status": "ok"}
