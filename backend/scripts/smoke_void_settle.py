"""Vérifie l'annulation et le règlement de transactions (comptabilité :
rien n'est jamais supprimé, tout est réparé proprement). Transaction annulée
à la fin — aucune donnée conservée.

    .venv\\Scripts\\python.exe scripts\\smoke_void_settle.py
"""
import os
import sys
from decimal import Decimal
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
        {"username": "voidtest", "password": "MotDePasse123", "email": "voidtest@example.com", "base_currency": "GNF"},
        format="json",
    )
    token = c.post("/api/auth/token/", {"username": "voidtest", "password": "MotDePasse123"}, format="json").json()["access"]
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    act = c.post(
        "/api/activities/",
        {"name": "Boutique", "type": "commerce", "currency": "GNF", "has_inventory": True, "has_debts": True},
        format="json",
    ).json()

    # ---- 1) Annuler une opération simple ----
    txn = c.post(
        "/api/transactions/",
        {"activity": act["id"], "direction": "out", "amount": "5000", "currency": "GNF",
         "occurred_on": "2026-09-07", "kind": "simple", "note": "Transport"},
        format="json",
    ).json()
    r = c.get(f"/api/reports/activity/{act['id']}/?period=month&date=2026-09-07")
    assert r.json()["expenses"] == "5000.00", r.json()
    r = c.post(f"/api/transactions/{txn['id']}/void/", {"reason": "erreur de saisie"}, format="json")
    print("void opération simple:", r.status_code, r.json()["is_voided"])
    assert r.status_code == 200 and r.json()["is_voided"] is True
    r = c.get(f"/api/reports/activity/{act['id']}/?period=month&date=2026-09-07")
    assert r.json()["expenses"] == "0.00", f"la dépense annulée ne doit plus compter : {r.json()}"
    print("  -> exclue des charges : OK")

    r = c.post(f"/api/transactions/{txn['id']}/void/", {}, format="json")
    assert r.status_code == 400, "annuler deux fois doit échouer"
    print("  -> double annulation refusée : OK")

    r = c.delete(f"/api/transactions/{txn['id']}/")
    assert r.status_code == 405, "DELETE brut doit être refusé"
    print("  -> DELETE brut refusé (405) : OK")

    # ---- 2) Vente : annulation restaure le stock ----
    prod = c.post(
        "/api/products/", {"activity": act["id"], "name": "Sac de riz", "sale_price": "15000"}, format="json"
    ).json()
    c.post("/api/purchases/", {"product": prod["id"], "quantity": "20", "unit_cost": "12000"}, format="json")

    sale = c.post(
        "/api/sales/",
        {"activity": act["id"], "lines": [{"product": prod["id"], "quantity": "5"}]},
        format="json",
    ).json()
    prod_after_sale = c.get(f"/api/products/{prod['id']}/").json()
    assert prod_after_sale["stock_quantity"] == "15.000", prod_after_sale
    r = c.post(f"/api/transactions/{sale['id']}/void/", {"reason": "vente annulée par le client"}, format="json")
    print("void vente:", r.status_code)
    assert r.status_code == 200
    prod_after_void = c.get(f"/api/products/{prod['id']}/").json()
    print("  -> stock restauré :", prod_after_void["stock_quantity"], "(attendu 20.000)")
    assert prod_after_void["stock_quantity"] == "20.000"
    r = c.get(f"/api/reports/activity/{act['id']}/?period=month&date=2026-09-07")
    assert r.json()["revenue"] == "0.00", f"le CA de la vente annulée ne doit plus compter : {r.json()}"
    print("  -> exclue du chiffre d'affaires : OK")

    # ---- 3) Réappro le plus récent : annulation propre ----
    purchase2 = c.post(
        "/api/purchases/", {"product": prod["id"], "quantity": "10", "unit_cost": "13000"}, format="json"
    ).json()
    prod_mid = c.get(f"/api/products/{prod['id']}/").json()
    print("stock avant annulation réappro:", prod_mid["stock_quantity"], "coût moyen:", prod_mid["purchase_price"])
    r = c.post(f"/api/transactions/{purchase2['transaction']['id']}/void/", {}, format="json")
    print("void réappro le plus récent:", r.status_code)
    assert r.status_code == 200
    prod_final = c.get(f"/api/products/{prod['id']}/").json()
    print("  -> stock restauré:", prod_final["stock_quantity"], "(attendu 20.000) coût moyen:", prod_final["purchase_price"], "(attendu 12000.00)")
    assert prod_final["stock_quantity"] == "20.000"
    assert prod_final["purchase_price"] == "12000.00"

    # ---- 4) Réappro PAS le plus récent : annulation refusée ----
    purchase3 = c.post(
        "/api/purchases/", {"product": prod["id"], "quantity": "5", "unit_cost": "14000"}, format="json"
    ).json()
    c.post("/api/purchases/", {"product": prod["id"], "quantity": "5", "unit_cost": "16000"}, format="json")
    r = c.post(f"/api/transactions/{purchase3['transaction']['id']}/void/", {}, format="json")
    print("void réappro pas le plus récent:", r.status_code, r.json())
    assert r.status_code == 400, "annuler un réappro qui n'est plus le dernier mouvement doit être refusé"
    print("  -> refusé comme prévu (mouvements plus récents) : OK")

    # ---- 5) Règlement d'une vente à crédit ----
    client = c.post("/api/parties/", {"name": "Fatou Ndiaye", "kind": "client", "phone": "622000000"}, format="json").json()
    credit_sale = c.post(
        "/api/sales/",
        {"activity": act["id"], "lines": [{"product": prod["id"], "quantity": "2"}], "is_credit": True, "party": client["id"]},
        format="json",
    ).json()
    r = c.get(f"/api/parties/{client['id']}/")
    print("solde client avant règlement:", r.json()["balance"], "(attendu 30000.00)")
    assert r.json()["balance"] == "30000.00"

    r = c.post(f"/api/transactions/{credit_sale['id']}/settle/", {}, format="json")
    print("règlement:", r.status_code, r.json()["kind"], r.json()["amount"])
    assert r.status_code == 201
    r = c.get(f"/api/parties/{client['id']}/")
    print("solde client après règlement:", r.json()["balance"], "(attendu 0.00)")
    assert r.json()["balance"] == "0.00"

    r = c.get(f"/api/transactions/{credit_sale['id']}/")
    assert r.json()["is_settled"] is True

    # une vente déjà réglée ne peut pas être annulée directement
    r = c.post(f"/api/transactions/{credit_sale['id']}/void/", {}, format="json")
    assert r.status_code == 400, "une vente réglée doit d'abord voir son règlement annulé"
    print("  -> annulation d'une vente réglée refusée directement : OK")

    # ---- 6) Annuler le règlement remet la dette ----
    settlement_id = c.get(f"/api/transactions/?party={client['id']}&kind=settlement").json()["results"][0]["id"]
    r = c.post(f"/api/transactions/{settlement_id}/void/", {}, format="json")
    assert r.status_code == 200
    r = c.get(f"/api/parties/{client['id']}/")
    print("solde client après annulation du règlement:", r.json()["balance"], "(attendu 30000.00 à nouveau)")
    assert r.json()["balance"] == "30000.00"
    r = c.get(f"/api/transactions/{credit_sale['id']}/")
    assert r.json()["is_settled"] is False, "la vente doit redevenir non réglée"
    print("  -> dette rouverte : OK")

    # ---- 7) PATCH ne touche pas les champs financiers (sur une opération non annulée) ----
    other_txn = c.post(
        "/api/transactions/",
        {"activity": act["id"], "direction": "out", "amount": "5000", "currency": "GNF",
         "occurred_on": "2026-09-07", "kind": "simple", "note": "Électricité"},
        format="json",
    ).json()
    r = c.patch(f"/api/transactions/{other_txn['id']}/", {"note": "corrigé", "amount": "999999"}, format="json")
    print("PATCH avec tentative de changer le montant:", r.status_code, r.json().get("note"))
    assert r.status_code == 200
    r2 = c.get(f"/api/transactions/{other_txn['id']}/")
    assert r2.json()["amount"] == "5000.00", "le montant ne doit jamais changer via PATCH"
    assert r2.json()["note"] == "corrigé"
    print("  -> montant protégé, note modifiée : OK")

    # PATCH sur une opération annulée doit être refusé
    r = c.patch(f"/api/transactions/{txn['id']}/", {"note": "tentative"}, format="json")
    assert r.status_code == 400, "modifier une opération annulée doit être refusé"
    print("  -> PATCH sur opération annulée refusé : OK")

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
