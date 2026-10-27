"""Import d'une liste de produits depuis Excel (.xlsx) ou CSV, pour
l'inventaire de départ. Les colonnes sont reconnues par leur nom, même
écrit un peu différemment (« Désignation », « Qté », « Prix d'achat »…)."""
from __future__ import annotations

import csv
import io
import re
import unicodedata
from decimal import Decimal, InvalidOperation

from openpyxl import Workbook, load_workbook

MAX_ROWS = 2000
COLUMNS = {
    "name": ("nom", "produit", "designation", "article", "libelle"),
    "unit": ("unite",),
    "quantity": ("quantite", "qte", "stock", "nombre"),
    "unit_cost": ("cout", "prix d achat", "achat", "prix achat", "pa"),
    "sale_price": ("prix de vente", "vente", "prix vente", "pv", "prix"),
    "low_stock_threshold": ("seuil", "alerte", "stock minimum"),
    "extra_fees": ("frais", "transport"),
}
TEMPLATE_HEADERS = [
    "Nom", "Unité", "Quantité en stock", "Coût d'achat unitaire", "Prix de vente", "Seuil d'alerte",
    "Frais pour tout ce stock",
]


class ImportError_(Exception):
    """Fichier illisible ou sans colonne « Nom »."""


def _norm(text) -> str:
    text = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _match_columns(headers: list) -> dict[str, int]:
    found: dict[str, int] = {}
    normalized = [_norm(h) for h in headers]
    # Les noms les plus précis d'abord (« prix d'achat » avant « prix »).
    for field, aliases in sorted(COLUMNS.items(), key=lambda kv: -max(len(a) for a in kv[1])):
        for alias in sorted(aliases, key=len, reverse=True):
            for i, h in enumerate(normalized):
                if i in found.values():
                    continue
                if h == alias or h.startswith(alias + " ") or (len(alias) > 3 and alias in h):
                    found.setdefault(field, i)
                    break
            if field in found:
                break
    return found


def _number(value) -> Decimal | None:
    if value is None or str(value).strip() == "":
        return None
    if isinstance(value, (int, float, Decimal)):
        return Decimal(str(value))
    text = str(value).replace(" ", "").replace(" ", "").replace("FG", "").replace("GNF", "")
    if "," in text and "." not in text:
        text = text.replace(",", ".")
    try:
        return Decimal(text)
    except InvalidOperation:
        raise ValueError(f"« {value} » n'est pas un nombre")


def _read_rows(upload) -> list[list]:
    name = (upload.name or "").lower()
    raw = upload.read()
    if name.endswith((".xlsx", ".xlsm")):
        try:
            sheet = load_workbook(io.BytesIO(raw), read_only=True, data_only=True).worksheets[0]
        except Exception as exc:  # fichier corrompu ou pas vraiment un .xlsx
            raise ImportError_("Ce fichier Excel est illisible.") from exc
        return [list(r) for r in sheet.iter_rows(values_only=True)]
    if name.endswith((".csv", ".txt")):
        text = raw.decode("utf-8-sig", errors="ignore") if raw[:3] == b"\xef\xbb\xbf" else None
        if text is None:
            try:
                text = raw.decode("utf-8")
            except UnicodeDecodeError:
                text = raw.decode("latin-1")
        delimiter = ";" if text.count(";") >= text.count(",") else ","
        return [row for row in csv.reader(io.StringIO(text), delimiter=delimiter)]
    raise ImportError_("Format non pris en charge : utilise un fichier Excel (.xlsx) ou CSV.")


def parse_products(upload) -> dict:
    """Lit le fichier et renvoie les lignes reconnues et les erreurs, sans
    rien enregistrer : l'utilisateur relit avant de valider."""
    rows = [r for r in _read_rows(upload) if any(str(c or "").strip() for c in r)]
    if not rows:
        raise ImportError_("Le fichier est vide.")
    columns = _match_columns(rows[0])
    if "name" not in columns:
        raise ImportError_("Colonne « Nom » introuvable : la première ligne doit contenir les titres des colonnes.")
    products, errors = [], []
    for line_no, row in enumerate(rows[1 : MAX_ROWS + 1], start=2):
        cell = lambda field: row[columns[field]] if field in columns and columns[field] < len(row) else None  # noqa: E731
        name = str(cell("name") or "").strip()
        if not name:
            continue
        try:
            quantity = _number(cell("quantity")) or Decimal(0)
            unit_cost = _number(cell("unit_cost"))
            sale_price = _number(cell("sale_price"))
            threshold = _number(cell("low_stock_threshold"))
            fees = _number(cell("extra_fees")) or Decimal(0)
        except ValueError as exc:
            errors.append({"line": line_no, "name": name, "message": str(exc)})
            continue
        if quantity < 0 or fees < 0 or (unit_cost is not None and unit_cost < 0):
            errors.append({"line": line_no, "name": name, "message": "Valeur négative"})
            continue
        if quantity > 0 and not unit_cost:
            errors.append({"line": line_no, "name": name, "message": "Coût d'achat manquant pour ce stock"})
            continue
        products.append({
            "name": name[:120],
            "unit": (str(cell("unit") or "").strip() or "pièce")[:20],
            "quantity": str(quantity),
            "unit_cost": str(unit_cost) if unit_cost is not None else "0",
            "sale_price": str(sale_price) if sale_price is not None else "0",
            "low_stock_threshold": str(threshold) if threshold is not None else None,
            "extra_fees": str(fees),
        })
    truncated = len(rows) - 1 > MAX_ROWS
    return {"products": products, "errors": errors, "truncated": truncated, "max_rows": MAX_ROWS}


def template_xlsx() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Produits"
    ws.append(TEMPLATE_HEADERS)
    ws.append(["Sac de riz 25 kg", "sac", 20, 230000, 265000, 5, 40000])
    ws.append(["Huile 5 L", "bidon", 12, 95000, 115000, 3, 0])
    for col, width in zip("ABCDEFG", (28, 10, 18, 22, 16, 14, 24)):
        ws.column_dimensions[col].width = width
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()
