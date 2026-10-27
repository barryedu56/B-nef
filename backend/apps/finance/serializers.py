from decimal import Decimal

from rest_framework import serializers

from apps.activities.models import Activity

from .models import CashCount, Category, PaymentMethod, Transaction
from .services import create_transaction


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "activity", "name", "direction", "is_system")
        read_only_fields = ("id", "is_system")

    def validate_activity(self, activity):
        if activity is not None and activity.owner_id != self.context["request"].user.id:
            raise serializers.ValidationError("Activité inconnue.")
        return activity

    def validate(self, attrs):
        if self.instance is not None and "direction" in attrs and attrs["direction"] != self.instance.direction:
            # Les opérations déjà classées dedans changeraient de sens.
            raise serializers.ValidationError({"direction": "Le sens d'une catégorie existante ne change pas."})
        name = attrs.get("name", getattr(self.instance, "name", "")).strip()
        direction = attrs.get("direction", getattr(self.instance, "direction", None))
        duplicates = Category.objects.filter(
            owner=self.context["request"].user, direction=direction, name__iexact=name
        ).exclude(pk=getattr(self.instance, "pk", None))
        if duplicates.exists():
            raise serializers.ValidationError({"name": "Une catégorie porte déjà ce nom."})
        attrs["name"] = name
        return attrs

    def create(self, validated_data):
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)


class PaymentMethodSerializer(serializers.ModelSerializer):
    """Moyen de paiement = caisse. `balance` (solde, dans `effective_currency`)
    est calculé une fois pour toute la liste par la vue (contexte
    « balances »)."""

    balance = serializers.SerializerMethodField()
    effective_currency = serializers.SerializerMethodField()

    class Meta:
        model = PaymentMethod
        fields = ("id", "name", "is_cash", "currency", "effective_currency", "balance")
        read_only_fields = ("id",)

    def get_balance(self, obj):
        balances = self.context.get("balances")
        return str(balances.get(obj.pk, Decimal("0.00"))) if balances is not None else None

    def get_effective_currency(self, obj):
        return obj.currency_id or self.context["request"].user.base_currency_id

    def validate_name(self, value):
        value = value.strip()
        duplicates = PaymentMethod.objects.filter(
            owner=self.context["request"].user, name__iexact=value
        ).exclude(pk=getattr(self.instance, "pk", None))
        if duplicates.exists():
            raise serializers.ValidationError("Un moyen de paiement porte déjà ce nom.")
        return value

    def create(self, validated_data):
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)


class _OwnedRelationsMixin:
    """Le tiers, la catégorie et le moyen de paiement doivent appartenir à
    l'utilisateur — sinon on pourrait rattacher une opération au client d'un
    autre compte et fausser son solde."""

    def _own(self, obj):
        if obj is not None and obj.owner_id != self.context["request"].user.id:
            raise serializers.ValidationError("Élément inconnu.")
        return obj

    def validate_party(self, party):
        return self._own(party)

    def validate_category(self, category):
        return self._own(category)

    def validate_payment_method(self, payment_method):
        return self._own(payment_method)


