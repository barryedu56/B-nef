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

from django.db.models import Case, DecimalField, ExpressionWrapper, F, IntegerField, Q, Sum, Value, When
from django.db.models.functions import Coalesce, TruncMonth
from django.utils import timezone

from apps.activities.models import Activity
from apps.currencies.services import try_convert
from apps.finance.models import Transaction
from apps.inventory.models import Product, SaleLine

Z = Decimal("0")
_DEC = DecimalField(max_digits=20, decimal_places=2)


def _sum(qs, expr):
    return qs.aggregate(v=Coalesce(Sum(expr, output_field=_DEC), Z, output_field=_DEC))["v"]


# --- Période --------------------------------------------------------------

def resolve_period(period: str, anchor: date | None = None) -> tuple[date, date]:
    anchor = anchor or timezone.localdate()
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
    stock_losses: Decimal = Z
    net_profit: Decimal = Z
    personal_use: Decimal = Z
    stock_value: Decimal = Z
    cash_balance: Decimal = Z
    receivable: Decimal = Z
    payable: Decimal = Z

    def as_dict(self):
        # Toujours 2 décimales : selon la base (MySQL / SQLite) un agrégat
        # revient en "5000" ou "5000.00".
        return {
            k: (str(v.quantize(Decimal("0.01"))) if isinstance(v, Decimal) else v)
            for k, v in self.__dict__.items()
        }


# --- Agrégats groupés ----------------------------------------------------
# Tous les totaux sont calculés par la base de données en une requête,
# éventuellement groupés (par activité, par mois) : le coût ne dépend plus du
# nombre de ventes, seulement du nombre de groupes.

def _group_expr(group: str | None, date_field: str):
    if group == "month":
        return TruncMonth(date_field)
    if group == "activity":
        return F("activity_id" if date_field == "occurred_on" else "transaction__activity_id")
    return None


def _flows(txns, amount_field: str, group: str | None = None) -> dict:
    """{clé de groupe: {revenue, expenses, stock_losses, personal_use}} pour
    des transactions déjà filtrées (période, non annulées)."""
    K, D = Transaction.Kind, Transaction.Direction
    expr = _group_expr(group, "occurred_on")
    qs = txns.annotate(g=expr) if expr is not None else txns.annotate(g=Value(0, output_field=IntegerField()))
    rows = qs.values("g", "direction", "kind").annotate(total=Sum(amount_field)).order_by()
    out: dict = {}
    for row in rows:
        bucket = out.setdefault(row["g"], {"revenue": Z, "expenses": Z, "stock_losses": Z, "personal_use": Z})
        total = row["total"] or Z
        kind, direction = row["kind"], row["direction"]
        if direction == D.IN and kind in (K.SIMPLE, K.SALE):
            bucket["revenue"] += total
        elif direction == D.OUT and kind == K.SIMPLE:
            bucket["expenses"] += total
        elif kind == K.ADJUSTMENT:
            bucket["stock_losses"] += total if direction == D.OUT else -total
        elif kind == K.PERSONAL_USE:
            bucket["personal_use"] += total
    return out


def _cogs(sales, amount_field: str, group: str | None = None) -> dict:
    """{clé de groupe: coût des marchandises vendues}.

    Les lignes de vente stockent le coût dans la devise de l'activité ; en
    devise principale, on le met à l'échelle avec le ratio base/activité de
    la vente (le taux figé à la date de la vente)."""
    cost = F("quantity") * F("unit_cost")
    if amount_field == "amount_base":
        cost = Case(
            When(
                ~Q(transaction__amount_activity=0),
                then=cost * F("transaction__amount_base") / F("transaction__amount_activity"),
            ),
            default=cost,
        )
    lines = SaleLine.objects.filter(transaction__in=sales)
    expr = _group_expr(group, "transaction__occurred_on")
    lines = lines.annotate(g=expr) if expr is not None else lines.annotate(g=Value(0, output_field=IntegerField()))
    rows = lines.values("g").annotate(
        total=Sum(ExpressionWrapper(cost, output_field=_DEC), output_field=_DEC)
    ).order_by()
    return {row["g"]: Decimal(str(row["total"] or 0)) for row in rows}


