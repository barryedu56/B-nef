"""Interface d'administration (pour le propriétaire de Bénef) : titre,
limite d'essais de connexion, et outils partagés par les admin.py."""
from __future__ import annotations

from django.conf import settings
from django.contrib import admin
from django.core.cache import cache
from django.shortcuts import render

MAX_LOGIN_ATTEMPTS = 10
LOCK_SECONDS = 15 * 60


class ReadOnlyAdmin(admin.ModelAdmin):
    """Consultation seulement : une opération, un mouvement de stock ou une
    ligne de vente modifiés à la main fausseraient les soldes et le stock.
    Les corrections se font depuis l'app (annulation, inventaire…)."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


def _client_ip(request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return forwarded.split(",")[0].strip() or request.META.get("REMOTE_ADDR", "")


def setup_admin_site() -> None:
    site = admin.site
    site.site_header = "Bénef — Administration"
    site.site_title = "Bénef admin"
    site.index_title = "Tableau de bord"
    site.site_url = getattr(settings, "ADMIN_SITE_URL", "/")

    original_login = site.login

    def throttled_login(request, extra_context=None):
        """Au plus 10 essais de mot de passe ratés par adresse IP en 15 min."""
        key = f"admin-login:{_client_ip(request)}"
        if request.method == "POST" and cache.get(key, 0) >= MAX_LOGIN_ATTEMPTS:
            return render(
                request, "admin/login_locked.html", {"site_header": site.site_header, "minutes": LOCK_SECONDS // 60},
                status=429,
            )
        response = original_login(request, extra_context)
        if request.method == "POST":
            if response.status_code == 302:  # connecté
                cache.delete(key)
            else:
                cache.set(key, cache.get(key, 0) + 1, LOCK_SECONDS)
        return response

    site.login = throttled_login
