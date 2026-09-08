"""Vérifie le règlement PARTIEL d'une créance : acompte versé à la vente,
règlement partiel ultérieur, cumul, garde-fous (dépassement, double
règlement, annulation bloquée tant qu'un règlement existe). Transaction
annulée à la fin — aucune donnée conservée.

    .venv\\Scripts\\python.exe scripts\\smoke_partial_settle.py
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
        {"username": "partialtest", "password": "MotDePasse123", "email": "partialtest@example.com", "base_currency": "GNF"},
        format="json",
    )
    token = c.post("/api/auth/token/", {"username": "partialtest", "password": "MotDePasse123"}, format="json").json()["access"]
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
    c.post(
        "/api/purchases/",
        {"product": product["id"], "quantity": "10", "unit_cost": "30000", "occurred_on": "2026-09-07"},
        format="json",
    )
    client = c.post("/api/parties/", {"name": "Mamadou", "kind": "client"}, format="json").json()

    # ---- 1) Vente à crédit de 100 000 avec acompte de 80 000 ----
    sale = c.post(
        "/api/sales/",
        {
            "activity": act["id"],
            "lines": [{"product": product["id"], "quantity": "2"}],  # 2 x 50000 = 100000
            "is_credit": True,
            "amount_paid_now": "80000",
            "party": client["id"],
            "occurred_on": "2026-09-07",
        },
        format="json",
    ).json()
    print("vente à crédit avec acompte:", sale["amount"], "réglé:", sale["settled_amount"], "reste:", sale["remaining_amount"])
    assert sale["amount"] == "100000.00"
    assert sale["settled_amount"] == "80000.00"
    assert sale["remaining_amount"] == "20000.00"
    assert sale["is_settled"] is False

    r = c.get(f"/api/parties/{client['id']}/")
    print("solde client après acompte:", r.json()["balance"], "(attendu 20000.00)")
    assert r.json()["balance"] == "20000.00"

    r = c.get(f"/api/reports/activity/{act['id']}/?period=month&date=2026-09-07")
    j = r.json()
    # Réappro de 10 sacs à 30000 = -300000 en caisse, + l'acompte de 80000 encaissé = -220000.
    print("CA:", j["revenue"], "caisse:", j["cash_balance"], "(CA=100000 entier, caisse=-220000 = -300000 réappro + 80000 acompte)")
    assert j["revenue"] == "100000.00"
    assert j["cash_balance"] == "-220000.00"
    print("  -> vente comptée en entier au CA, mais seule la caisse encaissée bouge en trésorerie : OK")

    # ---- 2) Tentative de régler plus que le reste dû ----
    r = c.post(f"/api/transactions/{sale['id']}/settle/", {"amount": "50000"}, format="json")
    print("règlement de 50000 (> reste dû 20000):", r.status_code)
    assert r.status_code == 400
    print("  -> refusé comme prévu (dépasse le solde) : OK")

    # ---- 3) Annulation de la vente bloquée tant qu'il y a un règlement (même partiel) ----
    r = c.post(f"/api/transactions/{sale['id']}/void/", {"reason": "test"}, format="json")
    print("annulation de la vente partiellement réglée:", r.status_code)
    assert r.status_code == 400
    print("  -> refusée comme prévu (règlement partiel existant) : OK")

    # ---- 4) Règlement du solde restant (20 000) ----
    r = c.post(f"/api/transactions/{sale['id']}/settle/", {}, format="json")  # pas de montant -> tout le reste
    print("règlement du solde restant (sans montant précisé):", r.status_code, r.json()["amount"])
    assert r.status_code == 201
    assert r.json()["amount"] == "20000.00"

    r = c.get(f"/api/transactions/{sale['id']}/")
    j = r.json()
    print("vente après règlement complet — réglé:", j["settled_amount"], "reste:", j["remaining_amount"], "is_settled:", j["is_settled"])
    assert j["settled_amount"] == "100000.00"
    assert j["remaining_amount"] == "0.00"
    assert j["is_settled"] is True

    r = c.get(f"/api/parties/{client['id']}/")
    assert r.json()["balance"] == "0.00"

    r = c.get(f"/api/reports/activity/{act['id']}/?period=month&date=2026-09-07")
    assert r.json()["cash_balance"] == "-200000.00"  # -300000 réappro + 100000 encaissé en tout
    print("  -> entièrement réglé : caisse = -300000 + 100000 = -200000, solde tiers = 0 : OK")

    # ---- 5) Nouveau règlement refusé (déjà tout réglé) ----
    r = c.post(f"/api/transactions/{sale['id']}/settle/", {}, format="json")
    print("nouveau règlement sur une vente déjà entièrement réglée:", r.status_code)
    assert r.status_code == 400

    # ---- 6) Annuler le DERNIER règlement (20000) : le solde partiel doit revenir ----
    last_settlement_id = c.get(f"/api/transactions/?settles={sale['id']}&ordering=-created_at").json()["results"][0]["id"]
    r = c.post(f"/api/transactions/{last_settlement_id}/void/", {"reason": "annulation test"}, format="json")
    print("annulation du dernier règlement (20000):", r.status_code)
    assert r.status_code == 200

    r = c.get(f"/api/transactions/{sale['id']}/")
    j = r.json()
    print("vente après annulation du dernier règlement — réglé:", j["settled_amount"], "reste:", j["remaining_amount"])
    assert j["settled_amount"] == "80000.00"
    assert j["remaining_amount"] == "20000.00"
    assert j["is_settled"] is False

    r = c.get(f"/api/parties/{client['id']}/")
    print("solde client après annulation du dernier règlement:", r.json()["balance"], "(attendu 20000.00 à nouveau)")
    assert r.json()["balance"] == "20000.00"
    print("  -> annulation d'un règlement partiel restaure exactement le solde partiel précédent : OK")

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
