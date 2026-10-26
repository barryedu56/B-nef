"""Opérations métier de l'inventaire : réappro, vente, ajustement.

Chaque opération met à jour le stock, écrit un `StockMovement`, et crée la
`Transaction` financière correspondante.
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction as db_transaction
from django.utils import timezone

from apps.currencies.services import convert
from apps.finance.models import Transaction
from apps.finance.ops import settle_transaction
from apps.finance.services import create_transaction

from .models import Product, SaleLine, StockMovement

Z = Decimal(0)
_CENTS = Decimal("0.01")


def _round2(value: Decimal) -> Decimal:
    """Arrondit au centime — les champs de coût du produit ont 2 décimales ;
    une division (coût moyen pondéré, frais répartis…) qui ne tombe pas juste
    ne doit pas se propager en pleine précision dans les calculs suivants."""
    return value.quantize(_CENTS, rounding=ROUND_HALF_UP)


def _check_amount_paid_now(amount_paid_now, total: Decimal) -> None:
    if amount_paid_now and Decimal(amount_paid_now) > total:
        raise ValueError(
            f"L'acompte ({amount_paid_now}) dépasse le montant total ({total})."
        )


@db_transaction.atomic
def restock(
    *,
    product: Product,
    quantity: Decimal,
    unit_cost: Decimal,
    extra_fees: Decimal = Z,
    cost_currency: str | None = None,
    occurred_on=None,
    payment_method=None,
    party=None,
    is_credit: bool = False,
    amount_paid_now: Decimal | None = None,
    new_sale_price: Decimal | None = None,
    note: str = "",
    user=None,
) -> StockMovement:
    """Réapprovisionnement : entre du stock et enregistre l'achat.

    `unit_cost` et `extra_fees` sont exprimés dans `cost_currency` (défaut :
    devise de l'activité). `extra_fees` : frais annexes pour TOUT le lot
    (transport, douane…), pas par unité — répartis sur la quantité pour
    obtenir le vrai coût de revient unitaire (« coût rendu »), qui est ce qui
    entre dans le coût moyen pondéré du produit (comme un vrai comptable : le
    transport pour amener la marchandise fait partie de son coût, pas une
    charge d'exploitation séparée).

    `new_sale_price` : si fourni, met aussi à jour le prix de vente du produit
    (typiquement calculé par l'appelant à partir du coût rendu + une marge
    souhaitée — voir l'écran Réapprovisionner).

    `amount_paid_now` (réapprovisionnement à crédit avec acompte) : si tu paies
    une partie tout de suite au fournisseur (ex. 80 000 sur un achat de
    100 000), l'achat est enregistré à crédit pour son montant total, puis un
    règlement immédiat de `amount_paid_now` est créé dans la foulée — la
    caisse bouge tout de suite pour cette part, et il reste 20 000 de dette
    à régler plus tard (symétrique à l'acompte côté vente).
    """
    occurred_on = occurred_on or timezone.localdate()
    quantity = Decimal(quantity)
    unit_cost = Decimal(unit_cost)
    extra_fees = Decimal(extra_fees or 0)
    if quantity <= 0:
        raise ValueError("La quantité doit être positive.")
    # Verrou : deux réappros simultanés liraient le même ancien stock / coût
    # moyen et le second écraserait le premier.
    product = Product.objects.select_for_update().select_related("activity").get(pk=product.pk)
    activity = product.activity
    act_currency = activity.currency_id
    cost_currency = (cost_currency or act_currency).upper()

    unit_cost_activity = (
        unit_cost
        if cost_currency == act_currency
        else convert(unit_cost, cost_currency, act_currency, occurred_on)
    )
    extra_fees_activity = (
        extra_fees
        if cost_currency == act_currency
        else convert(extra_fees, cost_currency, act_currency, occurred_on)
    )
    # Coût de revient unitaire : le prix d'achat + la part de frais annexes
    # qui revient à chaque unité de ce lot. Arrondi tout de suite aux 2
    # décimales du champ (sinon une division qui ne tombe pas juste, ex.
    # 20000/3, se propage en pleine précision dans le coût moyen et la
    # réponse de l'API affiche des montants à rallonge).
    landed_unit_cost = _round2(unit_cost_activity + (extra_fees_activity / quantity if quantity else Z))

    old_qty = product.stock_quantity
    old_avg = product.purchase_price
    new_qty = old_qty + quantity
    if new_qty > 0:
        product.purchase_price = _round2((old_qty * old_avg + quantity * landed_unit_cost) / new_qty)
    product.stock_quantity = new_qty
    update_fields = ["stock_quantity", "purchase_price", "updated_at"]
    if new_sale_price is not None:
        product.sale_price = Decimal(new_sale_price)
        update_fields.append("sale_price")
    product.save(update_fields=update_fields)

    total_cost = quantity * unit_cost + extra_fees
    _check_amount_paid_now(amount_paid_now, total_cost)
    fees_note = f" (dont {extra_fees} {cost_currency} de frais)" if extra_fees > 0 else ""
    txn = create_transaction(
        activity=activity,
        direction=Transaction.Direction.OUT,
        amount=total_cost,
        currency=cost_currency,
        occurred_on=occurred_on,
        kind=Transaction.Kind.PURCHASE,
        payment_method=payment_method,
        party=party,
        is_credit=is_credit,
        note=note or f"Réappro {product.name}{fees_note}",
    )

    movement = StockMovement.objects.create(
        product=product,
        type=StockMovement.Type.IN,
        quantity=quantity,
        unit_cost=landed_unit_cost,
        stock_after=new_qty,
        transaction=txn,
        occurred_on=occurred_on,
        note=note,
    )

    if is_credit and amount_paid_now:
        amount_paid_now = Decimal(amount_paid_now)
        if amount_paid_now > 0:
            settle_transaction(
                txn,
                user,
                amount=amount_paid_now,
                payment_method=payment_method,
                occurred_on=occurred_on,
                note="Acompte versé au réapprovisionnement",
            )

    return movement


@db_transaction.atomic
def register_sale(
    *,
    activity,
    lines: list[dict],
    occurred_on=None,
    payment_method=None,
    party=None,
    is_credit: bool = False,
    amount_paid_now: Decimal | None = None,
    global_discount: Decimal = Z,
    sale_currency: str | None = None,
    note: str = "",
    user=None,
    allow_negative_stock: bool = False,
) -> Transaction:
    """Vente multi-produits.

    `lines` : [{"product": Product|id, "quantity": ..., "unit_price": ..., "discount": ...}]
    Prix exprimés dans `sale_currency` (défaut : devise de l'activité).

    `amount_paid_now` (vente à crédit avec acompte) : si le client paie une
    partie tout de suite (ex. 80 000 sur une vente de 100 000), la vente est
    enregistrée à crédit pour son montant total (le CA compte les 100 000),
    puis un règlement immédiat de `amount_paid_now` est créé dans la foulée —
    la caisse bouge tout de suite pour cette part, et il reste 20 000 de
    créance à régler plus tard.

    `allow_negative_stock` : vente saisie hors-ligne puis synchronisée — elle
    a réellement eu lieu, on ne la refuse pas pour un stock enregistré
    insuffisant (il passe en négatif, à corriger par un ajustement).
    """
    occurred_on = occurred_on or timezone.localdate()
    act_currency = activity.currency_id
    sale_currency = (sale_currency or act_currency).upper()
    global_discount = Decimal(global_discount or 0)

    resolved = []
    locked: dict[int, Product] = {}
    subtotal = Z
    for raw in lines:
        product = raw["product"]
        pk = product.pk if isinstance(product, Product) else product
        if pk not in locked:
            locked[pk] = Product.objects.select_for_update().get(pk=pk, activity=activity)
        product = locked[pk]
        qty = Decimal(raw["quantity"])
        raw_unit_price = raw.get("unit_price")
        unit_price = Decimal(raw_unit_price) if raw_unit_price is not None else product.sale_price
        raw_discount = raw.get("discount")
        discount = Decimal(raw_discount) if raw_discount is not None else Z
        if qty <= 0:
            raise ValueError(f"La quantité de « {product.name} » doit être positive.")
        # Plusieurs lignes peuvent viser le même produit : on cumule.
        already = sum((r[1] for r in resolved if r[0].pk == product.pk), Z)
        if not allow_negative_stock and already + qty > product.stock_quantity:
            raise ValueError(
                f"Stock insuffisant pour « {product.name} » : il ne reste que "
                f"{product.stock_quantity} {product.unit}."
            )
        resolved.append((product, qty, unit_price, discount))
        subtotal += qty * unit_price - discount

    total = subtotal - global_discount
    if total <= 0:
        raise ValueError("Le total de la vente doit être positif.")
    _check_amount_paid_now(amount_paid_now, total)

    txn = create_transaction(
        activity=activity,
        direction=Transaction.Direction.IN,
        amount=total,
        currency=sale_currency,
        occurred_on=occurred_on,
        kind=Transaction.Kind.SALE,
        payment_method=payment_method,
        party=party,
        is_credit=is_credit,
        note=note or "Vente",
    )

    for product, qty, unit_price, discount in resolved:
        unit_price_activity = (
            unit_price
            if sale_currency == act_currency
            else convert(unit_price, sale_currency, act_currency, occurred_on)
        )
        SaleLine.objects.create(
            transaction=txn,
            product=product,
            quantity=qty,
            unit_price=unit_price_activity,
            unit_cost=product.purchase_price,
            discount=(
                discount
                if sale_currency == act_currency
                else convert(discount, sale_currency, act_currency, occurred_on)
            ),
        )
        product.stock_quantity -= qty
        product.save(update_fields=["stock_quantity", "updated_at"])
        StockMovement.objects.create(
            product=product,
            type=StockMovement.Type.OUT,
            quantity=qty,
            unit_cost=product.purchase_price,
            stock_after=product.stock_quantity,
            transaction=txn,
            occurred_on=occurred_on,
            note="Vente",
        )

    if is_credit and amount_paid_now:
        amount_paid_now = Decimal(amount_paid_now)
        if amount_paid_now > 0:
            settle_transaction(
                txn,
                user,
                amount=amount_paid_now,
                payment_method=payment_method,
                occurred_on=occurred_on,
                note="Acompte versé à la vente",
            )

    return txn


@db_transaction.atomic
def adjust_stock(
    *, product: Product, new_quantity: Decimal, occurred_on=None, note: str = ""
) -> StockMovement:
    """Fixe le stock à une valeur constatée (inventaire, perte, casse).

    L'écart est valorisé au coût moyen pondéré et enregistré comme une
    opération `adjustment` : une perte (stock constaté < stock théorique)
    est une charge, un surplus un gain — sinon une casse ferait juste
    disparaître de la valeur du stock sans jamais apparaître dans le
    résultat. Aucun argent ne change de main : la caisse n'est pas touchée
    (voir apps/reports/services.py::_summary).
    """
    occurred_on = occurred_on or timezone.localdate()
    new_quantity = Decimal(new_quantity)
    if new_quantity < 0:
        raise ValueError("Le stock constaté ne peut pas être négatif.")
    product = Product.objects.select_for_update().select_related("activity").get(pk=product.pk)
    delta = new_quantity - product.stock_quantity
    product.stock_quantity = new_quantity
    product.save(update_fields=["stock_quantity", "updated_at"])

    txn = None
    value = _round2(abs(delta) * product.purchase_price)
    if value > 0:
        txn = create_transaction(
            activity=product.activity,
            direction=Transaction.Direction.OUT if delta < 0 else Transaction.Direction.IN,
            amount=value,
            currency=product.activity.currency_id,
            occurred_on=occurred_on,
            kind=Transaction.Kind.ADJUSTMENT,
            is_credit=False,
            note=note or f"{'Perte' if delta < 0 else 'Surplus'} de stock — {product.name}",
        )

    return StockMovement.objects.create(
        product=product,
        type=StockMovement.Type.ADJUST,
        quantity=delta,
        unit_cost=product.purchase_price,
        stock_after=new_quantity,
        transaction=txn,
        occurred_on=occurred_on,
        note=note or "Ajustement de stock",
    )


@db_transaction.atomic
def consume_for_personal_use(
    *, product: Product, quantity: Decimal, occurred_on=None, note: str = "",
    allow_negative_stock: bool = False,
) -> StockMovement:
    """Retire du stock une quantité gardée pour soi (pas vendue).

    Valorisée au coût moyen pondéré courant du produit (jamais au prix de
    vente : rien n'a été « gagné »). N'entre ni dans le chiffre d'affaires, ni
    dans les charges, ni dans la caisse (aucun argent n'a changé de main) —
    seule la valeur du stock diminue, comme un prélèvement personnel plutôt
    qu'une dépense de l'activité. Voir `apps/reports/services.py::_summary`
    (champ `personal_use`, exclu du calcul de la caisse).
    """
    occurred_on = occurred_on or timezone.localdate()
    quantity = Decimal(quantity)
    if quantity <= 0:
        raise ValueError("La quantité doit être positive.")
    product = Product.objects.select_for_update().select_related("activity").get(pk=product.pk)
    if not allow_negative_stock and quantity > product.stock_quantity:
        raise ValueError(
            f"Stock insuffisant : il ne reste que {product.stock_quantity} {product.unit}."
        )

    cost = quantity * product.purchase_price
    product.stock_quantity -= quantity
    product.save(update_fields=["stock_quantity", "updated_at"])

    txn = create_transaction(
        activity=product.activity,
        direction=Transaction.Direction.OUT,
        amount=cost,
        currency=product.activity.currency_id,
        occurred_on=occurred_on,
        kind=Transaction.Kind.PERSONAL_USE,
        is_credit=False,
        note=note or f"Consommation personnelle — {product.name}",
    )

    return StockMovement.objects.create(
        product=product,
        type=StockMovement.Type.PERSONAL,
        quantity=quantity,
        unit_cost=product.purchase_price,
        stock_after=product.stock_quantity,
        transaction=txn,
        occurred_on=occurred_on,
        note=note,
    )
