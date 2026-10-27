from decimal import Decimal

from django.db import transaction as db_transaction
from rest_framework import serializers

from .models import Product, SaleLine, StockMovement
from .services import set_initial_stock


class ProductSerializer(serializers.ModelSerializer):
    # Stock déjà en ta possession à la création du produit (acheté avant
    # Bénef) : il entre au coût indiqué, sans toucher la caisse — voir
    # inventory/services.py::set_initial_stock.
    initial_quantity = serializers.DecimalField(
        max_digits=16, decimal_places=3, required=False, write_only=True, min_value=Decimal("0")
    )
    initial_unit_cost = serializers.DecimalField(
        max_digits=20, decimal_places=2, required=False, write_only=True, min_value=Decimal("0")
    )
    initial_extra_fees = serializers.DecimalField(
        max_digits=20, decimal_places=2, required=False, write_only=True, min_value=Decimal("0"),
        help_text="Frais pour tout ce stock (transport, douane…), répartis sur la quantité.",
    )
    margin = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    stock_value = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Product
        fields = (
            "id", "activity", "name", "sku", "unit",
            "purchase_price", "sale_price", "stock_quantity", "low_stock_threshold",
            "category", "is_archived", "margin", "stock_value", "is_low_stock",
            "initial_quantity", "initial_unit_cost", "initial_extra_fees",
        )
        read_only_fields = ("id", "purchase_price", "stock_quantity")

    def validate_activity(self, activity):
        if activity.owner_id != self.context["request"].user.id:
            raise serializers.ValidationError("Activité inconnue.")
        return activity

    def validate(self, attrs):
        qty = attrs.get("initial_quantity") or Decimal("0")
        if qty > 0 and not attrs.get("initial_unit_cost"):
            raise serializers.ValidationError(
                {"initial_unit_cost": "Indique combien t'a coûté chaque unité de ce stock."}
            )
        return attrs

    @db_transaction.atomic
    def create(self, validated_data):
        qty = validated_data.pop("initial_quantity", None) or Decimal("0")
        cost = validated_data.pop("initial_unit_cost", None) or Decimal("0")
        fees = validated_data.pop("initial_extra_fees", None) or Decimal("0")
        product = super().create(validated_data)
        if qty > 0:
            set_initial_stock(product, qty, cost, fees)
            product.refresh_from_db()  # stock et coût mis à jour par le service
        return product

    def update(self, instance, validated_data):
        # Le stock initial ne se saisit qu'à la création ; ensuite : réappro
        # ou ajustement.
        validated_data.pop("initial_quantity", None)
        validated_data.pop("initial_unit_cost", None)
        validated_data.pop("initial_extra_fees", None)
        return super().update(instance, validated_data)


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
