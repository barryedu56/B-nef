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
        return self._own(category, "Catégorie")

    def create(self, validated_data):
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)
