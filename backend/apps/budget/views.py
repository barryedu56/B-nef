from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.finance.models import PaymentMethod
from apps.finance.serializers import TransactionSerializer

from .models import Budget, RecurringOperation
from .serializers import BudgetSerializer, ConfirmDueSerializer, RecurringOperationSerializer
from .services import RecurringError, budgets_status, confirm_due, due_operations, skip_due


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


class RecurringOperationViewSet(viewsets.ModelViewSet):
    """Dépenses fixes (loyer, salaire…) : préparées à chaque échéance,
    enregistrées seulement quand l'utilisateur confirme."""

    serializer_class = RecurringOperationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("activity", "is_active")

    def get_queryset(self):
        return RecurringOperation.objects.filter(owner=self.request.user).select_related(
            "activity", "category", "payment_method"
        )

    @action(detail=False, methods=["get"])
    def due(self, request):
        """Échéances arrivées, à confirmer (?activity= facultatif)."""
        activity = request.query_params.get("activity")
        rows = due_operations(request.user, activity_id=int(activity) if activity and activity.isdigit() else None)
        return Response([
            {"due_date": row["due_date"], "recurring": RecurringOperationSerializer(row["recurring"], context={"request": request}).data}
            for row in rows
        ])

    def _due_date(self, request):
        data = ConfirmDueSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return data.validated_data

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        rec = self.get_object()
        v = self._due_date(request)
        method = None
        if v.get("payment_method"):
            method = get_object_or_404(PaymentMethod, pk=v["payment_method"], owner=request.user)
        try:
            txn = confirm_due(
                rec, v["due_date"], amount=v.get("amount"), payment_method=method,
                occurred_on=v.get("occurred_on"), fee=v.get("fee"), note=v.get("note", ""),
            )
        except (RecurringError, ValueError) as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response(TransactionSerializer(txn).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def skip(self, request, pk=None):
        rec = self.get_object()
        v = self._due_date(request)
        try:
            rec = skip_due(rec, v["due_date"])
        except RecurringError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response(RecurringOperationSerializer(rec, context={"request": request}).data)
