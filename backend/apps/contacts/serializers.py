from decimal import Decimal

from rest_framework import serializers

from apps.common.phone import clean_guinea_phone

from .models import Party
from .services import annotated_balance, party_balance


class PartySerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField()

    class Meta:
        model = Party
        fields = ("id", "name", "phone", "kind", "note", "is_archived", "balance")
        read_only_fields = ("id", "balance")

    def get_balance(self, obj):
        # Liste : solde déjà calculé par la requête (voir with_balances).
        balance = annotated_balance(obj) if hasattr(obj, "_credit_in") else party_balance(obj)
        return str(balance.quantize(Decimal("0.01")))

    def validate_phone(self, value):
        return clean_guinea_phone(value)

    def create(self, validated_data):
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)
