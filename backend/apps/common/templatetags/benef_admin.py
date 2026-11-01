"""Chiffres du tableau de bord de l'administration."""
from datetime import timedelta

from django import template
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.activities.models import Activity
from apps.finance.models import Transaction
from apps.inventory.models import Product

register = template.Library()


@register.inclusion_tag("admin/benef_stats.html")
def benef_stats():
    User = get_user_model()
    now = timezone.now()
    week, month = now - timedelta(days=7), now - timedelta(days=30)
    users = User.objects.filter(is_staff=False)
    active_week = (
        Transaction.objects.filter(created_at__gte=week, activity__owner__is_staff=False)
        .values("activity__owner").distinct().count()
    )
    return {
        "cards": [
            ("Utilisateurs", users.count(), f"{users.filter(is_active=False).count()} désactivé(s)"),
            ("Inscrits cette semaine", users.filter(date_joined__gte=week).count(),
             f"{users.filter(date_joined__gte=month).count()} sur 30 jours"),
            ("Actifs cette semaine", active_week, "ont saisi au moins une opération"),
            ("Activités", Activity.objects.filter(is_archived=False).count(),
             f"{Product.objects.filter(is_archived=False).count()} produits suivis"),
            ("Opérations (30 jours)", Transaction.objects.filter(created_at__gte=month).count(),
             f"{Transaction.objects.count()} au total"),
        ],
        "latest": users.order_by("-date_joined")[:8],
    }
