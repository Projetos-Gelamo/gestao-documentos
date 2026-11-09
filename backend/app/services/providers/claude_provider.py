import json
import logging
from pathlib import Path

import anthropic

from app.core.config import settings
from app.models.schemas import ClassificationResult
from app.services.providers.base import DocumentClassifier

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "classify_document.txt"


def _load_prompt(filename: str, text: str) -> str:
    template = _PROMPT_PATH.read_text(encoding="utf-8")
    return template.replace("{{filename}}", filename).replace("{{text}}", text)


class ClaudeProvider(DocumentClassifier):
    def __init__(self):
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def classify(self, text: str, filename: str) -> ClassificationResult:
        logger.warning("CLASSIFY_DEBUG '%s': text_len=%d preview=%r", filename, len(text), text[:80])
        prompt = _load_prompt(filename, text)
        message = await self._client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        return _parse_result(raw)


def _parse_result(raw: str) -> ClassificationResult:
    try:
        data = json.loads(raw)
        return ClassificationResult(
            doc_type=data.get("doc_type"),
            mes_referencia=data.get("mes_referencia"),
            cnpj=data.get("cnpj"),
            confidence=float(data.get("confidence", 0.0)),
            raw_response=raw,
        )
    except Exception:
        logger.warning("Falha ao parsear resposta do classificador: %s", raw)
        return ClassificationResult(confidence=0.0, raw_response=raw)
