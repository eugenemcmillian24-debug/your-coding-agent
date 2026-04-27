import json
import logging
import uuid
from datetime import datetime, timezone
from io import BytesIO

from fpdf import FPDF

from .db import get_conn
from .provider_router import generate_text

logger = logging.getLogger("forge_agent.invoice")

INVOICE_SYSTEM_PROMPT = """You are an invoice data structuring assistant.
Given raw client/project information, return ONLY a valid JSON object (no markdown
fences, no explanation) with exactly these keys:

{
  "invoice_number": "<generate a unique invoice number like INV-YYYYMMDD-XXXX>",
  "date": "<today's date in YYYY-MM-DD>",
  "due_date": "<due date in YYYY-MM-DD, use the one provided or default 30 days>",
  "from_name": "<business/freelancer name>",
  "from_address": "<business address or empty string>",
  "from_email": "<business email or empty string>",
  "to_name": "<client name>",
  "to_address": "<client address or empty string>",
  "to_email": "<client email or empty string>",
  "line_items": [
    {"description": "<service/product>", "quantity": <number>, "unit_price": <number>}
  ],
  "notes": "<any notes, payment terms, or thank-you message>",
  "currency": "USD"
}

Rules:
- Parse the user's free-form text intelligently
- If line items are described in prose, extract them into structured items
- Calculate nothing — the backend handles totals
- Always return valid JSON, nothing else"""


def _parse_ai_response(raw: str) -> dict:
    """Extract JSON from AI response, stripping markdown fences if present."""
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)
    return json.loads(text)


class InvoicePDF(FPDF):
    """Professional invoice PDF generator."""

    def header(self):
        self.set_font("Helvetica", "B", 24)
        self.set_text_color(30, 41, 59)
        self.cell(0, 15, "INVOICE", align="R", new_x="LMARGIN", new_y="NEXT")
        self.ln(4)

    def footer(self):
        self.set_y(-20)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(148, 163, 184)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")


def _generate_pdf(data: dict) -> bytes:
    """Generate a professional PDF invoice from structured data."""
    pdf = InvoicePDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=25)
    pdf.add_page()

    # Invoice metadata (top right)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 6, f"Invoice #: {data.get('invoice_number', 'N/A')}", align="R",
             new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Date: {data.get('date', 'N/A')}", align="R",
             new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Due: {data.get('due_date', 'N/A')}", align="R",
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)

    # From section
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(95, 6, "From:", new_x="RIGHT", new_y="TOP")
    pdf.cell(95, 6, "Bill To:", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "", 10)
    from_lines = [
        data.get("from_name", ""),
        data.get("from_address", ""),
        data.get("from_email", ""),
    ]
    to_lines = [
        data.get("to_name", ""),
        data.get("to_address", ""),
        data.get("to_email", ""),
    ]

    for i in range(max(len(from_lines), len(to_lines))):
        fl = from_lines[i] if i < len(from_lines) else ""
        tl = to_lines[i] if i < len(to_lines) else ""
        if fl or tl:
            pdf.cell(95, 5, fl, new_x="RIGHT", new_y="TOP")
            pdf.cell(95, 5, tl, new_x="LMARGIN", new_y="NEXT")

    pdf.ln(10)

    # Table header
    col_widths = [90, 25, 35, 40]
    headers = ["Description", "Qty", "Unit Price", "Amount"]

    pdf.set_fill_color(30, 41, 59)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 10)
    for i, h in enumerate(headers):
        align = "L" if i == 0 else "R"
        pdf.cell(col_widths[i], 8, h, fill=True, align=align,
                 new_x="RIGHT", new_y="TOP")
    pdf.ln()

    # Table rows
    pdf.set_text_color(30, 41, 59)
    pdf.set_font("Helvetica", "", 10)
    currency = data.get("currency", "USD")
    symbol = "$" if currency == "USD" else currency + " "
    subtotal = 0.0
    items = data.get("line_items", [])

    for idx, item in enumerate(items):
        desc = item.get("description", "")
        qty = item.get("quantity", 1)
        price = item.get("unit_price", 0)
        amount = qty * price
        subtotal += amount

        bg = idx % 2 == 1
        if bg:
            pdf.set_fill_color(241, 245, 249)

        pdf.cell(col_widths[0], 7, desc, fill=bg, new_x="RIGHT", new_y="TOP")
        pdf.cell(col_widths[1], 7, str(qty), fill=bg, align="R",
                 new_x="RIGHT", new_y="TOP")
        pdf.cell(col_widths[2], 7, f"{symbol}{price:,.2f}", fill=bg, align="R",
                 new_x="RIGHT", new_y="TOP")
        pdf.cell(col_widths[3], 7, f"{symbol}{amount:,.2f}", fill=bg, align="R",
                 new_x="LMARGIN", new_y="NEXT")

    # Totals
    pdf.ln(4)
    total_label_x = col_widths[0] + col_widths[1]
    total_val_x = col_widths[2] + col_widths[3]

    pdf.set_font("Helvetica", "", 10)
    pdf.cell(total_label_x, 7, "", new_x="RIGHT", new_y="TOP")
    pdf.cell(col_widths[2], 7, "Subtotal:", align="R", new_x="RIGHT", new_y="TOP")
    pdf.cell(col_widths[3], 7, f"{symbol}{subtotal:,.2f}", align="R",
             new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(total_label_x, 9, "", new_x="RIGHT", new_y="TOP")
    pdf.cell(col_widths[2], 9, "Total:", align="R", new_x="RIGHT", new_y="TOP")
    pdf.cell(col_widths[3], 9, f"{symbol}{subtotal:,.2f}", align="R",
             new_x="LMARGIN", new_y="NEXT")

    # Notes
    notes = data.get("notes", "")
    if notes:
        pdf.ln(12)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(30, 41, 59)
        pdf.cell(0, 6, "Notes:", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(100, 116, 139)
        pdf.multi_cell(0, 5, notes)

    buf = BytesIO()
    pdf.output(buf)
    return buf.getvalue()


async def generate_invoice(
    user_email: str,
    raw_input: str,
    model_id: str | None = None,
) -> tuple[str, dict, bytes]:
    """Generate an invoice: AI structuring + PDF creation + DB record.

    Returns (invoice_id, invoice_data, pdf_bytes).
    """
    ai_response = await generate_text(
        system_prompt=INVOICE_SYSTEM_PROMPT,
        user_prompt=raw_input,
        model_override=model_id,
    )

    invoice_data = _parse_ai_response(ai_response)
    pdf_bytes = _generate_pdf(invoice_data)

    invoice_id = str(uuid.uuid4())
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO invoice_generations (id, user_email, invoice_data, pdf_bytes, created_at)
               VALUES (%s, %s, %s, %s, %s)""",
            (invoice_id, user_email, json.dumps(invoice_data), pdf_bytes, datetime.now(timezone.utc).isoformat()),
        )

    logger.info("Invoice %s generated for %s (%d bytes)", invoice_id, user_email, len(pdf_bytes))
    return invoice_id, invoice_data, pdf_bytes


def get_credits_used_this_month(email: str) -> int:
    """Count invoice generations this month for a user."""
    with get_conn() as conn:
        row = conn.execute(
            """SELECT COUNT(*) as cnt FROM invoice_generations
               WHERE user_email = %s AND created_at >= date_trunc('month', NOW())""",
            (email,),
        ).fetchone()
    return dict(row)["cnt"] if row else 0
