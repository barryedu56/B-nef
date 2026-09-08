"""Vérifie l'export PDF du compte de résultat (fichier réel, pas une
impression de navigateur) — activité seule et vue consolidée.
Transaction annulée à la fin — aucune donnée conservée.

    .venv\\Scripts\\python.exe scripts\\smoke_report_pdf.py
"""
import os
import sys
from pathlib import Path

import django

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ["DJANGO_ALLOWED_HOSTS"] = "localhost,127.0.0.1,testserver"
django.setup()

from django.db import transaction  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402


class _Rollback(Exception):
    pass


def body():
    c = APIClient()
    c.post(
        "/api/auth/register/",
        {"username": "pdftest", "password": "MotDePasse123", "email": "pdftest@example.com", "base_currency": "GNF"},
        format="json",
    )
    token = c.post("/api/auth/token/", {"username": "pdftest", "password": "MotDePasse123"}, format="json").json()["access"]
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    act = c.post(
        "/api/activities/",
        {"name": "Boutique", "type": "commerce", "currency": "GNF"},
        format="json",
    ).json()
    c.post(
        "/api/transactions/",
        {"activity": act["id"], "direction": "in", "amount": "150000", "currency": "GNF", "occurred_on": "2026-09-07", "kind": "simple"},
        format="json",
    )

    r = c.get(f"/api/reports/pdf/?activity={act['id']}&period=month&date=2026-09-07")
    print("PDF activité:", r.status_code, r["Content-Type"], len(r.content), "octets")
    assert r.status_code == 200
    assert r["Content-Type"] == "application/pdf"
    assert r.content[:4] == b"%PDF"
    assert "attachment" in r["Content-Disposition"]
    assert len(r.content) > 500
    print("  -> PDF activité valide : OK")

    r = c.get("/api/reports/pdf/?period=month&date=2026-09-07")
    print("PDF consolidé:", r.status_code, len(r.content), "octets")
    assert r.status_code == 200
    assert r.content[:4] == b"%PDF"
    print("  -> PDF consolidé valide : OK")

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
