"""Opérations sur une transaction déjà enregistrée : annulation et règlement.

Principe comptable : on ne supprime jamais une écriture. « Annuler » marque la
transaction (`voided_at`) et reste visible dans l'historique — elle sort en
revanche de tous les calculs (rapports, trésorerie, soldes des tiers). Les
champs financiers (montant, devise, sens, date, quantités) ne se modifient
jamais après coup : on annule puis on ressaisit.
"""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction as db_transaction
from django.utils import timezone

from apps.inventory.models import Product, StockMovement

from .models import Transaction
from .services import create_transaction


class VoidError(Exception):
    """L'opération demandée n'est pas possible sans fausser l'historique."""


def _most_recent_movement(product_id: int) -> StockMovement | None:
    return (
        StockMovement.objects.filter(product_id=product_id)
        .order_by("-occurred_on", "-created_at", "-id")
        .first()
    )


def _guard_not_already_voided(txn: Transaction) -> None:
    if txn.is_voided:
        raise VoidError("Cette opération est déjà annulée.")


def _guard_not_settled(txn: Transaction) -> None:
    # On regarde le cumul réglé, pas juste `is_settled` : un règlement partiel
    # (is_settled encore False) a quand même déjà généré une vraie transaction
    # de règlement liée — l'annuler sans y toucher l'orphelinerait.
    if txn.settled_amount > 0:
        raise VoidError(
            "Cette opération a déjà reçu un règlement, au moins partiel. Annule "
            "d'abord le(s) règlement(s) associé(s) si tu veux revenir en arrière."
        )


@db_transaction.atomic
def void_transaction(txn: Transaction, user, reason: str = "") -> Transaction:
    """Annule une transaction et répare ses effets (stock, règlement lié)."""
    _guard_not_already_voided(txn)

    if txn.kind == Transaction.Kind.SALE:
        _guard_not_settled(txn)
        _reverse_sale(txn)
    elif txn.kind == Transaction.Kind.PURCHASE:
        _guard_not_settled(txn)
        _reverse_purchase(txn)
    elif txn.kind == Transaction.Kind.SETTLEMENT:
        _reverse_settlement(txn)
    elif txn.kind == Transaction.Kind.PERSONAL_USE:
        _reverse_personal_use(txn)
    else:  # SIMPLE — rien d'autre à réparer que le solde du tiers, déjà
        # recalculé dynamiquement puisqu'on filtre les transactions annulées.
        _guard_not_settled(txn)

    txn.voided_at = timezone.now()
    txn.voided_reason = reason
    txn.voided_by = user
    txn.save(update_fields=["voided_at", "voided_reason", "voided_by", "updated_at"])
    return txn


def _reverse_sale(txn: Transaction) -> None:
    for line in txn.sale_lines.select_related("product").all():
        product = Product.objects.select_for_update().get(pk=line.product_id)
        product.stock_quantity = product.stock_quantity + line.quantity
        product.save(update_fields=["stock_quantity", "updated_at"])
        StockMovement.objects.create(
            product=product,
            type=StockMovement.Type.ADJUST,
            quantity=line.quantity,
            unit_cost=product.purchase_price,
            stock_after=product.stock_quantity,
            transaction=txn,
            occurred_on=timezone.localdate(),
            note=f"Annulation de la vente du {txn.occurred_on:%d/%m/%Y}",
        )


