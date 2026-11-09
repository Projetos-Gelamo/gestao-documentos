import io
import logging

logger = logging.getLogger(__name__)

MAX_CHARS = 4000


def extract_text(file_bytes: bytes, filename: str) -> str:
    """Extract text from PDF or image bytes. Tries pdfplumber first, falls back to OCR."""
    lower = filename.lower()

    if lower.endswith(".pdf"):
        text = _extract_pdf(file_bytes)
        if text.strip():
            return text[:MAX_CHARS]
        logger.info("pdfplumber retornou vazio para '%s', tentando OCR", filename)
        return _extract_ocr(file_bytes, is_pdf=True)[:MAX_CHARS]

    if lower.endswith((".png", ".jpg", ".jpeg", ".tiff", ".bmp")):
        return _extract_ocr(file_bytes, is_pdf=False)[:MAX_CHARS]

    if lower.endswith((".txt", ".xml", ".csv", ".json", ".html", ".htm")):
        return file_bytes.decode("utf-8", errors="replace")[:MAX_CHARS]

    # Tenta decodificar como texto genérico (Google Docs exportados, etc.)
    try:
        decoded = file_bytes.decode("utf-8", errors="strict")
        if decoded.strip():
            return decoded[:MAX_CHARS]
    except UnicodeDecodeError:
        pass

    return ""


def _extract_pdf(file_bytes: bytes) -> str:
    import pdfplumber

    text_parts: list[str] = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            text_parts.append(page_text)
    return "\n".join(text_parts)


def _extract_ocr(file_bytes: bytes, *, is_pdf: bool) -> str:
    import pytesseract
    from PIL import Image

    if is_pdf:
        images = _pdf_to_images(file_bytes)
    else:
        images = [Image.open(io.BytesIO(file_bytes))]

    parts: list[str] = []
    for img in images:
        parts.append(pytesseract.image_to_string(img, lang="por+eng"))
    return "\n".join(parts)


def _pdf_to_images(file_bytes: bytes):
    # pdf2image is optional; fall back gracefully when not installed
    try:
        from pdf2image import convert_from_bytes  # type: ignore

        return convert_from_bytes(file_bytes, dpi=200)
    except ImportError:
        logger.warning("pdf2image não instalado; OCR em PDF não disponível")
        return []
