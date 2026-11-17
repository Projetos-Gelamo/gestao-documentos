from abc import ABC, abstractmethod

from app.models.schemas import ClassificationResult


class DocumentClassifier(ABC):
    @abstractmethod
    async def classify(self, text: str, filename: str, file_bytes: bytes | None = None) -> ClassificationResult:
        """Classify a document and return structured result.

        file_bytes: raw file content, used for vision-based classification when
        text is empty (images and scanned PDFs).
        """
        ...