def _stock_value(activity_qs, amount_field: str, base_currency: str) -> Decimal:
    """Valeur du stock au coût moyen. En devise principale, convertie par
    devise d'activité (taux du jour) au lieu d'additionner des devises
    différentes telles quelles."""
    rows = (
        Product.objects.filter(activity__in=activity_qs, is_archived=False)
        .values("activity__currency_id")
        .annotate(total=Sum(ExpressionWrapper(F("stock_quantity") * F("purchase_price"), output_field=_DEC)))
        .order_by()
    )
    total = Z
    for row in rows:
        value = Decimal(str(row["total"] or 0))
        currency = row["activity__currency_id"]
        if amount_field == "amount_base" and currency != base_currency:
            value = try_convert(value, currency, base_currency) or value
        total += value
    return total


def _opening_balance(activity_qs, amount_field: str, base_currency: str) -> Decimal:
    """Soldes de caisse initiaux. En devise principale, chaque solde est
    converti depuis la devise de son activité (taux du jour de création de
    l'activité, à défaut le dernier connu) — sinon on additionnerait des USD
    et des GNF tels quels."""
    if amount_field == "amount_activity":
        return _sum(activity_qs, "opening_balance")
    total = Z
    for act in activity_qs.exclude(opening_balance=0):
        value = act.opening_balance
        if act.currency_id != base_currency:
            value = (
                try_convert(value, act.currency_id, base_currency, act.created_at.date())
                or try_convert(value, act.currency_id, base_currency)
                or value  # aucun taux du tout : mieux vaut un chiffre approché que rien
            )
        total += value
    return total


def _open_credits(txns, amount_field: str) -> tuple[Decimal, Decimal]:
    """(créances, dettes) : la part encore due des opérations à crédit, dans
    `amount_field` (le reste dû est en devise de saisie, on le ramène au
    prorata du montant converti)."""
    due = ExpressionWrapper(
        F(amount_field) * (F("amount") - F("settled_amount")) / F("amount"), output_field=_DEC
    )
    rows = (
        txns.filter(is_credit=True, is_settled=False).exclude(amount=0)
        .values("direction").annotate(total=Sum(due, output_field=_DEC)).order_by()
    )
    totals = {row["direction"]: Decimal(str(row["total"] or 0)) for row in rows}
    cents = Decimal("0.01")
    return (
        totals.get(Transaction.Direction.IN, Z).quantize(cents),
        totals.get(Transaction.Direction.OUT, Z).quantize(cents),
    )


def _live(activity_qs):
    # Une transaction annulée reste dans l'historique mais sort de tous les calculs.
    return Transaction.objects.filter(activity__in=activity_qs, voided_at__isnull=True)


def _in_range(start: date, end: date) -> Q:
    return Q(occurred_on__gte=start, occurred_on__lte=end)


def _summary(activity_qs, start: date, end: date, currency: str, amount_field: str) -> Summary:
    txns = _live(activity_qs)
    period = txns.filter(_in_range(start, end))
    flows = _flows(period, amount_field).get(0, {})
    cogs = _cogs(period.filter(kind=Transaction.Kind.SALE), amount_field).get(0, Z)

    # Trésorerie : tout l'historique, uniquement les mouvements qui touchent
    # la caisse. Consommation perso et ajustements de stock : aucun argent
    # n'a changé de main — voir apps/inventory/services.py.
    cash_ok = (Q(is_credit=False) | Q(kind=Transaction.Kind.SETTLEMENT)) & ~Q(
        kind__in=[Transaction.Kind.PERSONAL_USE, Transaction.Kind.ADJUSTMENT]
    )
    cash = (
        txns.filter(cash_ok).values("direction").annotate(total=Sum(amount_field)).order_by()
    )
    cash_by_direction = {row["direction"]: row["total"] or Z for row in cash}

    s = Summary(currency=currency, period_start=start, period_end=end)
    s.revenue = flows.get("revenue", Z)
    s.cogs = cogs
    s.gross_margin = s.revenue - cogs
    # Pertes / surplus constatés à l'inventaire (casse, vol, erreur de
    # comptage), valorisés au coût : comptés dans les charges (un surplus les
    # réduit) — voir inventory/services.py::adjust_stock.
    s.stock_losses = flows.get("stock_losses", Z)
    s.expenses = flows.get("expenses", Z) + s.stock_losses
    s.net_profit = s.revenue - cogs - s.expenses
    # Consommation personnelle : valorisée au coût, visible séparément, mais
    # jamais dans le CA, les charges ou la caisse.
    s.personal_use = flows.get("personal_use", Z)
    s.stock_value = _stock_value(activity_qs, amount_field, currency)
    s.cash_balance = (
        _opening_balance(activity_qs, amount_field, currency)
        + cash_by_direction.get(Transaction.Direction.IN, Z)
        - cash_by_direction.get(Transaction.Direction.OUT, Z)
    )
    s.receivable, s.payable = _open_credits(txns, amount_field)
    return s


