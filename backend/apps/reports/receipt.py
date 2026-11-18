"""Reçu de vente, en PDF (ticket 80 mm) ou en image PNG, à partager au client
(WhatsApp…). Les deux rendus partent des mêmes lignes de texte."""

from __future__ import annotations

import io
import os
from dataclasses import dataclass, field
from decimal import Decimal

import reportlab
from django.utils import timezone
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from .pdf import _fmt

FONT_DIR = os.path.join(os.path.dirname(reportlab.__file__), "fonts")
FONT = os.path.join(FONT_DIR, "Vera.ttf")
FONT_BOLD = os.path.join(FONT_DIR, "VeraBd.ttf")

ACCENT = (194, 65, 12)
TEXT = (43, 29, 18)
MUTED = (107, 84, 66)
NEGATIVE = (185, 28, 28)

# Symboles courts comme dans l'app (« 350 000 FG »).
SYMBOLS = {"GNF": "FG", "XOF": "FCFA"}


def _money(amount, currency: str) -> str:
    return _fmt(amount, SYMBOLS.get(currency, currency))


def _qty(value: Decimal) -> str:
    value = Decimal(value).normalize()
    return f"{value:f}".replace(".", ",")


@dataclass
class Receipt:
    shop: str
    contact: str
    number: str
    when: str
    lines: list[tuple[str, str, str]]  # (produit, « 2 × 350 000 FG », total)
    total: str
    extras: list[tuple[str, str]] = field(default_factory=list)  # (libellé, valeur)
    voided: bool = False


def receipt_for(txn) -> Receipt:
    currency = txn.activity.currency_id
    created = timezone.localtime(txn.created_at)
    lines = []
    for line in txn.sale_lines.select_related("product").all():
        detail = f"{_qty(line.quantity)} × {_money(line.unit_price, currency)}"
        if line.discount:
            detail += f" − {_money(line.discount, currency)}"
        lines.append((line.product.name, detail, _money(line.line_total, currency)))
    extras = []
    if txn.payment_method_id and not txn.is_credit:
        extras.append(("Payé par", txn.payment_method.name))
    if txn.party_id:
        client = txn.party.name + (f" · {txn.party.phone}" if txn.party.phone else "")
        extras.append(("Client", client))
    if txn.is_credit:
        extras.append(("Déjà payé", _money(txn.settled_amount, txn.currency_id)))
        extras.append(("Reste à payer", _money(txn.remaining_amount, txn.currency_id)))
    owner = txn.activity.owner
    return Receipt(
        shop=txn.activity.name,
        contact=owner.phone or "",
        number=f"N° {txn.pk}",
        when=f"{txn.occurred_on:%d/%m/%Y} · {created:%H:%M}",
        lines=lines,
        total=_money(txn.amount_activity, currency),
        extras=extras,
        voided=txn.is_voided,
    )


# --- PDF ---------------------------------------------------------------------

_fonts_ready = False


def _register_fonts():
    global _fonts_ready
    if not _fonts_ready:
        pdfmetrics.registerFont(TTFont("Vera", FONT))
        pdfmetrics.registerFont(TTFont("Vera-Bold", FONT_BOLD))
        _fonts_ready = True


