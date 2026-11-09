import logging

from supabase import create_client, Client

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: Client | None = None

STORAGE_BUCKET = "documentos"


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _client


def ensure_storage_bucket() -> None:
    try:
        get_supabase().storage.create_bucket(STORAGE_BUCKET, options={"public": False})
        logger.info("Storage bucket '%s' criado.", STORAGE_BUCKET)
    except Exception:
        pass  # Já existe
