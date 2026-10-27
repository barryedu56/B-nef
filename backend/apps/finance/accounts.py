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
from .services import add_fee, create_transaction

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


def balances(user, activity=None) -> dict[int | None, Decimal]:
    """{id de caisse: solde dans la devise de la caisse}. La clé None regroupe
    l'argent d'opérations anciennes sans caisse (normalement vide).

    Avec `activity` : seulement la part de cette activité dans chaque caisse
    (ses opérations). Elle peut être négative si l'activité a dépensé de
    l'argent apporté dans la caisse par une autre activité. La somme des
    parts de toutes les activités est égale au solde de la caisse."""
    accounts = {a.pk: a for a in PaymentMethod.objects.filter(owner=user).select_related("owner")}
    live = Transaction.objects.filter(AFFECTS_CASH, activity__owner=user, voided_at__isnull=True)
    if activity is not None:
        live = live.filter(activity=activity)
    rows = (
        live
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
    fee: Decimal | None = None,
) -> tuple[Transaction, Transaction]:
    """Déplace de l'argent d'une caisse à une autre et/ou d'une activité à
    une autre (ex. 100 000 de la boutique vers la maison, ou des espèces
    déposées à la banque). Deux opérations liées, jamais un gain ni une
    charge.

    `fee` : frais de l'opérateur, payés en plus par la caisse de départ — une
    charge de l'activité de départ. `amount` est ce qui arrive à destination."""
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
    add_fee(out, fee, note=f"Frais du transfert {from_account.name} → {to_account.name}")
    return out, inn


@db_transaction.atomic
def count_cash(
    *, user, account: PaymentMethod, activity, counted: Decimal, note: str = "", activity_only: bool = False
) -> CashCount:
    """Vérification de caisse : enregistre le montant compté et, s'il diffère
    du solde attendu, une opération « Écart de caisse » qui aligne le solde
    sur la réalité (un manque compte comme une charge, un surplus comme un
    gain).

    `activity_only` : on a compté seulement l'argent de `activity` dans cette
    caisse (ex. un tiroir par boutique) ; le solde attendu est alors sa part."""
    counted = Decimal(counted)
    if counted < 0:
        raise AccountError("Le montant compté ne peut pas être négatif.")
    currency = account_currency(account)
    expected = balances(user, activity if activity_only else None).get(account.pk, Z)
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
        activity_only=activity_only,
    )


# --- Entrées et sorties d'argent sur une période --------------------------

K = Transaction.Kind
IN_GROUPS = {
    "sales": "Ventes encaissées",
    "collections": "Clients qui ont payé leur dette",
    "other_income": "Autres entrées",
    "contributions": "Apports personnels",
    "transfers_in": "Transferts reçus",
    "cash_surplus": "Surplus constatés",
}
OUT_GROUPS = {
    "purchases": "Achats de marchandise payés",
    "expenses": "Dépenses",
    "supplier_payments": "Dettes payées aux fournisseurs",
    "withdrawals": "Retraits personnels",
    "transfers_out": "Transferts envoyés",
    "fees": "Frais de transfert",
    "cash_shortage": "Manques constatés",
}


def _flow_group(kind: str, direction: str) -> str:
    if direction == Transaction.Direction.IN:
        return {
            K.SALE: "sales", K.SETTLEMENT: "collections", K.CONTRIBUTION: "contributions",
            K.TRANSFER: "transfers_in", K.CASH_ADJUSTMENT: "cash_surplus",
        }.get(kind, "other_income")
    return {
        K.PURCHASE: "purchases", K.SETTLEMENT: "supplier_payments", K.WITHDRAWAL: "withdrawals",
        K.TRANSFER: "transfers_out", K.CASH_ADJUSTMENT: "cash_shortage", K.FEE: "fees",
    }.get(kind, "expenses")


def cash_flow(user, start: date, end: date, activity=None) -> dict:
    """Pour chaque caisse : solde au début de la période, entrées et sorties
    regroupées par nature, solde à la fin — et les mêmes totaux toutes
    caisses confondues, dans la devise principale (taux du jour).
    Avec `activity` : seulement les opérations de cette activité."""
    base = user.base_currency_id
    accounts = list(PaymentMethod.objects.filter(owner=user).select_related("owner").order_by("-is_cash", "name"))
    by_id = {a.pk: a for a in accounts}
    live = Transaction.objects.filter(AFFECTS_CASH, activity__owner=user, voided_at__isnull=True,
                                      payment_method__in=accounts)
    if activity is not None:
        live = live.filter(activity=activity)

    def to(value, source, target):
        return value if source == target else (try_convert(value, source, target) or value)

    per_account = {
        a.pk: {"opening": Z, "in": {k: Z for k in IN_GROUPS}, "out": {k: Z for k in OUT_GROUPS}} for a in accounts
    }
    before = (
        live.filter(occurred_on__lt=start).values("payment_method_id", "currency_id", "direction")
        .annotate(total=Sum("amount")).order_by()
    )
    for row in before:
        acc = by_id[row["payment_method_id"]]
        value = to(row["total"] or Z, row["currency_id"], account_currency(acc))
        per_account[acc.pk]["opening"] += value if row["direction"] == Transaction.Direction.IN else -value
    during = (
        live.filter(occurred_on__gte=start, occurred_on__lte=end)
        .values("payment_method_id", "currency_id", "direction", "kind").annotate(total=Sum("amount")).order_by()
    )
    for row in during:
        acc = by_id[row["payment_method_id"]]
        value = to(row["total"] or Z, row["currency_id"], account_currency(acc))
        side = "in" if row["direction"] == Transaction.Direction.IN else "out"
        per_account[acc.pk][side][_flow_group(row["kind"], row["direction"])] += value

    totals = {"opening": Z, "in": {k: Z for k in IN_GROUPS}, "out": {k: Z for k in OUT_GROUPS}}
    rows = []
    for acc in accounts:
        data = per_account[acc.pk]
        cur = account_currency(acc)
        total_in = sum(data["in"].values(), Z)
        total_out = sum(data["out"].values(), Z)
        rows.append({
            "id": acc.pk, "name": acc.name, "is_cash": acc.is_cash, "currency": cur,
            "opening": str(data["opening"].quantize(CENTS)),
            "in": {k: str(v.quantize(CENTS)) for k, v in data["in"].items()},
            "out": {k: str(v.quantize(CENTS)) for k, v in data["out"].items()},
            "total_in": str(total_in.quantize(CENTS)),
            "total_out": str(total_out.quantize(CENTS)),
            "closing": str((data["opening"] + total_in - total_out).quantize(CENTS)),
        })
        totals["opening"] += to(data["opening"], cur, base)
        for side in ("in", "out"):
            for k, v in data[side].items():
                totals[side][k] += to(v, cur, base)
    total_in = sum(totals["in"].values(), Z)
    total_out = sum(totals["out"].values(), Z)
    return {
        "period_start": start, "period_end": end, "currency": base,
        "labels": {"in": IN_GROUPS, "out": OUT_GROUPS},
        "totals": {
            "opening": str(totals["opening"].quantize(CENTS)),
            "in": {k: str(v.quantize(CENTS)) for k, v in totals["in"].items()},
            "out": {k: str(v.quantize(CENTS)) for k, v in totals["out"].items()},
            "total_in": str(total_in.quantize(CENTS)),
            "total_out": str(total_out.quantize(CENTS)),
            "closing": str((totals["opening"] + total_in - total_out).quantize(CENTS)),
        },
        "accounts": rows,
    }