class TransactionSerializer(_OwnedRelationsMixin, serializers.ModelSerializer):
    """Lecture et création. Une fois créée, les champs financiers (montant,
    devise, sens, date, à-crédit) ne se modifient plus — voir
    `TransactionUpdateSerializer` pour ce qui reste modifiable après coup."""

    is_voided = serializers.BooleanField(read_only=True)
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    remaining_amount = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    fees_total = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = (
            "id", "activity", "direction", "kind", "kind_display", "amount", "currency",
            "amount_activity", "amount_base", "fx_rate_to_base", "fx_date",
            "category", "payment_method", "party", "occurred_on", "note",
            "is_credit", "settled_amount", "remaining_amount", "is_settled", "settles", "created_at",
            "voided_at", "voided_reason", "is_voided", "fee_for", "fees_total",
        )
        read_only_fields = (
            "id", "amount_activity", "amount_base", "fx_rate_to_base", "fx_date", "created_at",
            "settled_amount", "is_settled", "settles", "voided_at", "voided_reason", "fee_for",
        )

    def get_fees_total(self, obj) -> str:
        """Frais (non annulés) payés en plus de cette opération."""
        total = sum((f.amount for f in obj.fees.all() if f.voided_at is None), Decimal("0"))
        return str(total.quantize(Decimal("0.01")))

    def validate_activity(self, activity):
        if activity.owner_id != self.context["request"].user.id:
            raise serializers.ValidationError("Activité inconnue.")
        return activity

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant doit être positif.")
        return value

    # Les autres types (vente, achat, règlement, ajustement, consommation
    # perso) ont leurs propres endpoints qui mettent aussi à jour le stock /
    # le crédit d'origine : les créer ici donnerait une opération orpheline.
    _CREATABLE_KINDS = (
        Transaction.Kind.SIMPLE,
        Transaction.Kind.OPENING_BALANCE,
        Transaction.Kind.CONTRIBUTION,
        Transaction.Kind.WITHDRAWAL,
    )

    def validate_kind(self, value):
        if value not in self._CREATABLE_KINDS:
            raise serializers.ValidationError(
                "Ce type d'opération se crée via son propre écran (vente, réappro, règlement…)."
            )
        return value

    def validate(self, attrs):
        kind = attrs.get("kind")
        personal = {Transaction.Kind.CONTRIBUTION: "in", Transaction.Kind.WITHDRAWAL: "out"}
        if kind in personal:
            if attrs.get("direction") != personal[kind]:
                raise serializers.ValidationError(
                    {"direction": "Un apport est une entrée d'argent, un retrait une sortie."}
                )
            if attrs.get("is_credit"):
                raise serializers.ValidationError({"is_credit": "Un apport ou un retrait ne se fait pas à crédit."})
        if kind == Transaction.Kind.OPENING_BALANCE and not (
            attrs.get("is_credit") and attrs.get("party")
        ):
            raise serializers.ValidationError(
                {"kind": "Un solde initial doit être à crédit et rattaché à un tiers."}
            )
        return attrs

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


class TransactionUpdateSerializer(_OwnedRelationsMixin, serializers.ModelSerializer):
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
    fee = serializers.DecimalField(
        max_digits=20, decimal_places=2, required=False, allow_null=True, min_value=Decimal("0"),
        help_text="Frais de l'opérateur (Orange Money, banque…) payés en plus : enregistrés comme une charge.",
    )


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
    # Saisie faite hors-ligne sur le téléphone puis synchronisée : la vente a
    # réellement eu lieu, on l'accepte même si le stock enregistré ne suffit
    # plus (il deviendra négatif et apparaîtra en alerte de stock).
    recorded_offline = serializers.BooleanField(default=False)

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
    fee = serializers.DecimalField(
        max_digits=20, decimal_places=2, required=False, allow_null=True, min_value=Decimal("0"),
        help_text="Frais de l'opérateur (Orange Money, banque…) payés en plus : enregistrés comme une charge.",
    )

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
    # Saisie faite hors-ligne sur le téléphone puis synchronisée : la vente a
    # réellement eu lieu, on l'accepte même si le stock enregistré ne suffit
    # plus (il deviendra négatif et apparaîtra en alerte de stock).
    recorded_offline = serializers.BooleanField(default=False)

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("La quantité doit être positive.")
        return value


class StockAdjustmentInputSerializer(serializers.Serializer):
    product = serializers.IntegerField()
    new_quantity = serializers.DecimalField(max_digits=16, decimal_places=3)
    occurred_on = serializers.DateField(required=False)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class TransferInputSerializer(serializers.Serializer):
    from_account = serializers.IntegerField()
    to_account = serializers.IntegerField()
    from_activity = serializers.IntegerField()
    to_activity = serializers.IntegerField(required=False)
    amount = serializers.DecimalField(max_digits=20, decimal_places=2)
    currency = serializers.CharField(required=False, allow_null=True)
    occurred_on = serializers.DateField(required=False)
    note = serializers.CharField(required=False, allow_blank=True, default="")
    fee = serializers.DecimalField(
        max_digits=20, decimal_places=2, required=False, allow_null=True, min_value=Decimal("0"),
        help_text="Frais de l'opérateur (Orange Money, banque…) payés en plus : enregistrés comme une charge.",
    )


class CashCountInputSerializer(serializers.Serializer):
    counted = serializers.DecimalField(max_digits=20, decimal_places=2)
    activity = serializers.IntegerField()
    note = serializers.CharField(required=False, allow_blank=True, default="")
    # Vrai : on compte seulement la part de cette activité dans la caisse.
    activity_only = serializers.BooleanField(required=False, default=False)


class CashCountSerializer(serializers.ModelSerializer):
    activity_name = serializers.CharField(source="activity.name", read_only=True)

    class Meta:
        model = CashCount
        fields = ("id", "payment_method", "activity", "activity_name", "currency", "expected", "counted",
                  "difference", "transaction", "note", "activity_only", "created_at")
        read_only_fields = fields
