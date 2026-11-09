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
            model="claude-haiku-5-5",
            max_tokens=8192,
            messages=[{"role": "user", "content": prompt}],
        )
        text_block = next((b for b in message.content if b.type == "text"), None)
        raw = text_block.text.strip() if text_block else ""
        return _parse_result(raw)


def _parse_result(raw: str) -> ClassificationResult:
    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            inner = [l for l in lines if not l.startswith("```")]
            cleaned = "\n".join(inner).strip()
        data = json.loads(cleaned)
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
