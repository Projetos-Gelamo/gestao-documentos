import logging
from pathlib import Path

import google.generativeai as genai

from app.core.config import settings
from app.models.schemas import ClassificationResult
from app.services.providers.base import DocumentClassifier
from app.services.providers.claude_provider import _parse_result

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "classify_document.txt"


def _load_prompt(filename: str, text: str) -> str:
    template = _PROMPT_PATH.read_text(encoding="utf-8")
    return template.replace("{{filename}}", filename).replace("{{text}}", text)


class GeminiProvider(DocumentClassifier):
    def __init__(self):
        genai.configure(api_key=settings.gemini_api_key)
        self._model = genai.GenerativeModel("gemini-1.5-flash")

    async def classify(self, text: str, filename: str) -> ClassificationResult:
        prompt = _load_prompt(filename, text)
        response = await self._model.generate_content_async(prompt)
        raw = (response.text or "").strip()
        return _parse_result(raw)
