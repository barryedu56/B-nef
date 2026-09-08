from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Party
from .serializers import PartySerializer
from .services import parties_totals


class PartyViewSet(viewsets.ModelViewSet):
    serializer_class = PartySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("kind", "is_archived")
    search_fields = ("name", "phone")

    def get_queryset(self):
        return Party.objects.filter(owner=self.request.user)

    def destroy(self, request, *args, **kwargs):
        # Un tiers supprimé viderait le champ `party` de ses transactions
        # passées (on_delete=SET_NULL) — l'historique de qui devait quoi
        # disparaîtrait silencieusement. Utilise « Archiver ».
        raise MethodNotAllowed(
            "DELETE", detail="Utilise l'archivage pour retirer un tiers : son historique est conservé."
        )

    @action(detail=False, methods=["get"])
    def totals(self, request):
        totals = parties_totals(request.user)
        return Response({k: str(v) for k, v in totals.items()})
