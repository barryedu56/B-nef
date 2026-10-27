"""Création de transactions avec calcul des montants convertis (snapshots)."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.db import transaction as db_transaction
from django.utils import timezone

from apps.currencies.services import convert, get_rate

from .models import Category, Transaction


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
    is_settled, settles, transfer_peer.

    Une opération qui fait bouger l'argent sans moyen de paiement précisé va
    dans la caisse « Espèces » : sinon son argent n'apparaîtrait dans aucune
    caisse (voir apps/finance/accounts.py).
    """
    kind = extra.get("kind", Transaction.Kind.SIMPLE)
    moves_cash = kind not in (Transaction.Kind.PERSONAL_USE, Transaction.Kind.ADJUSTMENT) and (
        not extra.get("is_credit") or kind == Transaction.Kind.SETTLEMENT
    )
    if moves_cash and extra.get("payment_method") is None:
        from .accounts import default_cash_account  # import circulaire sinon

        extra["payment_method"] = default_cash_account(activity.owner)
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


@db_transaction.atomic
def rebase_amounts(user) -> int:
    """Après un changement de devise principale : recalcule le montant de
    chaque opération dans la nouvelle devise (au taux de la date de
    l'opération, comme à la saisie). Sans ça, les totaux en devise
    principale afficheraient les anciens montants sous le nouveau symbole.
    Lève RateUnavailable s'il manque un taux : rien n'est modifié."""
    base = user.base_currency_id
    txns = list(Transaction.objects.filter(activity__owner=user).only(
        "id", "amount", "currency_id", "occurred_on", "amount_base", "fx_rate_to_base",
    ))
    for txn in txns:
        if txn.currency_id == base:
            txn.amount_base, txn.fx_rate_to_base = txn.amount, Decimal(1)
        else:
            txn.amount_base = convert(txn.amount, txn.currency_id, base, txn.occurred_on)
            txn.fx_rate_to_base = get_rate(txn.currency_id, base, txn.occurred_on)
    Transaction.objects.bulk_update(txns, ["amount_base", "fx_rate_to_base"], batch_size=500)
    return len(txns)

FEE_CATEGORY = "Frais de transfert"


def fee_category(owner) -> Category:
    """Catégorie système « Frais de transfert » (commune à toutes les
    activités), pour retrouver d'un coup ce que coûtent les transferts."""
    category, _ = Category.objects.get_or_create(
        owner=owner, activity=None, name=FEE_CATEGORY, direction=Transaction.Direction.OUT,
        defaults={"is_system": True},
    )
    return category


def add_fee(parent: Transaction, amount, note: str = "") -> Transaction | None:
    """Frais prélevés par l'opérateur sur `parent` (transfert, achat payé,
    règlement) : une charge de l'activité de `parent`, sortie de la même
    caisse, dans la même devise et à la même date. Rien si le montant est nul."""
    amount = Decimal(amount or 0)
    if amount <= 0:
        return None
    if parent.is_credit and parent.kind != Transaction.Kind.SETTLEMENT:
        raise ValueError("Des frais ne s'ajoutent qu'à une opération payée tout de suite.")
    return create_transaction(
        activity=parent.activity,
        direction=Transaction.Direction.OUT,
        amount=amount,
        currency=parent.currency_id,
        occurred_on=parent.occurred_on,
        kind=Transaction.Kind.FEE,
        payment_method=parent.payment_method,
        category=fee_category(parent.activity.owner),
        fee_for=parent,
        note=note or f"Frais — {parent.note}"[:255],
    )
