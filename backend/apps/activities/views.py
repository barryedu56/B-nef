from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.permissions import IsOwner

from .models import Activity
from .onboarding import apply_onboarding
from .serializers import ActivitySerializer, OnboardingSerializer


class ActivityViewSet(viewsets.ModelViewSet):
    serializer_class = ActivitySerializer
    permission_classes = [IsOwner]
    filterset_fields = ("type", "is_archived", "has_inventory")
    search_fields = ("name",)
    ordering_fields = ("created_at", "name")

    def get_queryset(self):
        return Activity.objects.filter(owner=self.request.user).select_related("currency")

    @action(detail=True, methods=["post"])
    def onboarding(self, request, pk=None):
        """« Je démarre avec Bénef » : argent par caisse, marchandise déjà en
        stock, dettes et créances existantes — en une fois, en tout ou rien."""
        activity = self.get_object()
        data = OnboardingSerializer(data=request.data, context={"request": request, "activity": activity})
        data.is_valid(raise_exception=True)
        summary = apply_onboarding(activity=activity, **data.validated_data)
        return Response(summary, status=status.HTTP_201_CREATED)
