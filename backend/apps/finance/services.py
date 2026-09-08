"""Création de transactions avec calcul des montants convertis (snapshots)."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.db import transaction as db_transaction
from django.utils import timezone

from apps.currencies.services import convert, get_rate

from .models import Transaction


def compute_amounts(
    amount: Decimal,
    currency_code: str,
    activity_currency_code: str,
    base_currency_code: str,
    on: date | None = None,
) -> dict:
    """Renvoie les trois montants + le taux, figés à la date `on`."""
    on = on or timezone.localdate()
    amount = Decimal(amount)
    amount_activity = (
        amount
        if currency_code == activity_currency_code
        else convert(amount, currency_code, activity_currency_code, on)
    )
    amount_base = (
        amount
        if currency_code == base_currency_code
        else convert(amount, currency_code, base_currency_code, on)
    )
    fx_rate_to_base = (
        Decimal(1)
        if currency_code == base_currency_code
        else get_rate(currency_code, base_currency_code, on)
    )
    return {
        "amount_activity": amount_activity,
        "amount_base": amount_base,
        "fx_rate_to_base": fx_rate_to_base,
        "fx_date": on,
    }


@db_transaction.atomic
def create_transaction(*, activity, direction, amount, currency, occurred_on, **extra) -> Transaction:
    """Crée une transaction en remplissant les montants convertis.

    `extra` accepte : kind, category, payment_method, party, note, is_credit,
    is_settled, settles.
    """
    base_code = activity.owner.base_currency_id
    currency_code = getattr(currency, "code", currency)
    amounts = compute_amounts(
        amount=amount,
        currency_code=currency_code,
        activity_currency_code=activity.currency_id,
        base_currency_code=base_code,
        on=occurred_on,
    )
    return Transaction.objects.create(
        activity=activity,
        direction=direction,
        amount=Decimal(amount),
        currency_id=currency_code,
        occurred_on=occurred_on,
        **amounts,
        **extra,
    )


def recompute_snapshot(txn: Transaction) -> Transaction:
    """Recalcule les montants convertis d'une transaction existante."""
    amounts = compute_amounts(
        amount=txn.amount,
        currency_code=txn.currency_id,
        activity_currency_code=txn.activity.currency_id,
        base_currency_code=txn.activity.owner.base_currency_id,
        on=txn.occurred_on,
    )
    for field, value in amounts.items():
        setattr(txn, field, value)
    txn.save(update_fields=list(amounts.keys()) + ["updated_at"])
    return txn
