from decimal import Decimal

from django.db import transaction as db_transaction
from django.utils import timezone
from rest_framework import serializers

from apps.finance.models import PaymentMethod, Transaction
from apps.finance.services import create_transaction

from .models import Activity


class ActivitySerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    # Somme de départ : à la création, devient un « Apport personnel » dans la
    # caisse choisie (Espèces par défaut) — elle compte dans le solde de cette
    # caisse et se corrige comme toute opération. Le champ du modèle reste à 0
    # (il ne sert plus qu'aux données d'avant les caisses).
    opening_balance = serializers.DecimalField(
        max_digits=20, decimal_places=2, required=False, default=Decimal("0")
    )
    opening_account = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = Activity
        fields = (
            "id",
            "name",
            "type",
            "type_display",
            "currency",
            "has_inventory",
            "has_debts",
            "has_budget",
            "opening_balance",
            "opening_account",
            "is_archived",
            "created_at",
        )
        read_only_fields = ("id", "created_at")

    def validate_opening_balance(self, value):
        if value < 0:
            raise serializers.ValidationError("La somme de départ ne peut pas être négative.")
        return value

    def validate_opening_account(self, value):
        if value is None:
            return None
        account = PaymentMethod.objects.filter(pk=value, owner=self.context["request"].user).first()
        if account is None:
            raise serializers.ValidationError("Caisse inconnue.")
        return account

    @db_transaction.atomic
    def create(self, validated_data):
        opening = validated_data.pop("opening_balance", Decimal("0")) or Decimal("0")
        account = validated_data.pop("opening_account", None)
        validated_data["owner"] = self.context["request"].user
        activity = super().create(validated_data)
        if opening > 0:
            create_transaction(
                activity=activity,
                direction=Transaction.Direction.IN,
                amount=opening,
                currency=activity.currency_id,
                occurred_on=timezone.localdate(),
                kind=Transaction.Kind.CONTRIBUTION,
                payment_method=account,  # None → caisse Espèces
                note="Somme de départ",
            )
        return activity

    def update(self, instance, validated_data):
        # La somme de départ ne se modifie plus ici : on annule l'apport
        # « Somme de départ » et on en saisit un nouveau.
        validated_data.pop("opening_balance", None)
        validated_data.pop("opening_account", None)
        return super().update(instance, validated_data)
