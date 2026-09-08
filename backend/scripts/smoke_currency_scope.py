"""Verifie que le tableau de bord d'une activite reste dans sa devise
meme si l'utilisateur a choisi une devise d'affichage globale differente.
"""
import os, sys
from pathlib import Path
import django

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ["DJANGO_ALLOWED_HOSTS"] = "localhost,127.0.0.1,testserver"
django.setup()

from django.db import transaction
from rest_framework.test import APIClient


class _Rollback(Exception):
    pass


def body():
    c = APIClient()
    c.post(
        "/api/auth/register/",
        {"username": "curscope", "password": "MotDePasse123", "email": "curscope@example.com", "base_currency": "GNF"},
        format="json",
    )
    token = c.post("/api/auth/token/", {"username": "curscope", "password": "MotDePasse123"}, format="json").json()["access"]
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    # L'utilisateur choisit d'afficher sa vue globale en USD.
    c.patch("/api/auth/me/", {"display_currency": "USD"}, format="json")

    act = c.post("/api/activities/", {"name": "Salaire", "type": "salary", "currency": "XOF"}, format="json").json()
    c.post("/api/transactions/", {
        "activity": act["id"], "direction": "in", "amount": "100000", "currency": "XOF",
        "occurred_on": "2026-09-07", "kind": "simple",
    }, format="json")

    r = c.get(f"/api/reports/activity/{act['id']}/?period=month")
    j = r.json()
    print("Activite (sans ?currency=) ->", j["currency"], "converted:", j["converted"], "(attendu: XOF, False)")
    assert j["currency"] == "XOF" and j["converted"] is False, "La devise de l'activite doit primer par defaut"

    r2 = c.get("/api/reports/global/?period=month")
    j2 = r2.json()
    print("Global (sans ?currency=) ->", j2["currency"], "(attendu: USD, la preference utilisateur)")
    assert j2["currency"] == "USD", "La vue globale doit respecter la devise d'affichage de l'utilisateur"

    print("\nOK")


def main():
    try:
        with transaction.atomic():
            body()
            raise _Rollback
    except _Rollback:
        pass


if __name__ == "__main__":
    main()
