import io
import logging
import re

logger = logging.getLogger(__name__)

MAX_CHARS = 4000


def extract_text(file_bytes: bytes, filename: str) -> str:
    """Extract text from various file formats for document classification.

    Returns empty string for images and scanned PDFs — caller should use
    vision-based classification when this returns empty.
    """
    lower = filename.lower()

    if lower.endswith(".pdf"):
        text = _extract_pdf(file_bytes)
        if text.strip():
            return text[:MAX_CHARS]
        # Scanned PDF: pdfplumber returned nothing, vision will handle
        return ""

    if lower.endswith((".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp")):
        # Images are handled via vision API — no local OCR
        return ""

    if lower.endswith(".ofx") or lower.endswith(".ofc"):
        return _extract_ofx(file_bytes)[:MAX_CHARS]

    if lower.endswith((".xlsx", ".xls")):
        return _extract_excel(file_bytes)[:MAX_CHARS]

    if lower.endswith((".txt", ".xml", ".csv", ".json", ".html", ".htm")):
        return file_bytes.decode("utf-8", errors="replace")[:MAX_CHARS]

    try:
        decoded = file_bytes.decode("utf-8", errors="strict")
        if decoded.strip():
            return decoded[:MAX_CHARS]
    except UnicodeDecodeError:
        pass

    return ""


def needs_vision(text: str, filename: str) -> bool:
    """Returns True when the file should be classified via vision (not text)."""
    lower = filename.lower()
    is_image = lower.endswith((".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"))
    is_scanned_pdf = lower.endswith(".pdf") and not text.strip()
    return is_image or is_scanned_pdf


def get_image_bytes_for_vision(file_bytes: bytes, filename: str) -> tuple[bytes, str]:
    """Returns (bytes_to_send, media_type) ready for Anthropic Vision API.

    Converts TIFF/BMP to PNG since Anthropic only supports JPEG/PNG/GIF/WebP.
    PDFs are returned as-is with application/pdf media type.
    """
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return file_bytes, "application/pdf"
    if lower.endswith(".png"):
        return file_bytes, "image/png"
    if lower.endswith((".jpg", ".jpeg")):
        return file_bytes, "image/jpeg"
    if lower.endswith(".webp"):
        return file_bytes, "image/webp"
    if lower.endswith(".gif"):
        return file_bytes, "image/gif"
    # TIFF and BMP: convert to PNG via Pillow
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(file_bytes))
        buf = io.BytesIO()
        img.convert("RGB").save(buf, format="PNG")
        return buf.getvalue(), "image/png"
    except Exception as exc:
        logger.warning("Falha ao converter imagem para PNG: %s", exc)
        return file_bytes, "image/png"


def _extract_pdf(file_bytes: bytes) -> str:
    import pdfplumber

    text_parts: list[str] = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            text_parts.append(page_text)
    return "\n".join(text_parts)


def _extract_ofx(file_bytes: bytes) -> str:
    text = file_bytes.decode("utf-8", errors="replace")
    idx = text.upper().find("<OFX>")
    if idx >= 0:
        text = text[idx:]
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
