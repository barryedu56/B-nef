from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Product, SaleLine, StockMovement
from .serializers import ProductSerializer, SaleLineSerializer, StockMovementSerializer


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("activity", "is_archived", "category")
    search_fields = ("name", "sku")
    ordering_fields = ("name", "stock_quantity", "sale_price")

    def get_queryset(self):
        qs = Product.objects.filter(activity__owner=self.request.user).select_related("activity")
        if self.request.query_params.get("low_stock") in {"1", "true", "yes"}:
            ids = [p.pk for p in qs if p.is_low_stock]
            qs = qs.filter(pk__in=ids)
        return qs

    def destroy(self, request, *args, **kwargs):
        # Comme pour les transactions : on ne supprime jamais un produit qui a
        # un historique de stock/ventes derrière lui. Utilise « Archiver ».
        raise MethodNotAllowed(
            "DELETE", detail="Utilise l'archivage pour retirer un produit : son historique est conservé."
        )

    @action(detail=True, methods=["get"])
    def movements(self, request, pk=None):
        product = self.get_object()
        data = StockMovementSerializer(product.movements.all()[:100], many=True).data
        return Response(data)


class StockMovementViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("product", "type", "product__activity")

    def get_queryset(self):
        return StockMovement.objects.filter(
            product__activity__owner=self.request.user
        ).select_related("product")


class SaleLineViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = SaleLineSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("transaction", "product")

    def get_queryset(self):
        return SaleLine.objects.filter(
            transaction__activity__owner=self.request.user
        ).select_related("product")
