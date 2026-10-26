"""Calcul du solde d'un tiers (créance positive / dette négative)."""
from decimal import Decimal

from django.db.models import DecimalField, Q, Sum
from django.db.models.functions import Coalesce

from apps.finance.models import Transaction

from .models import Party


def party_balance(party: Party) -> Decimal:
    """Solde en devise principale.

    > 0 : le tiers nous doit (créance) — ventes à crédit non soldées.
    < 0 : nous devons au tiers (dette)  — achats à crédit non soldés.
    Les règlements (kind=settlement) réduisent le solde vers zéro.
    """
    rows = (
        Transaction.objects.filter(party=party, voided_at__isnull=True)
        .aggregate(
            credit_in=Sum(
                "amount_base",
                filter=Q(is_credit=True, direction=Transaction.Direction.IN),
            ),
            credit_out=Sum(
                "amount_base",
                filter=Q(is_credit=True, direction=Transaction.Direction.OUT),
            ),
            settled_in=Sum(
                "amount_base",
                filter=Q(kind=Transaction.Kind.SETTLEMENT, direction=Transaction.Direction.IN),
            ),
            settled_out=Sum(
                "amount_base",
                filter=Q(kind=Transaction.Kind.SETTLEMENT, direction=Transaction.Direction.OUT),
            ),
        )
    )
    z = Decimal(0)
    receivable = (rows["credit_in"] or z) - (rows["settled_in"] or z)
    payable = (rows["credit_out"] or z) - (rows["settled_out"] or z)
    return receivable - payable


def _party_sum(direction, credit: bool):
    live = Q(transactions__voided_at__isnull=True, transactions__direction=direction)
    kind = (
        Q(transactions__is_credit=True)
        if credit
        else Q(transactions__kind=Transaction.Kind.SETTLEMENT)
    )
    return Coalesce(
        Sum("transactions__amount_base", filter=live & kind),
        Decimal(0),
        output_field=DecimalField(max_digits=20, decimal_places=2),
    )


def with_balances(parties):
    """Ajoute `computed_balance` (même calcul que `party_balance`) à chaque
    tiers, en une seule requête pour toute la liste au lieu d'une par tiers."""
    D = Transaction.Direction
    return parties.annotate(
        _credit_in=_party_sum(D.IN, credit=True),
        _settled_in=_party_sum(D.IN, credit=False),
        _credit_out=_party_sum(D.OUT, credit=True),
        _settled_out=_party_sum(D.OUT, credit=False),
    )


def annotated_balance(party) -> Decimal:
    return (party._credit_in - party._settled_in) - (party._credit_out - party._settled_out)


def parties_totals(owner) -> dict:
    total_receivable = Decimal(0)
    total_payable = Decimal(0)
    for party in with_balances(Party.objects.filter(owner=owner)):
        bal = annotated_balance(party)
        if bal > 0:
            total_receivable += bal
        else:
            total_payable += -bal
    return {"receivable": total_receivable, "payable": total_payable}
