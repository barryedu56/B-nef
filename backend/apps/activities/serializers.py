from rest_framework import serializers

from .models import Activity


class ActivitySerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)

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
            "is_archived",
            "created_at",
        )
        read_only_fields = ("id", "created_at")

    def create(self, validated_data):
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)
