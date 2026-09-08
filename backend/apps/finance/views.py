from django.shortcuts import get_object_or_404
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

from .models import Category, PaymentMethod, Transaction
from .ops import VoidError, settle_transaction, void_transaction
from .serializers import (
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


class PaymentMethodViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PaymentMethod.objects.filter(owner=self.request.user)


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("activity", "direction", "kind", "category", "party", "is_credit", "is_settled")
    search_fields = ("note",)
    ordering_fields = ("occurred_on", "created_at", "amount_base")

    def get_queryset(self):
        return (
            Transaction.objects.filter(activity__owner=self.request.user)
            .select_related("activity", "currency", "category", "payment_method", "party")
        )

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
        )
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
        movement = adjust_stock(
            product=product,
            new_quantity=v["new_quantity"],
            occurred_on=v.get("occurred_on"),
            note=v.get("note", ""),
        )
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
            )
        except ValueError as exc:
            raise ValidationError({"quantity": str(exc)}) from exc
        return Response(
            {
                "transaction": TransactionSerializer(movement.transaction).data,
                "product": {"id": product.pk, "stock_quantity": str(product.stock_quantity)},
            },
            status=status.HTTP_201_CREATED,
        )
