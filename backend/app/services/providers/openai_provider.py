import json
import logging
from pathlib import Path

from openai import AsyncOpenAI

from app.core.config import settings
from app.models.schemas import ClassificationResult
from app.services.providers.base import DocumentClassifier
from app.services.providers.claude_provider import _parse_result

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "classify_document.txt"


def _load_prompt(filename: str, text: str) -> str:
    template = _PROMPT_PATH.read_text(encoding="utf-8")
    return template.replace("{{filename}}", filename).replace("{{text}}", text)


class OpenAIProvider(DocumentClassifier):
    def __init__(self):
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def classify(self, text: str, filename: str) -> ClassificationResult:
        prompt = _load_prompt(filename, text)
        response = await self._client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = (response.choices[0].message.content or "").strip()
        return _parse_result(raw)
