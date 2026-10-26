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
        kind=Transaction.Kind.SIMPLE,
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
