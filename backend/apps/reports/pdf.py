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


def build_export_pdf(user, start, end, activity) -> bytes:
    """Export pour le comptable en PDF (s'ouvre partout, iPhone compris) :
    compte de résultat de la période puis la liste des opérations."""
    from xml.sax.saxutils import escape

    from reportlab.lib.pagesizes import landscape

    from apps.finance.models import Transaction

    from . import services
    from .export import SUMMARY_ROWS, transactions_for

    buf = io.BytesIO()
    page = landscape(A4)
    title = activity.name if activity else "Toutes les activités"

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(15 * mm, 9 * mm, f"Bénef · {title} · du {start:%d/%m/%Y} au {end:%d/%m/%Y}")
        canvas.drawRightString(page[0] - 15 * mm, 9 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(
        buf, pagesize=page, title=f"Bénef — {title}",
        topMargin=15 * mm, bottomMargin=16 * mm, leftMargin=15 * mm, rightMargin=15 * mm,
    )
    brand = ParagraphStyle("brand", fontSize=10.5, leading=14, textColor=INDIGO, fontName="Helvetica-Bold")
    h1 = ParagraphStyle("h1", fontSize=17, leading=22, textColor=TEXT, fontName="Helvetica-Bold", spaceBefore=2)
    sub = ParagraphStyle("sub", fontSize=10, leading=14, textColor=MUTED, fontName="Helvetica")
    section = ParagraphStyle("section", fontSize=11.5, textColor=TEXT, fontName="Helvetica-Bold", spaceBefore=12, spaceAfter=6)
    cell = ParagraphStyle("cell", fontSize=8.5, leading=10.5, textColor=TEXT, fontName="Helvetica")
    cell_muted = ParagraphStyle("cellm", parent=cell, textColor=MUTED)

    summary = services.range_summary(user, start, end, activity).as_dict()
    currency = summary["currency"]
    elements = [
        Paragraph("Bénef", brand),
        Paragraph(f"Export pour le comptable — {escape(title)}", h1),
        Paragraph(f"Du {start:%d/%m/%Y} au {end:%d/%m/%Y} · montants en {currency}", sub),
        Paragraph("Compte de résultat", section),
    ]
    rows = [[label, _fmt(summary[key], currency)] for label, key in SUMMARY_ROWS]
    net_index = [key for _, key in SUMMARY_ROWS].index("net_profit")
    table = Table(
        [[Paragraph(escape(label), cell), amount] for label, amount in rows],
        colWidths=[150 * mm, 50 * mm], hAlign="LEFT",
    )
    table.setStyle(TableStyle([
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (1, 0), (1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#e6e6e3")),
        ("FONTNAME", (1, net_index), (1, net_index), "Helvetica-Bold"),
        ("BACKGROUND", (0, net_index), (-1, net_index), colors.HexColor("#eef0ff")),
    ]))
    elements.append(table)

    # Montants dans une seule devise : celle de l'activité, ou la devise
    # principale pour « toutes les activités ».
    use_activity_currency = activity is not None
    ops_currency = activity.currency_id if activity else user.base_currency_id
    head = ["Date", "Activité", "Opération", "Catégorie / tiers", "Paiement", "Note", f"Montant ({ops_currency})"]
    data = [head]
    voided_rows = []
    total_in = total_out = Decimal("0")
    for txn in transactions_for(user, start, end, activity).iterator(chunk_size=2000):
        value = txn.amount_activity if use_activity_currency else txn.amount_base
        incoming = txn.direction == Transaction.Direction.IN
        if txn.is_voided:
            voided_rows.append(len(data))
        elif incoming:
            total_in += value
        else:
            total_out += value
        kind = escape(txn.get_kind_display()) + (" · à crédit" if txn.is_credit else "")
        if txn.is_voided:
            kind += " · <b>annulée</b>"
        who = " · ".join(escape(x) for x in (txn.category.name if txn.category else "", txn.party.name if txn.party else "") if x)
        note = escape(txn.note or "")
        if txn.currency_id != ops_currency:
            note = (note + " " if note else "") + f"(saisi : {_fmt(txn.amount, txn.currency_id)})"
        data.append([
            txn.occurred_on.strftime("%d/%m/%Y"),
            Paragraph(escape(txn.activity.name), cell),
            Paragraph(kind, cell),
            Paragraph(who, cell),
            Paragraph(escape(txn.payment_method.name) if txn.payment_method else "", cell),
            Paragraph(note, cell_muted),
            _fmt(value if incoming else -value, ops_currency),
        ])

    elements.append(Paragraph(f"Opérations ({len(data) - 1})", section))
    elements.append(Paragraph(
        f"Entrées : <b>{_fmt(total_in, ops_currency)}</b> · Sorties : <b>{_fmt(-total_out, ops_currency)}</b>"
        " · les opérations annulées sont listées mais ne comptent pas.", sub,
    ))
    elements.append(Spacer(1, 6))
    if len(data) == 1:
        elements.append(Paragraph("Aucune opération sur cette période.", sub))
    else:
        ops = Table(data, colWidths=[20 * mm, 36 * mm, 38 * mm, 48 * mm, 30 * mm, 64 * mm, 31 * mm], repeatRows=1)
        style = [
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("BACKGROUND", (0, 0), (-1, 0), INDIGO),
            ("ALIGN", (-1, 0), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f6f6fb")]),
            ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#e6e6e3")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]
        for r in voided_rows:
            style.append(("TEXTCOLOR", (0, r), (-1, r), MUTED))
        ops.setStyle(TableStyle(style))
        elements.append(ops)

    doc.build(elements, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()
