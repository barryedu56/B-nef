"""Agrégats : compte de résultat, trésorerie, valeur du stock, vue globale.

Convention :
  - `activity_summary`  -> montants dans la devise de l'activité (champ amount_activity)
  - `global_summary`    -> montants dans la devise principale (champ amount_base)
  - la conversion vers une devise d'affichage se fait en dernier, au taux du jour.
"""
from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import DecimalField, Q, Sum
from django.db.models.functions import Coalesce

from apps.activities.models import Activity
from apps.contacts.services import parties_totals
from apps.finance.models import Transaction
from apps.inventory.models import Product, SaleLine

Z = Decimal("0")
_DEC = DecimalField(max_digits=20, decimal_places=2)


def _sum(qs, expr):
    return qs.aggregate(v=Coalesce(Sum(expr, output_field=_DEC), Z, output_field=_DEC))["v"]


# --- Période --------------------------------------------------------------

def resolve_period(period: str, anchor: date | None = None) -> tuple[date, date]:
    anchor = anchor or date.today()
    if period == "day":
        return anchor, anchor
    if period == "week":
        start = anchor - timedelta(days=anchor.weekday())
        return start, start + timedelta(days=6)
    if period == "year":
        return date(anchor.year, 1, 1), date(anchor.year, 12, 31)
    # month par défaut
    last = calendar.monthrange(anchor.year, anchor.month)[1]
    return date(anchor.year, anchor.month, 1), date(anchor.year, anchor.month, last)


# --- Résultat d'une activité --------------------------------------------

@dataclass
class Summary:
    currency: str
    period_start: date
    period_end: date
    revenue: Decimal = Z
    cogs: Decimal = Z
    gross_margin: Decimal = Z
    expenses: Decimal = Z
    net_profit: Decimal = Z
    personal_use: Decimal = Z
    stock_value: Decimal = Z
    cash_balance: Decimal = Z
    receivable: Decimal = Z
    payable: Decimal = Z

    def as_dict(self):
        return {k: (str(v) if isinstance(v, Decimal) else v) for k, v in self.__dict__.items()}


def _cogs_for_sales(sales_qs, amount_field: str) -> Decimal:
    """Coût des marchandises vendues pour un ensemble de ventes.

    Les lignes de vente stockent le coût dans la devise de l'activité ; pour la
    vue globale on met à l'échelle avec le ratio base/activité de la transaction.
    """
    total = Z
    lines = SaleLine.objects.filter(transaction__in=sales_qs).select_related("transaction")
    for line in lines:
        cost = line.quantity * line.unit_cost
        if amount_field == "amount_base":
            txn = line.transaction
            if txn.amount_activity and txn.amount_activity != 0:
                cost = cost * (txn.amount_base / txn.amount_activity)
        total += cost
    return total


def _summary(activity_qs, start: date, end: date, currency: str, amount_field: str) -> Summary:
    in_range = Q(occurred_on__gte=start, occurred_on__lte=end)
    # Une transaction annulée reste dans l'historique mais sort de tous les calculs.
    txns = Transaction.objects.filter(activity__in=activity_qs, voided_at__isnull=True)

    revenue = _sum(
        txns.filter(in_range, direction=Transaction.Direction.IN,
                    kind__in=[Transaction.Kind.SIMPLE, Transaction.Kind.SALE]),
        amount_field,
    )
    expenses = _sum(
        txns.filter(in_range, direction=Transaction.Direction.OUT,
                    kind=Transaction.Kind.SIMPLE),
        amount_field,
    )
    sales = txns.filter(in_range, kind=Transaction.Kind.SALE)
    cogs = _cogs_for_sales(sales, amount_field)

    # Consommation personnelle : de la marchandise retirée du stock sans être
    # vendue (gardée pour soi). Valorisée au coût, visible séparément, mais
    # jamais dans le CA, les charges ou la caisse — voir
    # apps/inventory/services.py::consume_for_personal_use.
    personal_use = _sum(
        txns.filter(in_range, kind=Transaction.Kind.PERSONAL_USE), amount_field,
    )

    # Trésorerie : tout l'historique, uniquement les mouvements qui touchent la caisse.
    cash_ok = (Q(is_credit=False) | Q(kind=Transaction.Kind.SETTLEMENT)) & ~Q(
        kind=Transaction.Kind.PERSONAL_USE
    )
    cash_in = _sum(txns.filter(cash_ok, direction=Transaction.Direction.IN), amount_field)
    cash_out = _sum(txns.filter(cash_ok, direction=Transaction.Direction.OUT), amount_field)
    opening = _sum(activity_qs, "opening_balance") if amount_field == "amount_activity" else Z

    stock_value = Z
    for p in Product.objects.filter(activity__in=activity_qs, is_archived=False):
        stock_value += p.stock_quantity * p.purchase_price

    s = Summary(currency=currency, period_start=start, period_end=end)
    s.revenue = revenue
    s.cogs = cogs
    s.gross_margin = revenue - cogs
    s.expenses = expenses
    s.net_profit = revenue - cogs - expenses
    s.personal_use = personal_use
    s.stock_value = stock_value
    s.cash_balance = opening + cash_in - cash_out
    return s


def activity_summary(activity: Activity, period: str, anchor: date | None = None) -> Summary:
    start, end = resolve_period(period, anchor)
    qs = Activity.objects.filter(pk=activity.pk)
    s = _summary(qs, start, end, activity.currency_id, "amount_activity")
    return s


def global_summary(user, period: str, anchor: date | None = None) -> Summary:
    start, end = resolve_period(period, anchor)
    qs = Activity.objects.filter(owner=user, is_archived=False)
    s = _summary(qs, start, end, user.base_currency_id, "amount_base")
    totals = parties_totals(user)
    s.receivable = totals["receivable"]
    s.payable = totals["payable"]
    # opening_balance des activités (devise principale : approximé au solde initial tel quel)
    s.cash_balance += _sum(qs, "opening_balance")
    return s


def per_activity_breakdown(user, period: str, anchor: date | None = None) -> list[dict]:
    start, end = resolve_period(period, anchor)
    rows = []
    for activity in Activity.objects.filter(owner=user, is_archived=False):
        s = _summary(
            Activity.objects.filter(pk=activity.pk), start, end,
            user.base_currency_id, "amount_base",
        )
        rows.append({
            "activity_id": activity.pk,
            "name": activity.name,
            "type": activity.type,
            "net_profit": str(s.net_profit),
            "revenue": str(s.revenue),
            "currency": user.base_currency_id,
        })
    rows.sort(key=lambda r: Decimal(r["net_profit"]), reverse=True)
    return rows


def net_profit_timeseries(user, months: int = 6, activity: Activity | None = None) -> list[dict]:
    today = date.today()
    start = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
    for _ in range(months - 1):
        start = (start - timedelta(days=1)).replace(day=1)

    activities = Activity.objects.filter(owner=user, is_archived=False)
    if activity is not None:
        activities = activities.filter(pk=activity.pk)
        amount_field, currency = "amount_activity", activity.currency_id
    else:
        amount_field, currency = "amount_base", user.base_currency_id

    series = []
    cursor = start
    while cursor <= today:
        p_start, p_end = resolve_period("month", cursor)
        s = _summary(activities, p_start, p_end, currency, amount_field)
        series.append({"month": p_start.isoformat(), "net_profit": str(s.net_profit), "currency": currency})
        # mois suivant
        cursor = (p_end + timedelta(days=1))
    return series
