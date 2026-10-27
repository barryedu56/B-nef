from decimal import Decimal

from rest_framework import serializers

from .models import Budget, RecurringOperation


class BudgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Budget
        fields = (
            "id", "activity", "category", "period", "amount", "currency", "starts_on",
        )
        read_only_fields = ("id",)

    def _own(self, obj, label):
        if obj is not None and obj.owner_id != self.context["request"].user.id:
            raise serializers.ValidationError(f"{label} inconnue.")
        return obj

    def validate_activity(self, activity):
        return self._own(activity, "Activité")

    def validate_category(self, category):
        category = self._own(category, "Catégorie")
        if category is not None and category.direction != "out":
            raise serializers.ValidationError("Un budget porte sur une catégorie de dépense.")
        return category

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant prévu doit être positif.")
        return value

    def validate(self, attrs):
        activity = attrs.get("activity", getattr(self.instance, "activity", None))
        category = attrs.get("category", getattr(self.instance, "category", None))
        if activity and category and category.activity_id not in (None, activity.pk):
            raise serializers.ValidationError({"category": "Cette catégorie appartient à une autre activité."})
        return attrs

    def create(self, validated_data):
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)


class RecurringOperationSerializer(serializers.ModelSerializer):
    """Dépense fixe. À la création, `start_date` donne la première échéance
    (et le jour du mois retenu pour les suivantes)."""

    activity_name = serializers.CharField(source="activity.name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)
    payment_method_name = serializers.CharField(source="payment_method.name", read_only=True, default=None)
    currency = serializers.CharField(source="activity.currency_id", read_only=True)
    start_date = serializers.DateField(write_only=True, required=False)

    class Meta:
        model = RecurringOperation
        fields = (
            "id", "activity", "activity_name", "label", "direction", "amount", "currency", "category", "category_name",
            "payment_method", "payment_method_name", "frequency", "day", "next_due", "is_active", "start_date",
        )
        read_only_fields = ("id", "day", "next_due")

    def _own(self, obj, label):
        if obj is not None and obj.owner_id != self.context["request"].user.id:
            raise serializers.ValidationError(f"{label} inconnue.")
        return obj

    def validate_activity(self, activity):
        return self._own(activity, "Activité")

    def validate_category(self, category):
        return self._own(category, "Catégorie")

    def validate_payment_method(self, method):
        return self._own(method, "Caisse")

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant doit être positif.")
        return value

    def validate(self, attrs):
        if not self.instance and not attrs.get("start_date"):
            raise serializers.ValidationError({"start_date": "Indique la date de la première échéance."})
        category = attrs.get("category", getattr(self.instance, "category", None))
        direction = attrs.get("direction", getattr(self.instance, "direction", "out"))
        if category is not None and category.direction != direction:
            raise serializers.ValidationError({"category": "Cette catégorie ne correspond pas au sens (entrée / sortie)."})
        return attrs

    def create(self, validated_data):
        start = validated_data.pop("start_date")
        return RecurringOperation.objects.create(
            owner=self.context["request"].user, next_due=start, day=start.day, **validated_data
        )

    def update(self, instance, validated_data):
        # Nouvelle date de départ : les échéances repartent de là.
        start = validated_data.pop("start_date", None)
        if start:
            instance.next_due, instance.day = start, start.day
        return super().update(instance, validated_data)


class ConfirmDueSerializer(serializers.Serializer):
    due_date = serializers.DateField()
    amount = serializers.DecimalField(max_digits=20, decimal_places=2, required=False, allow_null=True, min_value=Decimal("0.01"))
    payment_method = serializers.IntegerField(required=False, allow_null=True)
    occurred_on = serializers.DateField(required=False, allow_null=True)
    fee = serializers.DecimalField(max_digits=20, decimal_places=2, required=False, allow_null=True, min_value=Decimal("0"))
    note = serializers.CharField(required=False, allow_blank=True, default="")
