import pytest
from unittest.mock import MagicMock, patch


def test_extract_text_pdf_pdfplumber():
    sample_text = "Extrato Bancário\nEmpresa: ACME Ltda\nCNPJ: 12.345.678/0001-95"
    with patch("app.services.extractor._extract_pdf", return_value=sample_text):
        from app.services.extractor import extract_text
        result = extract_text(b"%PDF-1.4 fake", "extrato.pdf")

    assert "CNPJ" in result
    assert len(result) <= 4000


def test_extract_text_pdf_fallback_to_ocr():
    with (
        patch("app.services.extractor._extract_pdf", return_value=""),
        patch("app.services.extractor._extract_ocr", return_value="texto via ocr"),
    ):
        from app.services.extractor import extract_text
        result = extract_text(b"scanned pdf bytes", "scanned.pdf")

    assert result == "texto via ocr"


def test_extract_text_unsupported_format_returns_empty():
    from app.services.extractor import extract_text
    result = extract_text(b"some bytes", "arquivo.xlsx")
    assert result == ""


def test_extract_text_truncates_to_4000_chars():
    long_text = "a" * 10000
    with patch("app.services.extractor._extract_pdf", return_value=long_text):
        from app.services.extractor import extract_text
        result = extract_text(b"%PDF", "big.pdf")

    assert len(result) == 4000