def activity_summary(activity: Activity, period: str, anchor: date | None = None) -> Summary:
    start, end = resolve_period(period, anchor)
    qs = Activity.objects.filter(pk=activity.pk)
    return _summary(qs, start, end, activity.currency_id, "amount_activity")


def global_summary(user, period: str, anchor: date | None = None) -> Summary:
    start, end = resolve_period(period, anchor)
    qs = Activity.objects.filter(owner=user, is_archived=False)
    return _summary(qs, start, end, user.base_currency_id, "amount_base")


def _net(flows: dict, cogs: Decimal) -> Decimal:
    return flows.get("revenue", Z) - cogs - flows.get("expenses", Z) - flows.get("stock_losses", Z)


def _q2(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01")))


def per_activity_breakdown(user, period: str, anchor: date | None = None) -> list[dict]:
    start, end = resolve_period(period, anchor)
    activities = Activity.objects.filter(owner=user, is_archived=False)
    period_txns = _live(activities).filter(_in_range(start, end))
    flows = _flows(period_txns, "amount_base", group="activity")
    cogs = _cogs(period_txns.filter(kind=Transaction.Kind.SALE), "amount_base", group="activity")
    rows = []
    for activity in activities:
        f = flows.get(activity.pk, {})
        rows.append({
            "activity_id": activity.pk,
            "name": activity.name,
            "type": activity.type,
            "net_profit": _q2(_net(f, cogs.get(activity.pk, Z))),
            "revenue": _q2(f.get("revenue", Z)),
            "currency": user.base_currency_id,
        })
    rows.sort(key=lambda r: Decimal(r["net_profit"]), reverse=True)
    return rows


def _month_key(value) -> date:
    # TruncMonth renvoie une date (DateField) ; certains moteurs une datetime.
    return value.date() if hasattr(value, "date") and callable(value.date) else value


def net_profit_timeseries(user, months: int = 6, activity: Activity | None = None) -> list[dict]:
    today = timezone.localdate()
    start = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
    for _ in range(months - 1):
        start = (start - timedelta(days=1)).replace(day=1)
    end = resolve_period("month", today)[1]

    activities = Activity.objects.filter(owner=user, is_archived=False)
    if activity is not None:
        activities = activities.filter(pk=activity.pk)
        amount_field, currency = "amount_activity", activity.currency_id
    else:
        amount_field, currency = "amount_base", user.base_currency_id

    txns = _live(activities).filter(_in_range(start, end))
    flows = {_month_key(k): v for k, v in _flows(txns, amount_field, group="month").items()}
    cogs = {
        _month_key(k): v
        for k, v in _cogs(txns.filter(kind=Transaction.Kind.SALE), amount_field, group="month").items()
    }

    series = []
    cursor = start
    while cursor <= today:
        series.append({
            "month": cursor.isoformat(),
            "net_profit": _q2(_net(flows.get(cursor, {}), cogs.get(cursor, Z))),
            "currency": currency,
        })
        cursor = resolve_period("month", cursor)[1] + timedelta(days=1)
    return series
