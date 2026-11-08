from abc import ABC, abstractmethod

from app.models.schemas import ClassificationResult


class DocumentClassifier(ABC):
    @abstractmethod
    async def classify(self, text: str, filename: str) -> ClassificationResult:
        """Classify a document and return structured result."""
        ...
