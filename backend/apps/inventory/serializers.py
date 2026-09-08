from rest_framework import serializers

from .models import Product, SaleLine, StockMovement


class ProductSerializer(serializers.ModelSerializer):
    margin = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    stock_value = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Product
        fields = (
            "id", "activity", "name", "sku", "unit",
            "purchase_price", "sale_price", "stock_quantity", "low_stock_threshold",
            "category", "is_archived", "margin", "stock_value", "is_low_stock",
        )
        read_only_fields = ("id", "purchase_price", "stock_quantity")

    def validate_activity(self, activity):
        if activity.owner_id != self.context["request"].user.id:
            raise serializers.ValidationError("Activité inconnue.")
        return activity


class StockMovementSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = StockMovement
        fields = (
            "id", "product", "product_name", "type", "type_display", "quantity",
            "unit_cost", "stock_after", "transaction", "occurred_on", "note", "created_at",
        )


class SaleLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    line_total = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    line_margin = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)

    class Meta:
        model = SaleLine
        fields = (
            "id", "transaction", "product", "product_name", "quantity",
            "unit_price", "unit_cost", "discount", "line_total", "line_margin",
        )
