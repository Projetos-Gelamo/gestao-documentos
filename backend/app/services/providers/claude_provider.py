import base64
import json
import logging
from pathlib import Path

import anthropic

from app.core.config import settings
from app.models.schemas import ClassificationResult
from app.services.providers.base import DocumentClassifier

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "classify_document.txt"
_VISION_TEXT = "[Documento enviado como imagem/PDF acima — analise visualmente]"


def _load_prompt(filename: str, text: str) -> str:
    template = _PROMPT_PATH.read_text(encoding="utf-8")
    return template.replace("{{filename}}", filename).replace("{{text}}", text)


class ClaudeProvider(DocumentClassifier):
    def __init__(self):
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def classify(self, text: str, filename: str, file_bytes: bytes | None = None) -> ClassificationResult:
        from app.services.extractor import needs_vision, get_image_bytes_for_vision

        if file_bytes is not None and needs_vision(text, filename):
            logger.info("CLASSIFY_VISION '%s'", filename)
            return await self._classify_vision(file_bytes, filename)

        logger.warning("CLASSIFY_DEBUG '%s': text_len=%d preview=%r", filename, len(text), text[:80])
        prompt = _load_prompt(filename, text)
        message = await self._client.messages.create(
            model="claude-haiku-5-5",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        text_block = next((b for b in message.content if b.type == "text"), None)
        raw = text_block.text.strip() if text_block else ""
        return _parse_result(raw)

    async def _classify_vision(self, file_bytes: bytes, filename: str) -> ClassificationResult:
        from app.services.extractor import get_image_bytes_for_vision

        img_bytes, media_type = get_image_bytes_for_vision(file_bytes, filename)
        encoded = base64.b64encode(img_bytes).decode()
        prompt_text = _load_prompt(filename, _VISION_TEXT)

        is_pdf = media_type == "application/pdf"
        doc_block: dict = {
            "type": "document" if is_pdf else "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": encoded,
            },
        }

        message = await self._client.messages.create(
            model="claude-haiku-5-5",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [doc_block, {"type": "text", "text": prompt_text}],
            }],
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
            banco=data.get("banco"),
            conta=data.get("conta"),
            confidence=float(data.get("confidence", 0.0)),
            raw_response=raw,
        )
    except Exception:
        logger.warning("Falha ao parsear resposta do classificador: %s", raw)
        return ClassificationResult(confidence=0.0, raw_response=raw)