def build_receipt_pdf(r: Receipt) -> bytes:
    _register_fonts()
    width = 80 * mm
    margin = 5 * mm
    # Mise en page en deux temps : la liste des lignes (avec l'espace qui suit
    # chacune), puis la hauteur exacte du ticket — pas de blanc en bas.
    ops = []  # (sorte, arguments, espace après en mm)

    def text(s, size=9, bold=False, color=TEXT, align="left", gap=5.0, right=None):
        ops.append(("text", (s, size, bold, color, align, right), gap))

    def rule():
        ops.append(("rule", (), 4.5))

    text(r.shop, 13, bold=True, color=ACCENT, align="center", gap=5.5)
    if r.contact:
        text(r.contact, 8, color=MUTED, align="center", gap=4.5)
    text(f"Reçu de vente {r.number}", 8, color=MUTED, align="center", gap=4.5)
    text(r.when, 8, color=MUTED, align="center", gap=6)
    if r.voided:
        text("VENTE ANNULÉE", 11, bold=True, color=NEGATIVE, align="center", gap=6)
    rule()
    for name, detail, total in r.lines:
        text(name[:34], 9, bold=True, gap=4.5)
        text(detail, 8, color=MUTED, gap=6, right=(total, 9, False, TEXT))
    rule()
    text("TOTAL", 11, bold=True, gap=7.5, right=(r.total, 12, True, ACCENT))
    for label, value in r.extras:
        text(label, 8, color=MUTED, gap=5, right=(value[:40], 8, False, TEXT))
    ops.append(("space", (), 3))
    text("Merci pour votre achat !", 9, bold=True, align="center", gap=4.5)
    text("Reçu fait avec Bénef · monbenef.com", 7, color=MUTED, align="center", gap=0)

    height = (sum(gap for _, _, gap in ops) + 18) * mm
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(width, height))
    c.setTitle(f"Reçu {r.number} — {r.shop}")

    def draw(s, size, bold, color, align, y):
        c.setFont("Vera-Bold" if bold else "Vera", size)
        c.setFillColorRGB(*(v / 255 for v in color))
        if align == "center":
            c.drawCentredString(width / 2, y, s)
        elif align == "right":
            c.drawRightString(width - margin, y, s)
        else:
            c.drawString(margin, y, s)

    y = height - 10 * mm
    for kind, args, gap in ops:
        if kind == "text":
            s, size, bold, color, align, right = args
            draw(s, size, bold, color, align, y)
            if right:
                draw(right[0], right[1], right[2], right[3], "right", y)
        elif kind == "rule":
            c.setStrokeColorRGB(0.85, 0.8, 0.74)
            c.setDash(2, 2)
            c.line(margin, y + 1 * mm, width - margin, y + 1 * mm)
            c.setDash()
        y -= gap * mm
    c.showPage()
    c.save()
    return buf.getvalue()


# --- Image -------------------------------------------------------------------


def build_receipt_png(r: Receipt) -> bytes:
    w, pad = 720, 44
    font = lambda size, bold=False: ImageFont.truetype(FONT_BOLD if bold else FONT, size)  # noqa: E731
    rows = 9 + len(r.lines) * 2 + len(r.extras) + (2 if r.voided else 0)
    h = rows * 52 + 140
    img = Image.new("RGB", (w, h), (255, 255, 255))
    d = ImageDraw.Draw(img)
    y = pad

    def text(s, size=28, bold=False, color=TEXT, align="left"):
        f = font(size, bold)
        tw = d.textlength(s, font=f)
        x = (w - tw) / 2 if align == "center" else (w - pad - tw if align == "right" else pad)
        d.text((x, y), s, font=f, fill=color)

    def rule():
        for x in range(pad, w - pad, 16):
            d.line((x, y, x + 8, y), fill=(226, 210, 189), width=2)

    d.rectangle((0, 0, w, 10), fill=ACCENT)
    y += 6
    text(r.shop, 44, bold=True, color=ACCENT, align="center")
    y += 62
    if r.contact:
        text(r.contact, 26, color=MUTED, align="center")
        y += 40
    text(f"Reçu de vente {r.number}", 26, color=MUTED, align="center")
    y += 38
    text(r.when, 26, color=MUTED, align="center")
    y += 56
    if r.voided:
        text("VENTE ANNULÉE", 36, bold=True, color=NEGATIVE, align="center")
        y += 60
    rule()
    y += 24
    for name, detail, total in r.lines:
        text(name[:30], 30, bold=True)
        y += 42
        text(detail, 26, color=MUTED)
        text(total, 28, align="right")
        y += 54
    rule()
    y += 24
    text("TOTAL", 36, bold=True)
    text(r.total, 38, bold=True, color=ACCENT, align="right")
    y += 64
    for label, value in r.extras:
        text(label, 26, color=MUTED)
        text(value[:34], 26, align="right")
        y += 42
    y += 24
    text("Merci pour votre achat !", 30, bold=True, align="center")
    y += 44
    text("Reçu fait avec Bénef · monbenef.com", 22, color=MUTED, align="center")
    y += 50
    img = img.crop((0, 0, w, min(h, y)))
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()
