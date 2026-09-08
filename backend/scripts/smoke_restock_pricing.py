"""Vérifie le coût de revient (prix d'achat + frais annexes répartis) et la
mise à jour du prix de vente au réapprovisionnement. Transaction annulée à la
fin — aucune donnée conservée.

    .venv\\Scripts\\python.exe scripts\\smoke_restock_pricing.py
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
        {"username": "restockpricing", "password": "MotDePasse123", "email": "restockpricing@example.com", "base_currency": "GNF"},
        format="json",
    )
    token = c.post("/api/auth/token/", {"username": "restockpricing", "password": "MotDePasse123"}, format="json").json()["access"]
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    act = c.post(
        "/api/activities/",
        {"name": "Boutique", "type": "commerce", "currency": "GNF", "has_inventory": True},
        format="json",
    ).json()
    # Pas de prix de vente à la création : on ne le connaît pas encore.
    product = c.post(
        "/api/products/",
        {"activity": act["id"], "name": "Sac de riz", "unit": "sac"},
        format="json",
    ).json()
    print("prix de vente à la création:", product["sale_price"], "(attendu 0.00)")
    assert product["sale_price"] == "0.00"

    # ---- 1) Réappro de 10 sacs à 30000, + 20000 de frais de transport pour le lot ----
    # Coût de revient attendu : 30000 + 20000/10 = 32000 / unité.
    # Marge souhaitée 25% -> prix de vente proposé = 32000 * 1.25 = 40000.
    r = c.post(
        "/api/purchases/",
        {
            "product": product["id"], "quantity": "10", "unit_cost": "30000", "extra_fees": "20000",
            "sale_price": "40000", "occurred_on": "2026-09-08",
        },
        format="json",
    )
    print("réappro avec frais:", r.status_code)
    assert r.status_code == 201
    j = r.json()
    print("coût moyen (doit inclure les frais):", j["product"]["purchase_price"], "(attendu 32000.00)")
    assert j["product"]["purchase_price"] == "32000.00"
    print("prix de vente mis à jour:", j["product"]["sale_price"], "(attendu 40000.00)")
    assert j["product"]["sale_price"] == "40000.00"

    r = c.get(f"/api/reports/activity/{act['id']}/?period=month&date=2026-09-08")
    j = r.json()
    print("caisse (doit inclure marchandise + frais = -320000):", j["cash_balance"])
    assert j["cash_balance"] == "-320000.00"
    print("  -> frais annexes capitalisés dans le coût moyen ET dans la sortie de caisse : OK")

    # ---- 2) Deuxième réappro à un coût différent, sans toucher au prix de vente ----
    # 5 sacs à 34000, sans frais -> nouveau coût moyen = (10*32000 + 5*34000) / 15 = 32666.67
    r = c.post(
        "/api/purchases/",
        {"product": product["id"], "quantity": "5", "unit_cost": "34000", "occurred_on": "2026-09-08"},
        format="json",
    )
    assert r.status_code == 201
    j = r.json()
    print("coût moyen après 2e réappro:", j["product"]["purchase_price"], "(attendu 32666.67)")
    assert j["product"]["purchase_price"] == "32666.67"
    print("prix de vente inchangé (pas fourni cette fois):", j["product"]["sale_price"], "(attendu 40000.00)")
    assert j["product"]["sale_price"] == "40000.00"

    # ---- 3) Annulation du 2e réappro : restaure exactement le coût moyen précédent ----
    txn_id = j["transaction"]["id"]
    r = c.post(f"/api/transactions/{txn_id}/void/", {"reason": "test"}, format="json")
    assert r.status_code == 200
    r = c.get(f"/api/products/{product['id']}/")
    print("coût moyen après annulation du 2e réappro:", r.json()["purchase_price"], "(attendu 32000.00, restauré)")
    assert r.json()["purchase_price"] == "32000.00"
    print("  -> annulation restaure le coût de revient d'origine (avec ses frais) : OK")

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
