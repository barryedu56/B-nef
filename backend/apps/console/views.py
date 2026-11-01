"""API de la console d'administration (/api/console/…), réservée aux comptes
administrateurs. Lecture de toute la plateforme ; les seules actions sont
celles qui ne peuvent pas casser les données des utilisateurs (désactiver,
déconnecter, mot de passe temporaire, annuler une opération selon les règles
de l'app, ajouter un taux de change). Chaque action est journalisée."""
import secrets
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db.models import Count, Max, Q
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from apps.accounts.services import set_new_password
from apps.currencies.models import Currency, ExchangeRate
from apps.finance import accounts
from apps.finance.models import Transaction
from apps.finance.ops import VoidError, void_transaction

from . import services
from .models import AdminAction

User = get_user_model()


class Page(PageNumberPagination):
    page_size = 25
    max_page_size = 100
    page_size_query_param = "page_size"


class ConsoleView(APIView):
    permission_classes = [IsAdminUser]


# --- Vue d'ensemble -----------------------------------------------------

class OverviewView(ConsoleView):
    def get(self, request):
        return Response(services.overview())


class FeedView(ConsoleView):
    def get(self, request):
        return Response(services.feed())


class HealthView(ConsoleView):
    def get(self, request):
        return Response(services.health())


# --- Utilisateurs -------------------------------------------------------

def _user_row(u) -> dict:
    return {
        "id": u.pk, "username": u.username, "email": u.email, "phone": u.phone,
        "is_active": u.is_active, "is_staff": u.is_staff, "base_currency": u.base_currency_id,
        "date_joined": u.date_joined, "last_login": u.last_login,
        "activities": getattr(u, "n_activities", None), "operations": getattr(u, "n_operations", None),
        "last_operation": getattr(u, "last_operation", None),
    }


class UsersView(ConsoleView):
    ORDERINGS = {
        "recent": "-date_joined", "oldest": "date_joined", "name": "username",
        "active": "-last_operation", "operations": "-n_operations", "login": "-last_login",
    }

    def get(self, request):
        qs = User.objects.annotate(
            n_activities=Count("activities", distinct=True),
            n_operations=Count("activities__transactions", distinct=True),
            last_operation=Max("activities__transactions__created_at"),
        )
        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(Q(username__icontains=search) | Q(email__icontains=search) | Q(phone__icontains=search))
        state = request.query_params.get("status")
        if state == "active":
            qs = qs.filter(is_active=True)
        elif state == "inactive":
            qs = qs.filter(is_active=False)
        elif state == "staff":
            qs = qs.filter(is_staff=True)
        ordering = self.ORDERINGS.get(request.query_params.get("ordering", "recent"), "-date_joined")
        qs = qs.order_by(ordering if not ordering.endswith("last_operation") else "-last_operation", "-date_joined")
        paginator = Page()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response([_user_row(u) for u in page])


class UserDetailView(ConsoleView):
    def get(self, request, pk):
        u = get_object_or_404(
            User.objects.annotate(
                n_activities=Count("activities", distinct=True),
                n_operations=Count("activities__transactions", distinct=True),
                last_operation=Max("activities__transactions__created_at"),
            ),
            pk=pk,
        )
        activities = [
            {
                "id": a.pk, "name": a.name, "type": a.get_type_display(), "currency": a.currency_id,
                "is_archived": a.is_archived, "operations": a.n, "created_at": a.created_at,
            }
            for a in u.activities.annotate(n=Count("transactions")).order_by("is_archived", "name")
        ]
        balances = accounts.balances(u)
        cash = [
            {"id": m.pk, "name": m.name, "currency": accounts.account_currency(m), "balance": str(balances.get(m.pk, 0))}
            for m in u.payment_methods.order_by("-is_cash", "name")
        ]
        return Response({
            **_user_row(u),
            "activities_list": activities,
            "cash": cash,
            "parties": u.parties.count() if hasattr(u, "parties") else None,
            "recent_operations": _txn_rows(
                Transaction.objects.filter(activity__owner=u).select_related("activity", "payment_method")
                .order_by("-created_at")[:20]
            ),
            "admin_actions": [
                {"at": a.created_at, "action": a.action, "admin": a.admin.username if a.admin else None, "details": a.details}
                for a in AdminAction.objects.filter(target_user=u).select_related("admin")[:20]
            ],
        })


class UserActionView(ConsoleView):
    """POST /api/console/users/<id>/<action>/ : deactivate, reactivate,
    logout, temp-password."""

    def post(self, request, pk, action):
        u = get_object_or_404(User, pk=pk)
        if u.pk == request.user.pk:
            raise ValidationError({"detail": "Pas d'action sur ton propre compte depuis la console."})
        if u.is_staff and action in ("deactivate", "temp-password"):
            raise ValidationError({"detail": "Action impossible sur un autre administrateur."})
        if action == "deactivate":
            u.is_active = False
            u.save(update_fields=["is_active"])
            _blacklist(u)
            services.log(request.user, "désactivation", u)
            return Response({"detail": f"Compte {u.username} désactivé : il ne peut plus se connecter."})
        if action == "reactivate":
            u.is_active = True
            u.save(update_fields=["is_active"])
            services.log(request.user, "réactivation", u)
            return Response({"detail": f"Compte {u.username} réactivé."})
        if action == "logout":
            n = _blacklist(u)
            services.log(request.user, "déconnexion partout", u, sessions=n)
            return Response({"detail": f"{n} session(s) de {u.username} fermée(s). Effet complet sous 12 h maximum."})
        if action == "temp-password":
            password = "-".join(secrets.token_hex(2) for _ in range(3)) + "-Bnf"
            set_new_password(u, password)  # déconnecte aussi tous ses appareils
            services.log(request.user, "mot de passe temporaire", u)
            return Response({
                "detail": f"Mot de passe temporaire de {u.username} (affiché une seule fois).",
                "password": password,
            })
        raise ValidationError({"detail": "Action inconnue."})


