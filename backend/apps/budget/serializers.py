from rest_framework import serializers

from .models import Budget


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
