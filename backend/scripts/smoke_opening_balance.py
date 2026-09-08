"""Vérifie qu'un solde initial de tiers (kind=opening_balance) compte dans le
solde du tiers mais jamais dans le CA/les charges/la caisse tant qu'il n'est
pas réglé. Transaction annulée à la fin.

    .venv\\Scripts\\python.exe scripts\\smoke_opening_balance.py
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
        {"username": "openbaltest", "password": "MotDePasse123", "email": "openbaltest@example.com", "base_currency": "GNF"},
        format="json",
    )
    token = c.post("/api/auth/token/", {"username": "openbaltest", "password": "MotDePasse123"}, format="json").json()["access"]
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    act = c.post(
        "/api/activities/",
        {"name": "Boutique", "type": "commerce", "currency": "GNF", "has_debts": True},
        format="json",
    ).json()
    client = c.post("/api/parties/", {"name": "Fatou Ndiaye", "kind": "client", "phone": "622000000"}, format="json").json()

    # Fatou me devait déjà 40 000 avant d'utiliser l'app.
    r = c.post(
        "/api/transactions/",
        {
            "activity": act["id"], "direction": "in", "amount": "40000", "currency": "GNF",
            "occurred_on": "2026-01-01", "kind": "opening_balance", "is_credit": True, "party": client["id"],
        },
        format="json",
    )
    print("création solde initial:", r.status_code, r.json().get("kind"))
    assert r.status_code == 201

    r = c.get(f"/api/parties/{client['id']}/")
    print("solde du tiers:", r.json()["balance"], "(attendu 40000.00)")
    assert r.json()["balance"] == "40000.00"

    r = c.get(f"/api/reports/activity/{act['id']}/?period=month&date=2026-01-15")
    j = r.json()
    print("CA/charges/caisse du mois:", j["revenue"], j["expenses"], j["cash_balance"], "(attendus tous 0)")
    assert j["revenue"] == "0.00" and j["expenses"] == "0.00" and j["cash_balance"] == "0.00"
    print("  -> le solde initial ne pollue ni le CA ni les charges ni la caisse : OK")

    # Fatou règle sa dette -> la caisse bouge, le CA non.
    settlement_id = r = c.get(f"/api/transactions/?party={client['id']}&kind=opening_balance").json()["results"][0]["id"]
    r = c.post(f"/api/transactions/{settlement_id}/settle/", {}, format="json")
    print("règlement:", r.status_code)
    assert r.status_code == 201

    r = c.get(f"/api/parties/{client['id']}/")
    assert r.json()["balance"] == "0.00"
    r = c.get(f"/api/reports/activity/{act['id']}/?period=month&date=2026-01-15")
    j = r.json()
    print("après règlement — CA:", j["revenue"], "caisse:", j["cash_balance"], "(CA doit rester 0, caisse doit monter à 40000)")
    assert j["revenue"] == "0.00"
    assert j["cash_balance"] == "40000.00"
    print("  -> réglé : caisse mise à jour, CA toujours pas affecté : OK")

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