def _reverse_purchase(txn: Transaction) -> None:
    movements = list(txn.stock_movements.select_related("product").all())
    if not movements:
        return
    for movement in movements:
        product = Product.objects.select_for_update().get(pk=movement.product_id)
        latest = _most_recent_movement(product.id)
        if latest is None or latest.id != movement.id:
            raise VoidError(
                f"Impossible d'annuler ce réapprovisionnement : des mouvements de stock plus "
                f"récents existent sur « {product.name} ». Fais un ajustement de stock à la "
                f"place pour corriger la quantité actuelle."
            )
        old_qty = product.stock_quantity - movement.quantity
        if old_qty < 0:
            raise VoidError(
                f"Annulation impossible : le stock de « {product.name} » deviendrait négatif."
            )
        if old_qty > 0:
            old_avg = (
                (product.purchase_price * product.stock_quantity - movement.unit_cost * movement.quantity)
                / old_qty
            ).quantize(Decimal("0.01"))
        else:
            old_avg = Decimal("0")
        product.stock_quantity = old_qty
        product.purchase_price = old_avg
        product.save(update_fields=["stock_quantity", "purchase_price", "updated_at"])
        StockMovement.objects.create(
            product=product,
            type=StockMovement.Type.ADJUST,
            quantity=-movement.quantity,
            unit_cost=old_avg,
            stock_after=product.stock_quantity,
            transaction=txn,
            occurred_on=timezone.localdate(),
            note=f"Annulation du réapprovisionnement du {txn.occurred_on:%d/%m/%Y}",
        )


def _reverse_personal_use(txn: Transaction) -> None:
    """Restaure le stock retiré pour consommation personnelle. Comme pour une
    vente, ça ne touche jamais le coût moyen pondéré (seule une entrée de
    stock — un réappro — le fait)."""
    for movement in txn.stock_movements.select_related("product").all():
        product = Product.objects.select_for_update().get(pk=movement.product_id)
        product.stock_quantity = product.stock_quantity + movement.quantity
        product.save(update_fields=["stock_quantity", "updated_at"])
        StockMovement.objects.create(
            product=product,
            type=StockMovement.Type.ADJUST,
            quantity=movement.quantity,
            unit_cost=product.purchase_price,
            stock_after=product.stock_quantity,
            transaction=txn,
            occurred_on=timezone.localdate(),
            note=f"Annulation de la consommation personnelle du {txn.occurred_on:%d/%m/%Y}",
        )


def _reverse_settlement(txn: Transaction) -> None:
    if txn.settles_id:
        original = txn.settles
        original.settled_amount = max(Decimal("0"), original.settled_amount - txn.amount)
        original.is_settled = original.settled_amount >= original.amount
        original.save(update_fields=["settled_amount", "is_settled", "updated_at"])


@db_transaction.atomic
def settle_transaction(
    original: Transaction,
    user,
    *,
    amount: Decimal | None = None,
    payment_method=None,
    occurred_on=None,
    note: str = "",
) -> Transaction:
    """Enregistre un règlement — total ou **partiel** — d'une opération à crédit.

    Peut être appelée plusieurs fois sur la même opération tant qu'il reste un
    solde à régler (ex. 80 000 payés tout de suite sur une créance de
    100 000, puis 20 000 plus tard). `original.is_settled` ne passe à True
    que quand le cumul des règlements atteint le montant total.
    """
    if original.is_voided:
        raise VoidError("Cette opération est annulée, impossible de la régler.")
    if not original.is_credit:
        raise VoidError("Cette opération n'est pas à crédit.")
    if original.is_settled:
        raise VoidError("Cette opération est déjà entièrement réglée.")

    remaining = original.amount - original.settled_amount
    settle_amount = Decimal(amount) if amount is not None else remaining
    if settle_amount <= 0:
        raise VoidError("Le montant du règlement doit être positif.")
    if settle_amount > remaining:
        raise VoidError(
            f"Le montant dépasse ce qui reste dû ({remaining} {original.currency_id})."
        )

    settlement = create_transaction(
        activity=original.activity,
        direction=original.direction,
        amount=settle_amount,
        currency=original.currency_id,
        occurred_on=occurred_on or timezone.localdate(),
        kind=Transaction.Kind.SETTLEMENT,
        payment_method=payment_method,
        party=original.party,
        category=original.category,
        is_credit=False,
        settles=original,
        note=note or f"Règlement de l'opération du {original.occurred_on:%d/%m/%Y}",
    )
    original.settled_amount = original.settled_amount + settle_amount
    original.is_settled = original.settled_amount >= original.amount
    original.save(update_fields=["settled_amount", "is_settled", "updated_at"])
    return settlement
