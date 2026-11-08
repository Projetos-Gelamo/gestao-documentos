from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), extra="ignore")

    # Supabase
    supabase_url: str
    supabase_service_role_key: str

    # Google Drive
    google_service_account_json: str = ""

    # Classificador
    classifier_provider: str = "claude"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""
    classifier_confidence_threshold: float = 0.7

    # Monitor
    drive_poll_interval_minutes: int = 2

    # E-mail
    email_provider: str = "resend"
    email_api_key: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    email_from: str = "relatorios@seuescritorio.com.br"

    # Relatório diário
    daily_report_cron: str = "0 7 * * 1-5"


settings = Settings()
