from rest_framework import viewsets

from apps.common.permissions import IsOwner

from .models import Activity
from .serializers import ActivitySerializer


class ActivityViewSet(viewsets.ModelViewSet):
    serializer_class = ActivitySerializer
    permission_classes = [IsOwner]
    filterset_fields = ("type", "is_archived", "has_inventory")
    search_fields = ("name",)
    ordering_fields = ("created_at", "name")

    def get_queryset(self):
        return Activity.objects.filter(owner=self.request.user).select_related("currency")