def _blacklist(user) -> int:
    n = 0
    for token in OutstandingToken.objects.filter(user=user):
        _, created = BlacklistedToken.objects.get_or_create(token=token)
        n += int(created)
    return n


# --- Opérations ---------------------------------------------------------

def _txn_rows(qs) -> list[dict]:
    return [
        {
            "id": t.pk, "created_at": t.created_at, "occurred_on": t.occurred_on,
            "user_id": t.activity.owner_id, "username": t.activity.owner.username,
            "activity": t.activity.name, "kind": t.kind, "kind_display": t.get_kind_display(),
            "direction": t.direction, "amount": str(t.amount), "currency": t.currency_id,
            "payment_method": t.payment_method.name if t.payment_method else None,
            "note": t.note, "is_credit": t.is_credit, "voided": t.voided_at is not None,
            "voided_reason": t.voided_reason,
        }
        for t in qs
    ]


class OperationsView(ConsoleView):
    def get(self, request):
        qs = Transaction.objects.select_related("activity__owner", "payment_method").order_by("-created_at")
        p = request.query_params
        if p.get("user"):
            qs = qs.filter(activity__owner_id=p["user"])
        if p.get("kind"):
            qs = qs.filter(kind=p["kind"])
        if p.get("direction") in ("in", "out"):
            qs = qs.filter(direction=p["direction"])
        if p.get("voided") == "1":
            qs = qs.filter(voided_at__isnull=False)
        if d := parse_date(p.get("from", "") or ""):
            qs = qs.filter(occurred_on__gte=d)
        if d := parse_date(p.get("to", "") or ""):
            qs = qs.filter(occurred_on__lte=d)
        if s := p.get("search", "").strip():
            qs = qs.filter(Q(note__icontains=s) | Q(activity__name__icontains=s) | Q(activity__owner__username__icontains=s))
        paginator = Page()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response(_txn_rows(page))


class VoidOperationView(ConsoleView):
    """Annule une opération à la demande de son propriétaire, avec les mêmes
    règles que dans l'app (stock, crédit, transfert, frais réparés)."""

    def post(self, request, pk):
        txn = get_object_or_404(Transaction.objects.select_related("activity__owner"), pk=pk)
        reason = (request.data.get("reason") or "").strip()
        if not reason:
            raise ValidationError({"reason": "Indique pourquoi (ex. « demande du client par téléphone »)."})
        try:
            void_transaction(txn, request.user, f"[admin] {reason}")
        except VoidError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        services.log(
            request.user, "annulation d'opération", txn.activity.owner,
            operation=txn.pk, amount=str(txn.amount), currency=txn.currency_id, reason=reason,
        )
        return Response({"detail": "Opération annulée."})


# --- Taux de change -----------------------------------------------------

class RateInput(serializers.Serializer):
    base = serializers.SlugRelatedField(slug_field="code", queryset=Currency.objects.all())
    quote = serializers.SlugRelatedField(slug_field="code", queryset=Currency.objects.all())
    rate = serializers.DecimalField(max_digits=24, decimal_places=12, min_value=Decimal("0.000000000001"))
    as_of = serializers.DateField(required=False)


class RatesView(ConsoleView):
    def get(self, request):
        latest = {}
        for r in ExchangeRate.objects.order_by("base_id", "quote_id", "-as_of"):
            latest.setdefault((r.base_id, r.quote_id), r)
        return Response([
            {"base": r.base_id, "quote": r.quote_id, "rate": str(r.rate), "as_of": r.as_of, "source": r.source}
            for r in latest.values()
        ])

    def post(self, request):
        data = RateInput(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        if v["base"].pk == v["quote"].pk:
            raise ValidationError({"quote": "Choisis deux devises différentes."})
        as_of = v.get("as_of") or date.today()
        ExchangeRate.objects.update_or_create(
            base=v["base"], quote=v["quote"], as_of=as_of, defaults={"rate": v["rate"], "source": "manuel"},
        )
        cache.clear()  # les taux sont mis en cache
        services.log(request.user, "taux de change", target=f"{v['base'].pk}→{v['quote'].pk}", rate=str(v["rate"]), as_of=str(as_of))
        return Response({"detail": "Taux enregistré."}, status=status.HTTP_201_CREATED)


# --- Journal ------------------------------------------------------------

class JournalView(ConsoleView):
    def get(self, request):
        qs = AdminAction.objects.select_related("admin", "target_user")
        paginator = Page()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response([
            {
                "id": a.pk, "at": a.created_at, "admin": a.admin.username if a.admin else None,
                "action": a.action, "target": a.target, "target_user_id": a.target_user_id, "details": a.details,
            }
            for a in page
        ])
