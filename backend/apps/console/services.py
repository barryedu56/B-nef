"""Chiffres et santé de la plateforme pour la console d'administration.

Uniquement des agrégats calculés par la base (pas de boucle sur les
opérations) : la console est rechargée toutes les 10 secondes et ne doit
pas peser sur l'app des utilisateurs."""
from __future__ import annotations

import os
import shutil
from datetime import datetime, timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connection
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.activities.models import Activity
from apps.currencies.services import rates_freshness
from apps.finance.models import Transaction
from apps.inventory.models import Product

from .models import AdminAction

User = get_user_model()
BACKUP_DIR = os.environ.get("BENEF_BACKUP_DIR", "/backups")


def _start_of_today():
    now = timezone.localtime()
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _active_owner_count(since) -> int:
    return (
        Transaction.objects.filter(created_at__gte=since, activity__owner__is_staff=False)
        .values("activity__owner").distinct().count()
    )


def _daily(qs, field: str, since) -> dict[str, int]:
    rows = qs.filter(**{f"{field}__gte": since}).annotate(day=TruncDate(field)).values("day").annotate(n=Count("id"))
    return {r["day"].isoformat(): r["n"] for r in rows}


def overview() -> dict:
    today = _start_of_today()
    week, month = today - timedelta(days=6), today - timedelta(days=29)
    users = User.objects.filter(is_staff=False)
    txns = Transaction.objects.filter(activity__owner__is_staff=False)

    signups = _daily(users, "date_joined", month)
    operations = _daily(txns, "created_at", month)
    days = [(month + timedelta(days=i)).date().isoformat() for i in range(30)]
    return {
        "users": {
            "total": users.count(),
            "inactive": users.filter(is_active=False).count(),
            "new_today": users.filter(date_joined__gte=today).count(),
            "new_7d": users.filter(date_joined__gte=week).count(),
            "new_30d": users.filter(date_joined__gte=month).count(),
            "active_today": _active_owner_count(today),
            "active_7d": _active_owner_count(week),
        },
        "operations": {
            "today": txns.filter(created_at__gte=today).count(),
            "7d": txns.filter(created_at__gte=week).count(),
            "total": txns.count(),
        },
        "activities": Activity.objects.filter(is_archived=False, owner__is_staff=False).count(),
        "products": Product.objects.filter(is_archived=False, activity__owner__is_staff=False).count(),
        "series": [{"day": d, "signups": signups.get(d, 0), "operations": operations.get(d, 0)} for d in days],
        "generated_at": timezone.now(),
    }


def feed(limit: int = 30) -> list[dict]:
    """Derniers événements de la plateforme, du plus récent au plus ancien."""
    events = []
    for u in User.objects.filter(is_staff=False).order_by("-date_joined")[:limit]:
        events.append({"type": "signup", "at": u.date_joined, "user_id": u.pk, "username": u.username, "text": "s'est inscrit"})
    for u in User.objects.filter(is_staff=False, last_login__isnull=False).order_by("-last_login")[:limit]:
        events.append({"type": "login", "at": u.last_login, "user_id": u.pk, "username": u.username, "text": "s'est connecté"})
    recent = (
        Transaction.objects.filter(activity__owner__is_staff=False)
        .select_related("activity__owner").order_by("-created_at")[:limit]
    )
    for t in recent:
        events.append({
            "type": "operation", "at": t.created_at, "user_id": t.activity.owner_id, "username": t.activity.owner.username,
            "text": f"{t.get_kind_display()} · {t.activity.name}", "amount": str(t.amount), "currency": t.currency_id,
            "direction": t.direction, "voided": t.voided_at is not None,
        })
    events.sort(key=lambda e: e["at"], reverse=True)
    return events[:limit]


def _last_backup() -> dict | None:
    try:
        dumps = [os.path.join(BACKUP_DIR, f) for f in os.listdir(BACKUP_DIR) if f.endswith(".dump")]
    except OSError:
        return None
    if not dumps:
        return {"at": None, "size": 0, "count": 0}
    newest = max(dumps, key=os.path.getmtime)
    return {
        "at": datetime.fromtimestamp(os.path.getmtime(newest), tz=timezone.get_current_timezone()),
        "size": os.path.getsize(newest),
        "count": len(dumps),
        "name": os.path.basename(newest),
    }


def health() -> dict:
    disk = shutil.disk_usage("/")
    db_size = None
    if connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_database_size(current_database())")
            db_size = cursor.fetchone()[0]
    return {
        "disk": {"total": disk.total, "used": disk.used, "free": disk.free},
        "database_size": db_size,
        "backup": _last_backup(),
        "rates": rates_freshness(),
        "email_configured": bool(getattr(settings, "EMAIL_HOST", "")) and "smtp" in settings.EMAIL_BACKEND,
        "debug": settings.DEBUG,
        "server_time": timezone.now(),
    }


def log(admin, action: str, target_user=None, target: str = "", **details) -> AdminAction:
    return AdminAction.objects.create(
        admin=admin, action=action, target_user=target_user,
        target=target or (target_user.username if target_user else ""), details=details,
    )
