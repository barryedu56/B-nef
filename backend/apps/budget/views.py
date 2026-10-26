from django.utils.dateparse import parse_date
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Budget
from .serializers import BudgetSerializer
from .services import budgets_status


class BudgetViewSet(viewsets.ModelViewSet):
    serializer_class = BudgetSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("activity", "category", "period")

    def get_queryset(self):
        return Budget.objects.filter(owner=self.request.user).select_related("activity", "category")

    @action(detail=False, methods=["get"])
    def status(self, request):
        """Dépensé / prévu de chaque budget sur sa période en cours (ou celle
        qui contient `?date=`), dépassements en premier."""
        anchor = parse_date(request.query_params.get("date") or "")
        activity = request.query_params.get("activity")
        return Response(
            budgets_status(request.user, anchor, int(activity) if activity and activity.isdigit() else None)
        )
