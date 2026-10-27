"""Suivi des budgets : dépensé / prévu sur la période en cours."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone

from apps.currencies.services import try_convert
from apps.finance.models import Transaction
from apps.reports.services import resolve_period

from .models import Budget

Z = Decimal("0")
CENTS = Decimal("0.01")
# Seuil d'alerte : à partir de 80 % du budget consommé.
WARNING_RATIO = Decimal("0.8")


def _spent(budget: Budget, start: date, end: date) -> Decimal:
    """Charges de la période visées par le budget, dans la devise du budget.

    Seules les charges comptent (sorties simples : loyer, transport…), pas
    les réapprovisionnements, qui sont du stock et non une dépense.
    """
    txns = Transaction.objects.filter(
        activity__owner_id=budget.owner_id,
        voided_at__isnull=True,
        direction=Transaction.Direction.OUT,
        kind__in=(Transaction.Kind.SIMPLE, Transaction.Kind.FEE),
        occurred_on__gte=start,
        occurred_on__lte=end,
        activity__is_archived=False,
    )
    if budget.activity_id:
        txns = txns.filter(activity_id=budget.activity_id)
    if budget.category_id:
        txns = txns.filter(category_id=budget.category_id)

    # Budget dans la devise de son activité : montants exacts, sans conversion.
    if budget.activity_id and budget.activity.currency_id == budget.currency_id:
        return txns.aggregate(v=Sum("amount_activity"))["v"] or Z
    # Sinon : total en devise principale, converti au taux du jour.
    base_total = txns.aggregate(v=Sum("amount_base"))["v"] or Z
    base = budget.owner.base_currency_id
    if base == budget.currency_id or base_total == 0:
        return base_total
    return try_convert(base_total, base, budget.currency_id) or base_total


def budget_status(budget: Budget, anchor: date | None = None) -> dict:
    start, end = resolve_period(budget.period, anchor or timezone.localdate())
    spent = _spent(budget, start, end).quantize(CENTS)
    planned = budget.amount
    ratio = (spent / planned) if planned else Z
    status = "over" if spent > planned else "warning" if ratio >= WARNING_RATIO else "ok"
    return {
        "id": budget.pk,
        "activity": budget.activity_id,
        "activity_name": budget.activity.name if budget.activity_id else None,
        "category": budget.category_id,
        "category_name": budget.category.name if budget.category_id else None,
        "period": budget.period,
        "period_start": start,
        "period_end": end,
        "currency": budget.currency_id,
        "planned": str(planned.quantize(CENTS)),
        "spent": str(spent),
        "remaining": str((planned - spent).quantize(CENTS)),
        "ratio": str(ratio.quantize(CENTS)),
        "status": status,
    }


def budgets_status(user, anchor: date | None = None, activity_id: int | None = None) -> list[dict]:
    anchor = anchor or timezone.localdate()
    budgets = (
        Budget.objects.filter(owner=user, starts_on__lte=anchor)
        .filter(Q(activity__isnull=True) | Q(activity__is_archived=False))
        .select_related("activity", "category", "owner")
    )
    if activity_id is not None:
        budgets = budgets.filter(activity_id=activity_id)
    rows = [budget_status(b, anchor) for b in budgets]
    # Les dépassements d'abord, puis les budgets les plus consommés.
    order = {"over": 0, "warning": 1, "ok": 2}
    rows.sort(key=lambda r: (order[r["status"]], -Decimal(r["ratio"])))
    return rows


# --- Dépenses fixes (opérations récurrentes) -------------------------------

import calendar  # noqa: E402
from datetime import timedelta  # noqa: E402

from django.db import transaction as db_transaction  # noqa: E402

from apps.finance.services import add_fee, create_transaction  # noqa: E402

from .models import RecurringOperation  # noqa: E402

MAX_PENDING = 12  # au-delà, on ne liste pas toutes les échéances en retard


def _on_day(year: int, month: int, day: int) -> date:
    """Le `day` du mois, ou le dernier jour si le mois est plus court (31 → 30, 28…)."""
    return date(year, month, min(day, calendar.monthrange(year, month)[1]))


def following_due(rec: RecurringOperation, after: date) -> date:
    if rec.frequency == RecurringOperation.Frequency.WEEKLY:
        return after + timedelta(days=7)
    if rec.frequency == RecurringOperation.Frequency.YEARLY:
        return _on_day(after.year + 1, after.month, rec.day)
    month = after.month % 12 + 1
    year = after.year + (1 if after.month == 12 else 0)
    return _on_day(year, month, rec.day)


def pending_dates(rec: RecurringOperation, today: date | None = None) -> list[date]:
    """Échéances arrivées et pas encore confirmées ni passées."""
    today = today or timezone.localdate()
    dates, due = [], rec.next_due
    while rec.is_active and due <= today and len(dates) < MAX_PENDING:
        dates.append(due)
        due = following_due(rec, due)
    return dates


def due_operations(user, today: date | None = None, activity_id: int | None = None) -> list[dict]:
    """Toutes les opérations à confirmer, la plus ancienne d'abord."""
    qs = RecurringOperation.objects.filter(owner=user, is_active=True, next_due__lte=today or timezone.localdate())
    if activity_id:
        qs = qs.filter(activity_id=activity_id)
    rows = []
    for rec in qs.select_related("activity", "category", "payment_method"):
        for due in pending_dates(rec, today):
            rows.append({"recurring": rec, "due_date": due})
    return sorted(rows, key=lambda r: (r["due_date"], r["recurring"].label))


class RecurringError(Exception):
    """Échéance déjà traitée, ou pas encore la bonne."""


def _check_due(rec: RecurringOperation, due_date: date) -> None:
    if due_date != rec.next_due:
        raise RecurringError(
            "Cette échéance a déjà été confirmée ou passée."
            if due_date < rec.next_due
            else "Confirme d'abord les échéances précédentes."
        )


@db_transaction.atomic
def confirm_due(
    rec: RecurringOperation, due_date: date, *, amount=None, payment_method=None, occurred_on=None, fee=None, note=""
):
    """Enregistre l'opération de cette échéance (montant et caisse
    modifiables : la facture d'électricité change chaque mois) et passe à la
    suivante."""
    rec = RecurringOperation.objects.select_for_update().get(pk=rec.pk)
    _check_due(rec, due_date)
    txn = create_transaction(
        activity=rec.activity,
        direction=rec.direction,
        amount=Decimal(amount) if amount is not None else rec.amount,
        currency=rec.activity.currency_id,
        occurred_on=occurred_on or due_date,
        category=rec.category,
        payment_method=payment_method if payment_method is not None else rec.payment_method,
        note=note or f"{rec.label} — échéance du {due_date:%d/%m/%Y}",
    )
    add_fee(txn, fee, note=f"Frais — {rec.label}")
    rec.next_due = following_due(rec, due_date)
    rec.save(update_fields=["next_due", "updated_at"])
    return txn


@db_transaction.atomic
def skip_due(rec: RecurringOperation, due_date: date) -> RecurringOperation:
    """« Pas cette fois » : rien n'est enregistré, on passe à l'échéance suivante."""
    rec = RecurringOperation.objects.select_for_update().get(pk=rec.pk)
    _check_due(rec, due_date)
    rec.next_due = following_due(rec, due_date)
    rec.save(update_fields=["next_due", "updated_at"])
    return rec
