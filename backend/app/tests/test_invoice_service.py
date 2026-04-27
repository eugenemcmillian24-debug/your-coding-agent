import json
import pytest
from app.services.invoice_service import _parse_ai_response, _generate_pdf


SAMPLE_INVOICE_DATA = {
    "invoice_number": "INV-20260427-0001",
    "date": "2026-04-27",
    "due_date": "2026-05-27",
    "from_name": "Acme Corp",
    "from_address": "123 Main St, Springfield, IL 62701",
    "from_email": "billing@acme.com",
    "to_name": "Client LLC",
    "to_address": "456 Oak Ave, Chicago, IL 60601",
    "to_email": "accounts@client.com",
    "line_items": [
        {"description": "Web Design", "quantity": 1, "unit_price": 2500.00},
        {"description": "Development (40 hrs)", "quantity": 40, "unit_price": 150.00},
        {"description": "Hosting Setup", "quantity": 1, "unit_price": 200.00},
    ],
    "notes": "Payment due within 30 days. Thank you for your business!",
    "currency": "USD",
}


def test_parse_ai_response_plain_json():
    raw = json.dumps(SAMPLE_INVOICE_DATA)
    result = _parse_ai_response(raw)
    assert result["invoice_number"] == "INV-20260427-0001"
    assert len(result["line_items"]) == 3


def test_parse_ai_response_markdown_fenced():
    raw = "```json\n" + json.dumps(SAMPLE_INVOICE_DATA) + "\n```"
    result = _parse_ai_response(raw)
    assert result["to_name"] == "Client LLC"


def test_generate_pdf_returns_bytes():
    pdf_bytes = _generate_pdf(SAMPLE_INVOICE_DATA)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 100
    assert pdf_bytes[:5] == b"%PDF-"


def test_generate_pdf_with_empty_items():
    data = {**SAMPLE_INVOICE_DATA, "line_items": []}
    pdf_bytes = _generate_pdf(data)
    assert pdf_bytes[:5] == b"%PDF-"


def test_generate_pdf_with_many_items():
    items = [{"description": f"Item {i}", "quantity": i, "unit_price": 10.0 * i} for i in range(1, 21)]
    data = {**SAMPLE_INVOICE_DATA, "line_items": items}
    pdf_bytes = _generate_pdf(data)
    assert pdf_bytes[:5] == b"%PDF-"
    assert len(pdf_bytes) > 500
