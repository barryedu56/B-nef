from decimal import Decimal, InvalidOperation

from django.utils.dateparse import parse_date
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Currency, ExchangeRate
from .serializers import CurrencySerializer, ExchangeRateSerializer
from .services import RateUnavailable, convert, get_rate, rates_freshness


class CurrencyViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Currency.objects.filter(is_active=True)
    serializer_class = CurrencySerializer
    permission_classes = [AllowAny]
    pagination_class = None


class ExchangeRateViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = ExchangeRate.objects.select_related("base", "quote")
    serializer_class = ExchangeRateSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("base", "quote", "as_of")

    @action(detail=False, methods=["get"])
    def status(self, request):
        return Response(rates_freshness())


class ConvertView(APIView):
    """GET /api/currencies/convert/?amount=1000&from=GNF&to=USD[&on=2026-09-01]"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            amount = Decimal(request.query_params.get("amount", "0"))
        except (InvalidOperation, TypeError):
            return Response({"detail": "Montant invalide."}, status=400)
        from_code = (request.query_params.get("from") or "").upper()
        to_code = (request.query_params.get("to") or "").upper()
        on = parse_date(request.query_params.get("on") or "") or None
        if not from_code or not to_code:
            return Response({"detail": "Paramètres 'from' et 'to' requis."}, status=400)
        try:
            result = convert(amount, from_code, to_code, on)
            rate = get_rate(from_code, to_code, on)
        except RateUnavailable as exc:
            return Response({"detail": str(exc)}, status=409)
        return Response(
            {
                "amount": amount,
                "from": from_code,
                "to": to_code,
                "on": on,
                "rate": rate,
                "result": result,
            }
        )
