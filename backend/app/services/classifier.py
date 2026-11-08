import logging

from app.core.config import settings
from app.models.schemas import ClassificationResult, DocumentoStatus
from app.services.providers.base import DocumentClassifier

logger = logging.getLogger(__name__)


def get_classifier() -> DocumentClassifier:
    provider = settings.classifier_provider.lower()
    if provider == "openai":
        from app.services.providers.openai_provider import OpenAIProvider
        return OpenAIProvider()
    if provider == "gemini":
        from app.services.providers.gemini_provider import GeminiProvider
        return GeminiProvider()
    from app.services.providers.claude_provider import ClaudeProvider
    return ClaudeProvider()


async def classify_document(text: str, filename: str) -> tuple[ClassificationResult, DocumentoStatus]:
    """Classify a document and determine its status based on confidence threshold."""
    classifier = get_classifier()
    try:
        result = await classifier.classify(text=text, filename=filename)
    except Exception as exc:
        logger.error("Erro no classificador para '%s': %s", filename, exc)
        return ClassificationResult(confidence=0.0, raw_response=str(exc)), DocumentoStatus.nao_reconhecido

    threshold = settings.classifier_confidence_threshold
    if result.confidence >= threshold and result.doc_type:
        status = DocumentoStatus.classificado
    else:
        status = DocumentoStatus.nao_reconhecido
        logger.info(
            "Documento '%s' com confiança %.2f abaixo do limiar %.2f → fila de revisão",
            filename, result.confidence, threshold,
        )

    return result, status
