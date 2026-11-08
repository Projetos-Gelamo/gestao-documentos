import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.drive import DriveFileMeta


def _make_file_meta(**kwargs):
    defaults = dict(
        id="drive_file_id_001",
        name="extrato_jan.pdf",
        mime_type="application/pdf",
        created_time=datetime(2024, 1, 15, 10, 0, tzinfo=timezone.utc),
        modified_time=datetime(2024, 1, 15, 10, 0, tzinfo=timezone.utc),
        parent_folder_id="folder_001",
    )
    defaults.update(kwargs)
    return DriveFileMeta(**defaults)


@pytest.mark.asyncio
async def test_process_file_new_document_classified():
    file_meta = _make_file_meta()

    mock_supabase = MagicMock()
    mock_supabase.schema.return_value = mock_supabase
    mock_supabase.from_.return_value = mock_supabase
    mock_supabase.select.return_value = mock_supabase
    mock_supabase.eq.return_value = mock_supabase
    mock_supabase.insert.return_value = mock_supabase
    mock_supabase.execute.return_value = MagicMock(data=[{"id": "doc-uuid-001"}])

    from app.models.schemas import ClassificationResult, DocumentoStatus

    mock_result = ClassificationResult(doc_type="extrato_bancario", confidence=0.9)

    with (
        patch("app.services.monitor.download_file_bytes", return_value=b"%PDF"),
        patch("app.services.monitor.extract_text", return_value="texto"),
        patch("app.services.monitor.classify_document", new_callable=AsyncMock,
              return_value=(mock_result, DocumentoStatus.classificado)),
    ):
        from app.services.monitor import _process_file
        await _process_file(mock_supabase, file_meta, "empresa-uuid-001", False)

    mock_supabase.insert.assert_called()


@pytest.mark.asyncio
async def test_process_file_low_confidence_adds_to_review_queue():
    file_meta = _make_file_meta(name="desconhecido.pdf")

    mock_supabase = MagicMock()
    mock_supabase.schema.return_value = mock_supabase
    mock_supabase.from_.return_value = mock_supabase
    mock_supabase.select.return_value = mock_supabase
    mock_supabase.eq.return_value = mock_supabase
    insert_mock = MagicMock()
    insert_mock.execute.return_value = MagicMock(data=[{"id": "doc-uuid-002"}])
    mock_supabase.insert.return_value = insert_mock

    from app.models.schemas import ClassificationResult, DocumentoStatus

    mock_result = ClassificationResult(doc_type=None, confidence=0.3)

    with (
        patch("app.services.monitor.download_file_bytes", return_value=b"%PDF"),
        patch("app.services.monitor.extract_text", return_value=""),
        patch("app.services.monitor.classify_document", new_callable=AsyncMock,
              return_value=(mock_result, DocumentoStatus.nao_reconhecido)),
    ):
        from app.services.monitor import _process_file
        await _process_file(mock_supabase, file_meta, "empresa-uuid-001", False)

    # Deve ter chamado insert duas vezes: documento + fila_revisao
    assert mock_supabase.insert.call_count >= 2
