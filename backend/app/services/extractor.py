import io
import logging
import re

logger = logging.getLogger(__name__)

MAX_CHARS = 4000


def extract_text(file_bytes: bytes, filename: str) -> str:
    """Extract text from various file formats for document classification."""
    lower = filename.lower()

    if lower.endswith(".pdf"):
        text = _extract_pdf(file_bytes)
        if text.strip():
            return text[:MAX_CHARS]
        logger.info("pdfplumber retornou vazio para '%s', tentando OCR", filename)
        return _extract_ocr(file_bytes, is_pdf=True)[:MAX_CHARS]

    if lower.endswith((".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp")):
        return _extract_ocr(file_bytes, is_pdf=False)[:MAX_CHARS]

    if lower.endswith(".ofx") or lower.endswith(".ofc"):
        return _extract_ofx(file_bytes)[:MAX_CHARS]

    if lower.endswith((".xlsx", ".xls")):
        return _extract_excel(file_bytes)[:MAX_CHARS]

    if lower.endswith((".txt", ".xml", ".csv", ".json", ".html", ".htm")):
        return file_bytes.decode("utf-8", errors="replace")[:MAX_CHARS]

    # Tenta decodificar como texto genérico
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
    try:
        from pdf2image import convert_from_bytes  # type: ignore
        return convert_from_bytes(file_bytes, dpi=200)
    except ImportError:
        logger.warning("pdf2image não instalado; OCR em PDF não disponível")
        return []


def _extract_ofx(file_bytes: bytes) -> str:
    text = file_bytes.decode("utf-8", errors="replace")
    # Localiza início do conteúdo OFX
    idx = text.upper().find("<OFX>")
    if idx >= 0:
        text = text[idx:]
    # Remove tags SGML/XML, mantém valores
    cleaned = re.sub(r"<[^>]+>", " ", text)
    return " ".join(cleaned.split())


def _extract_excel(file_bytes: bytes) -> str:
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        parts: list[str] = []
        for sheet in wb.worksheets:
            for row in sheet.iter_rows(values_only=True):
                values = [str(v) for v in row if v is not None]
                if values:
                    parts.append(" | ".join(values))
        return "\n".join(parts)
    except Exception as exc:
        logger.warning("Erro ao ler Excel: %s", exc)
        return ""
