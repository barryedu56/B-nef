"""Génère le compte de résultat en vrai PDF (fichier téléchargeable), pas une
impression de navigateur — même contenu que le rapport affiché à l'écran
(`ReportsPage.tsx`), construit avec reportlab (pas de dépendance système,
contrairement à WeasyPrint/wkhtmltopdf — important sur Windows/WAMP).
"""
from __future__ import annotations

import io
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Spacer, Table, TableStyle, Paragraph
from reportlab.lib.styles import ParagraphStyle

INDIGO = colors.HexColor("#4f46e5")
TEXT = colors.HexColor("#1c1c1a")
MUTED = colors.HexColor("#6f6f68")


def _fmt(amount: str | Decimal, currency: str) -> str:
    n = Decimal(amount)
    sign = "-" if n < 0 else ""
    n = abs(n)
    if n == n.to_integral_value():
        s = f"{int(n):,}".replace(",", " ")
    else:
        s = f"{n:,.2f}".replace(",", " ").replace(".", ",")
    return f"{sign}{s} {currency}"


def build_report_pdf(*, title: str, subtitle: str, data: dict) -> bytes:
    """`data` : le même dict que renvoient les endpoints JSON de rapport
    (`revenue`, `cogs`, `gross_margin`, `expenses`, `net_profit`,
    `cash_balance`, `stock_value`, `receivable`, `payable`, `personal_use`,
    `currency`)."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=22 * mm, bottomMargin=20 * mm, leftMargin=20 * mm, rightMargin=20 * mm,
    )
    currency = data["currency"]

    title_style = ParagraphStyle("title", fontSize=18, leading=24, textColor=TEXT, fontName="Helvetica-Bold", spaceAfter=6)
    brand_style = ParagraphStyle("brand", fontSize=10.5, leading=14, textColor=INDIGO, fontName="Helvetica-Bold", spaceAfter=8)
    subtitle_style = ParagraphStyle("subtitle", fontSize=10.5, leading=14, textColor=MUTED, fontName="Helvetica")
    section_style = ParagraphStyle("section", fontSize=11, textColor=TEXT, fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=6)

    elements = [
        Paragraph("Bénef", brand_style),
        Paragraph(title, title_style),
        Paragraph(subtitle, subtitle_style),
        Spacer(1, 14),
    ]

    def money_row(label, value, bold=False, negative_hint=False):
        v = Decimal(value)
        display = _fmt(-v if negative_hint and v > 0 else v, currency) if negative_hint else _fmt(v, currency)
        return [label, display]

    rows = [
        money_row("Chiffre d'affaires", data["revenue"], bold=True),
        money_row("Coût des marchandises vendues", data["cogs"], negative_hint=True),
        money_row("Marge brute", data["gross_margin"], bold=True),
        money_row("Charges d'exploitation", data["expenses"], negative_hint=True),
        money_row("Bénéfice net", data["net_profit"], bold=True),
    ]
    table = Table(rows, colWidths=[110 * mm, 50 * mm])
    style = [
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10.5),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TEXTCOLOR", (0, 0), (-1, -1), TEXT),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 2), (-1, 2), 1, TEXT),  # sous Marge brute
        ("LINEABOVE", (0, 4), (-1, 4), 1.4, TEXT),  # au-dessus Bénéfice net
        ("LINEBELOW", (0, 4), (-1, 4), 1.4, TEXT),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 2), (-1, 2), "Helvetica-Bold"),
        ("FONTNAME", (0, 4), (-1, 4), "Helvetica-Bold"),
        ("FONTSIZE", (0, 4), (-1, 4), 12.5),
        ("TEXTCOLOR", (0, 1), (-1, 1), MUTED),
        ("TEXTCOLOR", (0, 3), (-1, 3), MUTED),
    ]
    table.setStyle(TableStyle(style))
    elements.append(table)

    revenue = Decimal(data["revenue"])
    net_profit = Decimal(data["net_profit"])
    margin_pct = (net_profit / revenue * 100) if revenue else Decimal("0")
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(f"Marge nette : <b>{margin_pct:.0f}&nbsp;%</b>", subtitle_style))

    elements.append(Paragraph("Indicateurs", section_style))
    indicator_rows = [
        ["Trésorerie", _fmt(data["cash_balance"], currency)],
        ["Valeur du stock", _fmt(data["stock_value"], currency)],
        ["Créances en cours", _fmt(data["receivable"], currency)],
        ["Dettes en cours", _fmt(data["payable"], currency)],
    ]
    if Decimal(data.get("personal_use", 0)) > 0:
        indicator_rows.append(["Consommé personnellement", _fmt(data["personal_use"], currency)])
    ind_table = Table(indicator_rows, colWidths=[110 * mm, 50 * mm])
    ind_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TEXTCOLOR", (0, 0), (-1, -1), TEXT),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.HexColor("#e6e6e3")),
    ]))
    elements.append(ind_table)

    doc.build(elements)
    return buf.getvalue()
