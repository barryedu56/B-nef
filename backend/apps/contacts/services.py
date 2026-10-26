"""Calcul du solde d'un tiers (créance positive / dette négative)."""
from decimal import Decimal

from django.db.models import DecimalField, Max, Q, Sum
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


TRADE_KINDS = (Transaction.Kind.SALE, Transaction.Kind.PURCHASE, Transaction.Kind.SIMPLE, Transaction.Kind.OPENING_BALANCE)


def party_statement(party: Party, start=None, end=None) -> dict:
    """Bilan d'un tiers, en devise principale : côté fournisseur, ce qu'on lui
    a acheté et payé ; côté client, ce qu'on lui a vendu et encaissé (sur la
    période si donnée, sinon depuis le début). Le reste dû est toujours le
    solde actuel."""
    txns = Transaction.objects.filter(party=party, voided_at__isnull=True)
    if start:
        txns = txns.filter(occurred_on__gte=start)
    if end:
        txns = txns.filter(occurred_on__lte=end)
    D, K = Transaction.Direction, Transaction.Kind
    trade = Q(kind__in=TRADE_KINDS)
    agg = txns.aggregate(
        bought=Sum("amount_base", filter=trade & Q(direction=D.OUT)),
        paid_now=Sum("amount_base", filter=trade & Q(direction=D.OUT, is_credit=False)),
        paid_later=Sum("amount_base", filter=Q(kind=K.SETTLEMENT, direction=D.OUT)),
        sold=Sum("amount_base", filter=trade & Q(direction=D.IN)),
        received_now=Sum("amount_base", filter=trade & Q(direction=D.IN, is_credit=False)),
        received_later=Sum("amount_base", filter=Q(kind=K.SETTLEMENT, direction=D.IN)),
        last=Max("occurred_on"),
    )
    z = Decimal(0)
    balance = party_balance(party)
    q = lambda v: str((v or z).quantize(Decimal("0.01")))  # noqa: E731
    return {
        "currency": party.owner.base_currency_id,
        "period_start": start,
        "period_end": end,
        "bought": q(agg["bought"]),
        "paid": q((agg["paid_now"] or z) + (agg["paid_later"] or z)),
        "sold": q(agg["sold"]),
        "received": q((agg["received_now"] or z) + (agg["received_later"] or z)),
        "owed_to_party": q(-balance if balance < 0 else z),
        "owed_by_party": q(balance if balance > 0 else z),
        "last_operation": agg["last"],
    }
