import io
import json
from datetime import datetime, timezone

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from pydantic import BaseModel

from app.core.config import settings

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]


class DriveFileMeta(BaseModel):
    id: str
    name: str
    mime_type: str
    created_time: datetime
    modified_time: datetime
    parent_folder_id: str | None = None


def _build_service():
    info = json.loads(settings.google_service_account_json)
    creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def list_new_files(folder_id: str, since: datetime | None) -> list[DriveFileMeta]:
    service = _build_service()
    query = f"'{folder_id}' in parents and trashed = false"
    if since:
        ts = since.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        query += f" and modifiedTime > '{ts}'"

    result = (
        service.files()
        .list(
            q=query,
            fields="files(id,name,mimeType,createdTime,modifiedTime,parents)",
            pageSize=100,
        )
        .execute()
    )

    files = []
    for f in result.get("files", []):
        files.append(
            DriveFileMeta(
                id=f["id"],
                name=f["name"],
                mime_type=f["mimeType"],
                created_time=datetime.fromisoformat(f["createdTime"].replace("Z", "+00:00")),
                modified_time=datetime.fromisoformat(f["modifiedTime"].replace("Z", "+00:00")),
                parent_folder_id=(f.get("parents") or [None])[0],
            )
        )
    return files


def download_file_bytes(file_id: str) -> bytes:
    service = _build_service()
    request = service.files().get_media(fileId=file_id)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return buf.getvalue()
