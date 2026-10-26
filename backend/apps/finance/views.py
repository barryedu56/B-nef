from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.activities.models import Activity
from apps.contacts.models import Party
from apps.inventory.models import Product
from apps.inventory.services import adjust_stock, consume_for_personal_use, register_sale, restock

from . import accounts
from .models import CashCount, Category, PaymentMethod, Transaction
from .ops import VoidError, settle_transaction, void_transaction
from .serializers import (
    CashCountInputSerializer,
    CashCountSerializer,
    TransferInputSerializer,
    CategorySerializer,
    PaymentMethodSerializer,
    PersonalUseInputSerializer,
    PurchaseInputSerializer,
    SaleInputSerializer,
    SettleTransactionSerializer,
    StockAdjustmentInputSerializer,
    TransactionSerializer,
    TransactionUpdateSerializer,
    VoidTransactionSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("activity", "direction")

    def get_queryset(self):
        return Category.objects.filter(owner=self.request.user)

    def destroy(self, request, *args, **kwargs):
        # Supprimer une catégorie déjà utilisée viderait la catégorie de ses
        # opérations passées (SET_NULL) et supprimerait ses budgets : on
        # propose de la renommer à la place.
        category = self.get_object()
        if category.transactions.exists() or category.budgets.exists():
            raise ValidationError(
                {"detail": "Cette catégorie est déjà utilisée (opérations ou budgets) : renomme-la plutôt que de la supprimer."}
            )
        return super().destroy(request, *args, **kwargs)


class PaymentMethodViewSet(viewsets.ModelViewSet):
    """Moyens de paiement = caisses, avec leur solde (voir accounts.py)."""

    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PaymentMethod.objects.filter(owner=self.request.user).order_by("-is_cash", "name")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.request.user.is_authenticated:
            context["balances"] = accounts.balances(self.request.user)
        return context

    @action(detail=False, methods=["get"])
    def overview(self, request):
        """Tout l'argent de l'utilisateur : total dans sa devise principale
        (taux du jour) et chaque caisse avec son solde et sa dernière
        vérification."""
        user = request.user
        per_account = accounts.balances(user)
        context = {**self.get_serializer_context(), "balances": per_account}
        rows = PaymentMethodSerializer(self.get_queryset(), many=True, context=context).data
        last_counts = {}
        for count in CashCount.objects.filter(owner=user).order_by("payment_method_id", "-created_at"):
            last_counts.setdefault(count.payment_method_id, count)
        for row in rows:
            count = last_counts.get(row["id"])
            row["last_count"] = (
                {"at": count.created_at, "difference": str(count.difference)} if count else None
            )
        return Response({
            "currency": user.base_currency_id,
            "total": str(accounts.total_in(user, user.base_currency_id, per_account)),
            "unassigned": str(per_account.get(None, 0)),
            "accounts": rows,
        })

    @action(detail=False, methods=["get"])
    def flow(self, request):
        """Entrées et sorties d'argent de chaque caisse sur une période
        (?period=day|week|month|year&date=AAAA-MM-JJ)."""
        from apps.reports.services import resolve_period  # import circulaire sinon

        anchor = parse_date(request.query_params.get("date") or "") or timezone.localdate()
        start, end = resolve_period(request.query_params.get("period", "month"), anchor)
        return Response(accounts.cash_flow(request.user, start, end))

    @action(detail=True, methods=["post"])
    def count(self, request, pk=None):
        account = self.get_object()
        data = CashCountInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        activity = get_object_or_404(Activity, pk=data.validated_data["activity"], owner=request.user)
        try:
            record = accounts.count_cash(
                user=request.user, account=account, activity=activity,
                counted=data.validated_data["counted"], note=data.validated_data["note"],
            )
        except accounts.AccountError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response(CashCountSerializer(record).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def counts(self, request, pk=None):
        account = self.get_object()
        return Response(CashCountSerializer(account.counts.select_related("activity")[:50], many=True).data)

    def destroy(self, request, *args, **kwargs):
        method = self.get_object()
        if method.transactions.exists():
            raise ValidationError(
                {"detail": "Ce moyen de paiement est déjà utilisé dans des opérations : renomme-le plutôt que de le supprimer."}
            )
        return super().destroy(request, *args, **kwargs)


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("activity", "direction", "kind", "category", "party", "payment_method", "is_credit", "is_settled")
    search_fields = ("note",)
    ordering_fields = ("occurred_on", "created_at", "amount_base")

    def get_queryset(self):
        qs = (
            Transaction.objects.filter(activity__owner=self.request.user)
            .select_related("activity", "currency", "category", "payment_method", "party")
        )
        # ?cash_only=1 : seulement les opérations qui ont réellement fait
        # bouger l'argent (mouvements d'une caisse) — pas une vente à crédit,
        # dont seul le règlement fait entrer l'argent.
        if self.request.query_params.get("cash_only") in ("1", "true"):
            qs = qs.filter(accounts.AFFECTS_CASH)
        return qs

    def get_serializer_class(self):
        if self.action in ("update", "partial_update"):
            return TransactionUpdateSerializer
        return TransactionSerializer

    def destroy(self, request, *args, **kwargs):
        raise MethodNotAllowed(
            "DELETE", detail="Utilise /void/ pour annuler une opération : l'historique est conservé."
        )

    @action(detail=True, methods=["post"])
    def void(self, request, pk=None):
        txn = self.get_object()
        data = VoidTransactionSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            txn = void_transaction(txn, request.user, reason=data.validated_data["reason"])
        except VoidError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response(TransactionSerializer(txn).data)

    @action(detail=True, methods=["post"])
    def settle(self, request, pk=None):
        original = self.get_object()
        data = SettleTransactionSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        payment_method = None
        if v.get("payment_method"):
            payment_method = get_object_or_404(
                PaymentMethod, pk=v["payment_method"], owner=request.user
            )
        try:
            settlement = settle_transaction(
                original,
                request.user,
                amount=v.get("amount"),
                payment_method=payment_method,
                occurred_on=v.get("occurred_on"),
                note=v.get("note", ""),
            )
        except VoidError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response(TransactionSerializer(settlement).data, status=status.HTTP_201_CREATED)


class _OwnedLookupMixin:
    def _activity(self, request, activity_id):
        return get_object_or_404(Activity, pk=activity_id, owner=request.user)

    def _optional(self, model, pk, request):
        if pk in (None, "", 0):
            return None
        return get_object_or_404(model, pk=pk, owner=request.user)


class SaleView(_OwnedLookupMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = SaleInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        activity = self._activity(request, v["activity"])
        lines = [
            {
                "product": get_object_or_404(Product, pk=line["product"], activity=activity),
                "quantity": line["quantity"],
                "unit_price": line.get("unit_price"),
                "discount": line.get("discount") or 0,
            }
            for line in v["lines"]
        ]
        try:
            txn = register_sale(
                activity=activity,
                lines=lines,
                occurred_on=v.get("occurred_on"),
                payment_method=self._optional(PaymentMethod, v.get("payment_method"), request),
                party=self._optional(Party, v.get("party"), request),
                is_credit=v.get("is_credit", False),
                amount_paid_now=v.get("amount_paid_now"),
                global_discount=v.get("global_discount") or 0,
                sale_currency=v.get("sale_currency"),
                note=v.get("note", ""),
                user=request.user,
                allow_negative_stock=v["recorded_offline"],
            )
        except (ValueError, VoidError) as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response(TransactionSerializer(txn).data, status=status.HTTP_201_CREATED)


class PurchaseView(_OwnedLookupMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = PurchaseInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        product = get_object_or_404(
            Product, pk=v["product"], activity__owner=request.user
        )
        try:
            movement = restock(
                product=product,
                quantity=v["quantity"],
                unit_cost=v["unit_cost"],
                extra_fees=v.get("extra_fees") or 0,
                cost_currency=v.get("cost_currency"),
                occurred_on=v.get("occurred_on"),
                payment_method=self._optional(PaymentMethod, v.get("payment_method"), request),
                party=self._optional(Party, v.get("party"), request),
                is_credit=v.get("is_credit", False),
                amount_paid_now=v.get("amount_paid_now"),
                new_sale_price=v.get("sale_price"),
                note=v.get("note", ""),
                user=request.user,
            )
        except (ValueError, VoidError) as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        # Le service relit le produit sous verrou : c'est cette instance qui est à jour.
        product = movement.product
        return Response(
            {
                "transaction": TransactionSerializer(movement.transaction).data,
                "product": {
                    "id": product.pk,
                    "stock_quantity": str(product.stock_quantity),
                    "purchase_price": str(product.purchase_price),
                    "sale_price": str(product.sale_price),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class StockAdjustmentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = StockAdjustmentInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        product = get_object_or_404(Product, pk=v["product"], activity__owner=request.user)
        try:
            movement = adjust_stock(
                product=product,
                new_quantity=v["new_quantity"],
                occurred_on=v.get("occurred_on"),
                note=v.get("note", ""),
            )
        except ValueError as exc:
            raise ValidationError({"new_quantity": str(exc)}) from exc
        product = movement.product
        return Response(
            {
                "movement_id": movement.pk,
                "product": {"id": product.pk, "stock_quantity": str(product.stock_quantity)},
            },
            status=status.HTTP_201_CREATED,
        )


class PersonalUseView(APIView):
    """Retire du stock une quantité gardée pour soi, sans vente — voir
    `apps/inventory/services.py::consume_for_personal_use`."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = PersonalUseInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        product = get_object_or_404(Product, pk=v["product"], activity__owner=request.user)
        try:
            movement = consume_for_personal_use(
                product=product,
                quantity=v["quantity"],
                occurred_on=v.get("occurred_on"),
                note=v.get("note", ""),
                allow_negative_stock=v["recorded_offline"],
            )
        except ValueError as exc:
            raise ValidationError({"quantity": str(exc)}) from exc
        product = movement.product
        return Response(
            {
                "transaction": TransactionSerializer(movement.transaction).data,
                "product": {"id": product.pk, "stock_quantity": str(product.stock_quantity)},
            },
            status=status.HTTP_201_CREATED,
        )


class TransferView(_OwnedLookupMixin, APIView):
    """Transfert d'argent entre deux caisses et/ou deux activités."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = TransferInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        from_activity = self._activity(request, v["from_activity"])
        to_activity = self._activity(request, v.get("to_activity") or v["from_activity"])
        from_account = get_object_or_404(PaymentMethod, pk=v["from_account"], owner=request.user)
        to_account = get_object_or_404(PaymentMethod, pk=v["to_account"], owner=request.user)
        try:
            out, inn = accounts.transfer(
                user=request.user, from_account=from_account, to_account=to_account, amount=v["amount"],
                from_activity=from_activity, to_activity=to_activity, currency=v.get("currency"),
                occurred_on=v.get("occurred_on"), note=v["note"],
            )
        except (accounts.AccountError, ValueError) as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response(
            {"out": TransactionSerializer(out).data, "in": TransactionSerializer(inn).data},
            status=status.HTTP_201_CREATED,
        )
