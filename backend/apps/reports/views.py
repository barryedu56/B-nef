from datetime import date
from decimal import Decimal
from urllib.parse import quote

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.activities.models import Activity
from apps.currencies.services import try_convert
from apps.currencies.models import Currency

from . import services
from .pdf import build_report_pdf

_MONTHS_LONG = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]
_MONTHS_SHORT = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"]


def _period_label(period: str, anchor: date) -> str:
    if period == "year":
        return str(anchor.year)
    if period == "week":
        start = anchor.fromordinal(anchor.toordinal() - anchor.weekday())
        return f"Semaine du {start.day} {_MONTHS_SHORT[start.month - 1]}"
    if period == "day":
        return f"{anchor.day} {_MONTHS_LONG[anchor.month - 1]} {anchor.year}"
    return f"{_MONTHS_LONG[anchor.month - 1]} {anchor.year}"

_MONEY_FIELDS = (
    "revenue", "cogs", "gross_margin", "expenses", "net_profit",
    "stock_value", "cash_balance", "receivable", "payable",
)


def _present(summary: services.Summary, display_currency: str) -> dict:
    data = summary.as_dict()
    src = summary.currency
    data["source_currency"] = src
    data["display_currency"] = display_currency
    if display_currency and display_currency != src:
        converted = {}
        ok = True
        for f in _MONEY_FIELDS:
            value = try_convert(Decimal(data[f]), src, display_currency)
            if value is None:
                ok = False
                break
            converted[f] = str(value)
        if ok:
            data.update(converted)
            data["currency"] = display_currency
            data["converted"] = True
        else:
            data["converted"] = False
            data["conversion_error"] = f"Taux {src} -> {display_currency} indisponible."
    else:
        data["converted"] = False
    return data


def _anchor(request) -> date:
    return parse_date(request.query_params.get("date") or "") or date.today()


def _display_currency(request, fallback: str, use_user_preference: bool = True) -> str:
    """Devise à utiliser pour la réponse.

    ?currency= explicite gagne toujours. Sinon, `use_user_preference` décide :
    - True  (vue globale) -> devise d'affichage / principale de l'utilisateur.
    - False (vue activité) -> devise propre de l'activité, pour ne pas la faire
      dépendre silencieusement d'une préférence globale sans rapport.
    """
    requested = (request.query_params.get("currency") or "").upper()
    if requested and Currency.objects.filter(code=requested, is_active=True).exists():
        return requested
    if use_user_preference:
        user = request.user
        preferred = user.display_currency_id or user.base_currency_id
        if preferred:
            return preferred
    return fallback


class ActivitySummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, activity_id):
        activity = get_object_or_404(Activity, pk=activity_id, owner=request.user)
        period = request.query_params.get("period", "month")
        summary = services.activity_summary(activity, period, _anchor(request))
        display = _display_currency(request, activity.currency_id, use_user_preference=False)
        payload = _present(summary, display)
        payload["activity"] = {"id": activity.pk, "name": activity.name, "currency": activity.currency_id}
        payload["timeseries"] = services.net_profit_timeseries(request.user, 6, activity)
        return Response(payload)


class GlobalSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period = request.query_params.get("period", "month")
        anchor = _anchor(request)
        summary = services.global_summary(request.user, period, anchor)
        display = _display_currency(request, request.user.base_currency_id)
        payload = _present(summary, display)
        payload["patrimoine"] = str(
            Decimal(payload["cash_balance"])
            + Decimal(payload["stock_value"])
            + Decimal(payload["receivable"])
            - Decimal(payload["payable"])
        )
        payload["by_activity"] = services.per_activity_breakdown(request.user, period, anchor)
        payload["timeseries"] = services.net_profit_timeseries(request.user, 6)
        return Response(payload)


class ReportPdfView(APIView):
    """Le même compte de résultat que les vues JSON ci-dessus, mais en vrai
    fichier PDF téléchargeable (pas une impression de navigateur)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        period = request.query_params.get("period", "month")
        anchor = _anchor(request)
        activity_id = request.query_params.get("activity")

        if activity_id:
            activity = get_object_or_404(Activity, pk=activity_id, owner=request.user)
            summary = services.activity_summary(activity, period, anchor)
            display = _display_currency(request, activity.currency_id, use_user_preference=False)
            payload = _present(summary, display)
            activity_name = activity.name
        else:
            summary = services.global_summary(request.user, period, anchor)
            display = _display_currency(request, request.user.base_currency_id)
            payload = _present(summary, display)
            activity_name = "Toutes les activités"

        subtitle = f"{activity_name} · {_period_label(period, anchor)} · {payload['currency']}"
        pdf_bytes = build_report_pdf(title="Compte de résultat", subtitle=subtitle, data=payload)

        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        raw_name = f"benef-rapport-{activity_name.replace(' ', '_').replace('/', '-')}-{anchor.isoformat()}.pdf"
        # Repli ASCII pour les clients qui ignorent filename* (RFC 5987), et
        # la vraie version UTF-8 pour ceux (tous les navigateurs modernes) qui
        # la comprennent — sinon un nom d'activité accentué s'affiche mal.
        ascii_name = raw_name.encode("ascii", "ignore").decode("ascii") or "benef-rapport.pdf"
        encoded_name = quote(raw_name)
        response["Content-Disposition"] = (
            f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{encoded_name}'
        )
        return response
