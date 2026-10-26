"""Caisses : solde de chaque moyen de paiement (Espèces, Orange Money,
Banque…), transferts entre caisses ou entre activités, vérification de
caisse.

Le solde d'une caisse = toutes les opérations non annulées qui ont fait
bouger de l'argent avec ce moyen de paiement (entrées − sorties), toutes
activités confondues. Une caisse vit dans une devise : une opération saisie
dans une autre devise y est convertie au taux du jour (valeur actuelle de
l'argent, pas celle du jour de l'opération).
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.db import transaction as db_transaction
from django.db.models import Q, Sum
from django.utils import timezone

from apps.currencies.services import try_convert

from .models import CashCount, PaymentMethod, Transaction
from .services import create_transaction

Z = Decimal("0")
CENTS = Decimal("0.01")

# Opérations qui font bouger l'argent tout de suite : pas à crédit (ou
# règlement d'un crédit), et ni marchandise gardée pour soi ni ajustement
# de stock (aucun argent n'a changé de main).
AFFECTS_CASH = (Q(is_credit=False) | Q(kind=Transaction.Kind.SETTLEMENT)) & ~Q(
    kind__in=[Transaction.Kind.PERSONAL_USE, Transaction.Kind.ADJUSTMENT]
)


class AccountError(Exception):
    """Opération de caisse impossible (montant, caisses identiques…)."""


def account_currency(account: PaymentMethod) -> str:
    return account.currency_id or account.owner.base_currency_id


def default_cash_account(user) -> PaymentMethod:
    """La caisse « Espèces » de l'utilisateur (créée si besoin) : celle où
    va l'argent d'une opération saisie sans moyen de paiement."""
    account = PaymentMethod.objects.filter(owner=user, is_cash=True).order_by("id").first()
    return account or PaymentMethod.objects.create(owner=user, name="Espèces", is_cash=True)


def balances(user) -> dict[int | None, Decimal]:
    """{id de caisse: solde dans la devise de la caisse}. La clé None regroupe
    l'argent d'opérations anciennes sans caisse (normalement vide)."""
    accounts = {a.pk: a for a in PaymentMethod.objects.filter(owner=user).select_related("owner")}
    rows = (
        Transaction.objects.filter(AFFECTS_CASH, activity__owner=user, voided_at__isnull=True)
        .values("payment_method_id", "currency_id", "direction")
        .annotate(total=Sum("amount"))
        .order_by()
    )
    result: dict[int | None, Decimal] = {pk: Z for pk in accounts}
    for row in rows:
        pm_id = row["payment_method_id"]
        target = account_currency(accounts[pm_id]) if pm_id in accounts else user.base_currency_id
        value = row["total"] or Z
        if row["currency_id"] != target:
            value = try_convert(value, row["currency_id"], target) or value
        signed = value if row["direction"] == Transaction.Direction.IN else -value
        key = pm_id if pm_id in accounts else None
        result[key] = result.get(key, Z) + signed
    return {k: v.quantize(CENTS) for k, v in result.items()}


def total_in(user, currency: str, per_account: dict[int | None, Decimal] | None = None) -> Decimal:
    """Tout l'argent de l'utilisateur, toutes caisses, dans `currency` (taux du jour)."""
    per_account = per_account if per_account is not None else balances(user)
    accounts = {a.pk: a for a in PaymentMethod.objects.filter(owner=user).select_related("owner")}
    total = Z
    for pk, value in per_account.items():
        source = account_currency(accounts[pk]) if pk in accounts else user.base_currency_id
        total += value if source == currency else (try_convert(value, source, currency) or value)
    return total.quantize(CENTS)


@db_transaction.atomic
def transfer(
    *,
    user,
    from_account: PaymentMethod,
    to_account: PaymentMethod,
    amount: Decimal,
    from_activity,
    to_activity,
    currency: str | None = None,
    occurred_on: date | None = None,
    note: str = "",
) -> tuple[Transaction, Transaction]:
    """Déplace de l'argent d'une caisse à une autre et/ou d'une activité à
    une autre (ex. 100 000 de la boutique vers la maison, ou des espèces
    déposées à la banque). Deux opérations liées, jamais un gain ni une
    charge."""
    amount = Decimal(amount)
    if amount <= 0:
        raise AccountError("Le montant doit être positif.")
    if from_account.pk == to_account.pk and from_activity.pk == to_activity.pk:
        raise AccountError("Choisis une autre caisse ou une autre activité de destination.")
    currency = (currency or account_currency(from_account)).upper()
    occurred_on = occurred_on or timezone.localdate()
    label = note or f"Transfert {from_account.name} → {to_account.name}"
    out = create_transaction(
        activity=from_activity, direction=Transaction.Direction.OUT, amount=amount, currency=currency,
        occurred_on=occurred_on, kind=Transaction.Kind.TRANSFER, payment_method=from_account, note=label,
    )
    inn = create_transaction(
        activity=to_activity, direction=Transaction.Direction.IN, amount=amount, currency=currency,
        occurred_on=occurred_on, kind=Transaction.Kind.TRANSFER, payment_method=to_account, note=label,
        transfer_peer=out,
    )
    out.transfer_peer = inn
    out.save(update_fields=["transfer_peer", "updated_at"])
    return out, inn


@db_transaction.atomic
def count_cash(*, user, account: PaymentMethod, activity, counted: Decimal, note: str = "") -> CashCount:
    """Vérification de caisse : enregistre le montant compté et, s'il diffère
    du solde attendu, une opération « Écart de caisse » qui aligne le solde
    sur la réalité (un manque compte comme une charge, un surplus comme un
    gain)."""
    counted = Decimal(counted)
    if counted < 0:
        raise AccountError("Le montant compté ne peut pas être négatif.")
    currency = account_currency(account)
    expected = balances(user).get(account.pk, Z)
    difference = (counted - expected).quantize(CENTS)
    txn = None
    if difference != 0:
        txn = create_transaction(
            activity=activity,
            direction=Transaction.Direction.IN if difference > 0 else Transaction.Direction.OUT,
            amount=abs(difference),
            currency=currency,
            occurred_on=timezone.localdate(),
            kind=Transaction.Kind.CASH_ADJUSTMENT,
            payment_method=account,
            note=note or f"Écart constaté en comptant {account.name}",
        )
    return CashCount.objects.create(
        owner=user, payment_method=account, activity=activity, currency_id=currency,
        expected=expected, counted=counted, difference=difference, transaction=txn, note=note,
    )
