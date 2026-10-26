"""Données existantes → caisses.

1. Les opérations qui ont fait bouger l'argent sans moyen de paiement
   renseigné sont rattachées à la caisse « Espèces » de leur propriétaire
   (sinon leur argent n'apparaîtrait dans aucune caisse).
2. La « somme de départ » d'une activité (Activity.opening_balance) devient
   une opération « Apport personnel » dans cette caisse : elle compte dans le
   solde de la caisse et se corrige comme n'importe quelle opération.
"""
from decimal import Decimal

from django.db import migrations
from django.db.models import Q

NO_CASH_KINDS = ("personal_use", "adjustment")


def _cash_account(PaymentMethod, owner_id, cache):
    if owner_id not in cache:
        pm = (
            PaymentMethod.objects.filter(owner_id=owner_id, is_cash=True).order_by("id").first()
            or PaymentMethod.objects.create(owner_id=owner_id, name="Espèces", is_cash=True)
        )
        cache[owner_id] = pm
    return cache[owner_id]


def _rate(ExchangeRate, base, quote, on):
    if base == quote:
        return Decimal(1)
    for b, q, invert in ((base, quote, False), (quote, base, True)):
        qs = ExchangeRate.objects.filter(base_id=b, quote_id=q)
        row = qs.filter(as_of__lte=on).order_by("-as_of").first() or qs.order_by("-as_of").first()
        if row and row.rate:
            return Decimal(1) / row.rate if invert else row.rate
    return None


def forwards(apps, schema_editor):
    Transaction = apps.get_model("finance", "Transaction")
    PaymentMethod = apps.get_model("finance", "PaymentMethod")
    Activity = apps.get_model("activities", "Activity")
    ExchangeRate = apps.get_model("currencies", "ExchangeRate")
    cache = {}

    affects_cash = (Q(is_credit=False) | Q(kind="settlement")) & ~Q(kind__in=NO_CASH_KINDS)
    for txn in Transaction.objects.filter(affects_cash, payment_method__isnull=True).select_related("activity"):
        txn.payment_method = _cash_account(PaymentMethod, txn.activity.owner_id, cache)
        txn.save(update_fields=["payment_method"])

    for act in Activity.objects.exclude(opening_balance=0).select_related("owner"):
        on = act.created_at.date()
        base = act.owner.base_currency_id
        rate = _rate(ExchangeRate, act.currency_id, base, on)
        amount = act.opening_balance
        Transaction.objects.create(
            activity=act,
            direction="in",
            kind="contribution",
            amount=amount,
            currency_id=act.currency_id,
            amount_activity=amount,
            # Sans aucun taux connu : montant tel quel (même approximation
            # qu'avant pour la vue globale).
            amount_base=(amount * rate).quantize(Decimal("0.01")) if rate is not None else amount,
            fx_rate_to_base=rate if rate is not None else Decimal(1),
            fx_date=on,
            occurred_on=on,
            payment_method=_cash_account(PaymentMethod, act.owner_id, cache),
            note="Somme de départ",
        )
        act.opening_balance = Decimal(0)
        act.save(update_fields=["opening_balance"])


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0007_cash_accounts"),
        ("activities", "0001_initial"),
        ("currencies", "0002_seed_currencies"),
    ]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
