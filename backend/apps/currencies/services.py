"""Conversion de devises.

`get_rate(from, to, on)` cherche un taux dans cet ordre :
  1. from == to               -> 1
  2. taux direct  from -> to   (le plus récent <= `on`, sinon le plus récent tout court)
  3. taux inverse to -> from   -> 1 / taux
  4. taux croisé via USD       -> rate(from, USD) * rate(USD, to)

`convert(amount, from, to, on)` renvoie un Decimal arrondi aux décimales de `to`.
Lève `RateUnavailable` si aucun taux ne permet la conversion.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.core.cache import cache
from django.utils import timezone

from .models import Currency, ExchangeRate

PIVOT = "USD"
_RATE_CACHE_TTL = 60 * 30  # 30 min


class RateUnavailable(Exception):
    """Aucun taux de change ne permet la conversion demandée."""


def _lookup(base_code: str, quote_code: str, on: date) -> Decimal | None:
    qs = ExchangeRate.objects.filter(base_id=base_code, quote_id=quote_code)
    row = qs.filter(as_of__lte=on).order_by("-as_of").first() or qs.order_by("-as_of").first()
    return row.rate if row else None


def get_rate(from_code: str, to_code: str, on: date | None = None) -> Decimal:
    from_code = (from_code or "").upper()
    to_code = (to_code or "").upper()
    if from_code == to_code:
        return Decimal(1)

    on = on or timezone.localdate()
    cache_key = f"fxrate:{from_code}:{to_code}:{on.isoformat()}"
    cached = cache.get(cache_key)
    if cached is not None:
        return Decimal(cached)

    direct = _lookup(from_code, to_code, on)
    if direct is not None:
        rate = direct
    else:
        inverse = _lookup(to_code, from_code, on)
        if inverse is not None and inverse != 0:
            rate = Decimal(1) / inverse
        else:
            leg1 = _lookup(from_code, PIVOT, on) or _inverse_or_none(PIVOT, from_code, on)
            leg2 = _lookup(PIVOT, to_code, on) or _inverse_or_none(to_code, PIVOT, on)
            if leg1 is None or leg2 is None:
                raise RateUnavailable(f"Pas de taux {from_code} -> {to_code}")
            rate = leg1 * leg2

    cache.set(cache_key, str(rate), _RATE_CACHE_TTL)
    return rate


def _inverse_or_none(base_code: str, quote_code: str, on: date) -> Decimal | None:
    value = _lookup(base_code, quote_code, on)
    if value in (None, 0):
        return None
    return Decimal(1) / value


def _quantum(currency_code: str) -> Decimal:
    places = (
        Currency.objects.filter(code=currency_code)
        .values_list("decimal_places", flat=True)
        .first()
    )
    places = 2 if places is None else places
    return Decimal(1) if places == 0 else Decimal(10) ** -places


def convert(
    amount: Decimal, from_code: str, to_code: str, on: date | None = None
) -> Decimal:
    if amount is None:
        return Decimal(0)
    amount = Decimal(amount)
    rate = get_rate(from_code, to_code, on)
    return (amount * rate).quantize(_quantum(to_code.upper()), rounding=ROUND_HALF_UP)


def try_convert(
    amount: Decimal, from_code: str, to_code: str, on: date | None = None
) -> Decimal | None:
    try:
        return convert(amount, from_code, to_code, on)
    except RateUnavailable:
        return None


def rates_freshness() -> dict:
    """Renvoie l'état de fraîcheur des taux (pour l'endpoint /rates/status/)."""
    latest = ExchangeRate.objects.order_by("-fetched_at").first()
    if latest is None:
        return {"has_rates": False, "last_fetched_at": None, "last_as_of": None, "stale": True}
    age_hours = (timezone.now() - latest.fetched_at).total_seconds() / 3600
    from django.conf import settings

    return {
        "has_rates": True,
        "last_fetched_at": latest.fetched_at,
        "last_as_of": ExchangeRate.objects.order_by("-as_of")
        .values_list("as_of", flat=True)
        .first(),
        "age_hours": round(age_hours, 1),
        "stale": age_hours > settings.EXCHANGE_RATE_MAX_AGE_HOURS,
    }
