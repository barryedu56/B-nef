from rest_framework import serializers

from apps.common.phone import clean_guinea_phone

from .models import Party
from .services import party_balance


class PartySerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField()

    class Meta:
        model = Party
        fields = ("id", "name", "phone", "kind", "note", "is_archived", "balance")
        read_only_fields = ("id", "balance")

    def get_balance(self, obj):
        return str(party_balance(obj))

    def validate_phone(self, value):
        return clean_guinea_phone(value)

    def create(self, validated_data):
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)
