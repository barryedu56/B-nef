"""Assistant « Je démarre avec Bénef » : tout ce qui existait avant
l'application (argent dans chaque caisse, marchandise en stock, dettes et
créances), enregistré en une fois, en tout ou rien."""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction as db_transaction
from django.utils import timezone

from apps.contacts.models import Party
from apps.finance.models import Transaction
from apps.finance.services import create_transaction
from apps.inventory.models import Product
from apps.inventory.services import set_initial_stock

Z = Decimal("0")


@db_transaction.atomic
def apply_onboarding(*, activity, cash: list[dict], products: list[dict], parties: list[dict]) -> dict:
    today = timezone.localdate()
    cash_total = Z
    for row in cash:
        create_transaction(
            activity=activity, direction=Transaction.Direction.IN, amount=row["amount"],
            currency=row["account"].currency_id or activity.currency_id, occurred_on=today,
            kind=Transaction.Kind.CONTRIBUTION, payment_method=row["account"], note="Somme de départ",
        )
        cash_total += row["amount"]

    if products and not activity.has_inventory:
        activity.has_inventory = True
        activity.save(update_fields=["has_inventory", "updated_at"])
    stock_value = Z
    for row in products:
        product = Product.objects.create(
            activity=activity, name=row["name"], unit=row.get("unit") or "pièce",
            sale_price=row.get("sale_price") or Z, low_stock_threshold=row.get("low_stock_threshold"),
        )
        if row["quantity"] > 0:
            movement = set_initial_stock(product, row["quantity"], row["unit_cost"], row.get("extra_fees") or Z)
            stock_value += row["quantity"] * movement.unit_cost

    if parties and not activity.has_debts:
        activity.has_debts = True
        activity.save(update_fields=["has_debts", "updated_at"])
    receivable = payable = Z
    for row in parties:
        party = Party.objects.create(
            owner=activity.owner, name=row["name"], phone=row.get("phone") or "",
            kind="client" if row["direction"] == "in" else "supplier",
        )
        if row["amount"] > 0:
            create_transaction(
                activity=activity, direction=row["direction"], amount=row["amount"], currency=activity.currency_id,
                occurred_on=today, kind=Transaction.Kind.OPENING_BALANCE, is_credit=True, party=party,
                note="Solde initial (report)",
            )
            if row["direction"] == "in":
                receivable += row["amount"]
            else:
                payable += row["amount"]

    return {
        "currency": activity.currency_id,
        "cash_total": str(cash_total),
        "stock_value": str(stock_value.quantize(Decimal("0.01"))),
        "receivable": str(receivable),
        "payable": str(payable),
        "products": len(products),
        "parties": len(parties),
    }
