"""Calcul du solde d'un tiers (créance positive / dette négative)."""
from decimal import Decimal

from django.db.models import Q, Sum

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


def parties_totals(owner) -> dict:
    total_receivable = Decimal(0)
    total_payable = Decimal(0)
    for party in Party.objects.filter(owner=owner):
        bal = party_balance(party)
        if bal > 0:
            total_receivable += bal
        else:
            total_payable += -bal
    return {"receivable": total_receivable, "payable": total_payable}
