"""Vérifie la validation des numéros de téléphone guinéens (9 chiffres,
préfixe 61/62/65/66) — au niveau API (inscription, tiers) ET au niveau
modèle (donc aussi dans l'admin Django, qui appelle `full_clean()`).
Transaction annulée à la fin — aucune donnée conservée.

    .venv\\Scripts\\python.exe scripts\\smoke_phone_validation.py
"""
import os
import sys
from pathlib import Path

import django

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ["DJANGO_ALLOWED_HOSTS"] = "localhost,127.0.0.1,testserver"
django.setup()

from django.core.exceptions import ValidationError as DjangoValidationError  # noqa: E402
from django.db import transaction  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from apps.contacts.models import Party  # noqa: E402


class _Rollback(Exception):
    pass


def body():
    c = APIClient()

    # ---- 1) Inscription : numéro valide, avec espaces -> normalisé ----
    r = c.post(
        "/api/auth/register/",
        {
            "username": "phonetest", "password": "MotDePasse123", "email": "phonetest@example.com",
            "base_currency": "GNF", "phone": "622 12 34 56",
        },
        format="json",
    )
    print("inscription avec numéro valide (espacé):", r.status_code, r.json().get("phone"))
    assert r.status_code == 201
    assert r.json()["phone"] == "622123456"

    token = c.post("/api/auth/token/", {"username": "phonetest", "password": "MotDePasse123"}, format="json").json()["access"]
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    # ---- 2) Inscription refusée : mauvais préfixe ----
    r = c.post(
        "/api/auth/register/",
        {"username": "phonebad", "password": "MotDePasse123", "email": "phonebad@example.com", "base_currency": "GNF", "phone": "722123456"},
        format="json",
    )
    print("inscription avec préfixe invalide (72):", r.status_code)
    assert r.status_code == 400

    # ---- 3) Inscription refusée : mauvaise longueur ----
    r = c.post(
        "/api/auth/register/",
        {"username": "phoneshort", "password": "MotDePasse123", "email": "phoneshort@example.com", "base_currency": "GNF", "phone": "62212345"},
        format="json",
    )
    print("inscription avec 8 chiffres seulement:", r.status_code)
    assert r.status_code == 400

    # ---- 4) Tiers : numéro valide avec tirets -> normalisé ----
    r = c.post("/api/parties/", {"name": "Fatou", "kind": "client", "phone": "65-12-34-567"}, format="json")
    print("tiers avec numéro valide (tirets):", r.status_code, r.json().get("phone"))
    assert r.status_code == 201
    assert r.json()["phone"] == "651234567"

    # ---- 5) Tiers refusé : préfixe inexistant ----
    r = c.post("/api/parties/", {"name": "Mauvais", "kind": "client", "phone": "630123456"}, format="json")
    print("tiers avec préfixe 63 (non actif):", r.status_code)
    assert r.status_code == 400

    # ---- 6) Téléphone facultatif : vide toujours accepté ----
    r = c.post("/api/parties/", {"name": "Sans numéro", "kind": "client"}, format="json")
    print("tiers sans numéro:", r.status_code)
    assert r.status_code == 201

    # ---- 7) Niveau modèle (couvre l'admin Django, qui appelle full_clean()) ----
    p = Party(owner_id=c.get("/api/auth/me/").json()["id"], name="Test admin", phone="66 99 88 77 6")
    p.full_clean()
    print("full_clean() niveau modèle normalise aussi:", p.phone)
    assert p.phone == "669988776"

    bad = Party(owner_id=p.owner_id, name="Test admin invalide", phone="12345")
    try:
        bad.full_clean()
        raise AssertionError("aurait dû lever une ValidationError")
    except DjangoValidationError:
        print("  -> full_clean() refuse bien un numéro invalide (comme le ferait l'admin) : OK")

    print("\nOK — transaction annulée (aucune donnée conservée).")


def main():
    try:
        with transaction.atomic():
            body()
            raise _Rollback
    except _Rollback:
        pass


if __name__ == "__main__":
    main()
