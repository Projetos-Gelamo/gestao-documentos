import pytest
from unittest.mock import AsyncMock, patch

from app.models.schemas import ClassificationResult, DocumentoStatus
from app.services.classifier import classify_document


@pytest.mark.asyncio
async def test_classify_high_confidence():
    mock_result = ClassificationResult(
        doc_type="extrato_bancario",
        mes_referencia="2024-03",
        cnpj="12345678000195",
        confidence=0.95,
    )
    with patch("app.services.classifier.get_classifier") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.classify.return_value = mock_result
        mock_get.return_value = mock_provider

        result, status = await classify_document("texto do extrato", "extrato_marco.pdf")

    assert result.doc_type == "extrato_bancario"
    assert result.confidence == 0.95
    assert status == DocumentoStatus.classificado


@pytest.mark.asyncio
async def test_classify_low_confidence_goes_to_review():
    mock_result = ClassificationResult(
        doc_type="outros",
        mes_referencia=None,
        cnpj=None,
        confidence=0.4,
    )
    with patch("app.services.classifier.get_classifier") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.classify.return_value = mock_result
        mock_get.return_value = mock_provider

        result, status = await classify_document("conteúdo incerto", "arquivo_desconhecido.pdf")

    assert status == DocumentoStatus.nao_reconhecido


@pytest.mark.asyncio
async def test_classify_provider_error_returns_nao_reconhecido():
    with patch("app.services.classifier.get_classifier") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.classify.side_effect = Exception("API timeout")
        mock_get.return_value = mock_provider

        result, status = await classify_document("texto qualquer", "doc.pdf")

    assert status == DocumentoStatus.nao_reconhecido
    assert result.confidence == 0.0
