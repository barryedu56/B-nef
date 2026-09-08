from decimal import Decimal

from rest_framework import serializers

from apps.activities.models import Activity

from .models import Category, PaymentMethod, Transaction
from .services import create_transaction


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "activity", "name", "direction", "is_system")
        read_only_fields = ("id", "is_system")

    def create(self, validated_data):
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ("id", "name", "is_cash")
        read_only_fields = ("id",)

    def create(self, validated_data):
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)


class TransactionSerializer(serializers.ModelSerializer):
    """Lecture et création. Une fois créée, les champs financiers (montant,
    devise, sens, date, à-crédit) ne se modifient plus — voir
    `TransactionUpdateSerializer` pour ce qui reste modifiable après coup."""

    is_voided = serializers.BooleanField(read_only=True)
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    remaining_amount = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)

    class Meta:
        model = Transaction
        fields = (
            "id", "activity", "direction", "kind", "kind_display", "amount", "currency",
            "amount_activity", "amount_base", "fx_rate_to_base", "fx_date",
            "category", "payment_method", "party", "occurred_on", "note",
            "is_credit", "settled_amount", "remaining_amount", "is_settled", "settles", "created_at",
            "voided_at", "voided_reason", "is_voided",
        )
        read_only_fields = (
            "id", "amount_activity", "amount_base", "fx_rate_to_base", "fx_date", "created_at",
            "settled_amount", "is_settled", "settles", "voided_at", "voided_reason",
        )

    def validate_activity(self, activity):
        if activity.owner_id != self.context["request"].user.id:
            raise serializers.ValidationError("Activité inconnue.")
        return activity

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant doit être positif.")
        return value

    def create(self, validated_data):
        activity = validated_data.pop("activity")
        currency = validated_data.pop("currency")
        return create_transaction(
            activity=activity,
            direction=validated_data.pop("direction"),
            amount=validated_data.pop("amount"),
            currency=currency,
            occurred_on=validated_data.pop("occurred_on"),
            kind=validated_data.pop("kind", Transaction.Kind.SIMPLE),
            **validated_data,
        )


class TransactionUpdateSerializer(serializers.ModelSerializer):
    """PATCH d'une transaction existante : uniquement les champs qui ne
    changent pas le résultat financier. Pour corriger un montant, une date,
    une quantité ou une devise : annule (`/void/`) et ressaisis."""

    class Meta:
        model = Transaction
        fields = ("category", "payment_method", "party", "note")

    def validate(self, attrs):
        if self.instance and self.instance.is_voided:
            raise serializers.ValidationError("Cette opération est annulée, elle ne peut plus être modifiée.")
        return attrs


class VoidTransactionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class SettleTransactionSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=20, decimal_places=2, required=False, allow_null=True)
    payment_method = serializers.IntegerField(required=False, allow_null=True)
    occurred_on = serializers.DateField(required=False)
    note = serializers.CharField(required=False, allow_blank=True, default="")


# --- Endpoints composites ------------------------------------------------

class SaleLineInputSerializer(serializers.Serializer):
    product = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=16, decimal_places=3)
    unit_price = serializers.DecimalField(
        max_digits=20, decimal_places=2, required=False, allow_null=True
    )
    discount = serializers.DecimalField(
        max_digits=20, decimal_places=2, required=False, default=Decimal("0")
    )


class SaleInputSerializer(serializers.Serializer):
    activity = serializers.IntegerField()
    lines = SaleLineInputSerializer(many=True)
    occurred_on = serializers.DateField(required=False)
    payment_method = serializers.IntegerField(required=False, allow_null=True)
    party = serializers.IntegerField(required=False, allow_null=True)
    is_credit = serializers.BooleanField(default=False)
    amount_paid_now = serializers.DecimalField(
        max_digits=20, decimal_places=2, required=False, allow_null=True,
        help_text="Vente à crédit avec acompte : ce que le client paie tout de suite (le reste devient une créance).",
    )
    global_discount = serializers.DecimalField(
        max_digits=20, decimal_places=2, required=False, default=Decimal("0")
    )
    sale_currency = serializers.CharField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if attrs.get("amount_paid_now") and not attrs.get("is_credit"):
            raise serializers.ValidationError(
                {"amount_paid_now": "N'a de sens que pour une vente à crédit."}
            )
        return attrs


class PurchaseInputSerializer(serializers.Serializer):
    product = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=16, decimal_places=3)
    unit_cost = serializers.DecimalField(max_digits=20, decimal_places=2)
    extra_fees = serializers.DecimalField(
        max_digits=20, decimal_places=2, required=False, default=Decimal("0"),
        help_text="Frais annexes pour tout le lot (transport, douane…), pas par unité — répartis sur la quantité.",
    )
    cost_currency = serializers.CharField(required=False, allow_null=True)
    occurred_on = serializers.DateField(required=False)
    payment_method = serializers.IntegerField(required=False, allow_null=True)
    party = serializers.IntegerField(required=False, allow_null=True)
    is_credit = serializers.BooleanField(default=False)
    amount_paid_now = serializers.DecimalField(
        max_digits=20, decimal_places=2, required=False, allow_null=True,
        help_text="Réappro à crédit avec acompte : ce que tu paies tout de suite au fournisseur (le reste devient une dette).",
    )
    sale_price = serializers.DecimalField(
        max_digits=20, decimal_places=2, required=False, allow_null=True,
        help_text="Nouveau prix de vente à appliquer au produit (proposé automatiquement à partir du coût rendu + marge).",
    )
    note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if attrs.get("amount_paid_now") and not attrs.get("is_credit"):
            raise serializers.ValidationError(
                {"amount_paid_now": "N'a de sens que pour un réapprovisionnement à crédit."}
            )
        return attrs


class PersonalUseInputSerializer(serializers.Serializer):
    product = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=16, decimal_places=3)
    occurred_on = serializers.DateField(required=False)
    note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("La quantité doit être positive.")
        return value


class StockAdjustmentInputSerializer(serializers.Serializer):
    product = serializers.IntegerField()
    new_quantity = serializers.DecimalField(max_digits=16, decimal_places=3)
    occurred_on = serializers.DateField(required=False)
    note = serializers.CharField(required=False, allow_blank=True, default="")
