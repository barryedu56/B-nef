from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Budget
from .serializers import BudgetSerializer


class BudgetViewSet(viewsets.ModelViewSet):
    serializer_class = BudgetSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("activity", "category", "period")

    def get_queryset(self):
        return Budget.objects.filter(owner=self.request.user)
