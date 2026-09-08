"""Vérifie le réapprovisionnement à crédit avec acompte (symétrique à la
vente à crédit) : achat enregistré en dette totale, acompte encaissé tout de
suite, solde restant réglable plus tard — partiellement ou en totalité.
Transaction annulée à la fin — aucune donnée conservée.

    .venv\\Scripts\\python.exe scripts\\smoke_purchase_credit.py
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
        {"username": "purchasecredit", "password": "MotDePasse123", "email": "purchasecredit@example.com", "base_currency": "GNF"},
        format="json",
    )
    token = c.post("/api/auth/token/", {"username": "purchasecredit", "password": "MotDePasse123"}, format="json").json()["access"]
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    act = c.post(
        "/api/activities/",
        {"name": "Boutique", "type": "commerce", "currency": "GNF", "has_inventory": True, "has_debts": True},
        format="json",
    ).json()
    product = c.post(
        "/api/products/",
        {"activity": act["id"], "name": "Sac de riz", "unit": "sac", "sale_price": "50000"},
        format="json",
    ).json()
    supplier = c.post("/api/parties/", {"name": "Grossiste Aliou", "kind": "supplier"}, format="json").json()

    # ---- 1) Réappro à crédit de 300 000 (10 sacs à 30000) avec acompte de 200 000 ----
    r = c.post(
        "/api/purchases/",
        {
            "product": product["id"], "quantity": "10", "unit_cost": "30000",
            "is_credit": True, "amount_paid_now": "200000", "party": supplier["id"],
            "occurred_on": "2026-09-07",
        },
        format="json",
    )
    print("réappro à crédit avec acompte:", r.status_code)
    assert r.status_code == 201
    txn = r.json()["transaction"]
    print("montant:", txn["amount"], "réglé:", txn["settled_amount"], "reste:", txn["remaining_amount"])
    assert txn["amount"] == "300000.00"
    assert txn["settled_amount"] == "200000.00"
    assert txn["remaining_amount"] == "100000.00"
    assert txn["is_settled"] is False
    purchase_id = txn["id"]

    r = c.get(f"/api/parties/{supplier['id']}/")
    print("solde fournisseur après acompte:", r.json()["balance"], "(attendu -100000.00, je lui dois)")
    assert r.json()["balance"] == "-100000.00"

    r = c.get(f"/api/reports/activity/{act['id']}/?period=month&date=2026-09-07")
    j = r.json()
    print("caisse:", j["cash_balance"], "(attendu -200000, seul l'acompte a vraiment été payé)")
    assert j["cash_balance"] == "-200000.00"
    print("  -> achat total en dette, seule la caisse de l'acompte bouge : OK")

    # ---- 2) Tentative de régler plus que le reste dû ----
    r = c.post(f"/api/transactions/{purchase_id}/settle/", {"amount": "150000"}, format="json")
    print("règlement de 150000 (> reste dû 100000):", r.status_code)
    assert r.status_code == 400

    # ---- 3) Annulation bloquée tant qu'un règlement (même partiel) existe ----
    r = c.post(f"/api/transactions/{purchase_id}/void/", {"reason": "test"}, format="json")
    print("annulation de l'achat partiellement réglé:", r.status_code)
    assert r.status_code == 400

    # ---- 4) Règlement du solde restant (100 000) ----
    r = c.post(f"/api/transactions/{purchase_id}/settle/", {}, format="json")
    print("règlement du solde restant:", r.status_code, r.json()["amount"])
    assert r.status_code == 201
    assert r.json()["amount"] == "100000.00"

    r = c.get(f"/api/parties/{supplier['id']}/")
    print("solde fournisseur après règlement complet:", r.json()["balance"], "(attendu 0.00)")
    assert r.json()["balance"] == "0.00"

    r = c.get(f"/api/reports/activity/{act['id']}/?period=month&date=2026-09-07")
    print("caisse après règlement complet:", r.json()["cash_balance"], "(attendu -300000)")
    assert r.json()["cash_balance"] == "-300000.00"
    print("  -> dette soldée en deux fois (acompte + règlement), caisse cohérente : OK")

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
