"""Vérifie la consommation personnelle de marchandise : le stock baisse au
coût moyen, mais ça ne touche ni le CA, ni les charges, ni la caisse — juste
une ligne d'info séparée (`personal_use`). Annulation testée aussi.
Transaction annulée à la fin — aucune donnée conservée.

    .venv\\Scripts\\python.exe scripts\\smoke_personal_use.py
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
        {"username": "persouse", "password": "MotDePasse123", "email": "persouse@example.com", "base_currency": "GNF"},
        format="json",
    )
    token = c.post("/api/auth/token/", {"username": "persouse", "password": "MotDePasse123"}, format="json").json()["access"]
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    act = c.post(
        "/api/activities/",
        {"name": "Boutique", "type": "commerce", "currency": "GNF", "has_inventory": True},
        format="json",
    ).json()
    product = c.post(
        "/api/products/",
        {"activity": act["id"], "name": "Sac de riz", "unit": "sac", "sale_price": "50000"},
        format="json",
    ).json()
    c.post(
        "/api/purchases/",
        {"product": product["id"], "quantity": "20", "unit_cost": "30000", "occurred_on": "2026-09-07"},
        format="json",
    )

    # ---- 1) Consommation personnelle de 2 sacs ----
    r = c.post(
        "/api/personal-use/",
        {"product": product["id"], "quantity": "2", "occurred_on": "2026-09-07", "note": "pour la maison"},
        format="json",
    )
    print("consommation personnelle:", r.status_code)
    assert r.status_code == 201
    j = r.json()
    txn_id = j["transaction"]["id"]
    print("montant (au coût):", j["transaction"]["amount"], "(attendu 60000.00 = 2 x 30000)")
    assert j["transaction"]["amount"] == "60000.00"
    assert j["transaction"]["kind"] == "personal_use"
    print("stock après:", j["product"]["stock_quantity"], "(attendu 18.000)")
    assert j["product"]["stock_quantity"] == "18.000"

    r = c.get(f"/api/products/{product['id']}/")
    print("coût moyen après consommation (doit rester 30000, inchangé):", r.json()["purchase_price"])
    assert r.json()["purchase_price"] == "30000.00"

    r = c.get(f"/api/reports/activity/{act['id']}/?period=month&date=2026-09-07")
    j = r.json()
    print("CA:", j["revenue"], "charges:", j["expenses"], "caisse:", j["cash_balance"], "consommé perso:", j["personal_use"])
    assert j["revenue"] == "0.00"
    assert j["expenses"] == "0.00"
    # caisse : -600000 (réappro de 20 sacs à 30000) uniquement, la conso perso n'y touche pas
    assert j["cash_balance"] == "-600000.00"
    assert j["personal_use"] == "60000.00"
    print("  -> conso perso hors CA/charges/caisse, visible séparément : OK")

    # ---- 2) Refus si quantité > stock disponible ----
    r = c.post("/api/personal-use/", {"product": product["id"], "quantity": "9999"}, format="json")
    print("conso perso > stock disponible:", r.status_code)
    assert r.status_code == 400
    print("  -> refusé comme prévu : OK")

    # ---- 3) Annulation restaure le stock (coût moyen inchangé) ----
    r = c.post(f"/api/transactions/{txn_id}/void/", {"reason": "test annulation"}, format="json")
    print("annulation de la conso perso:", r.status_code)
    assert r.status_code == 200

    r = c.get(f"/api/products/{product['id']}/")
    j = r.json()
    print("stock après annulation:", j["stock_quantity"], "(attendu 20.000, restauré) coût moyen:", j["purchase_price"])
    assert j["stock_quantity"] == "20.000"
    assert j["purchase_price"] == "30000.00"

    r = c.get(f"/api/reports/activity/{act['id']}/?period=month&date=2026-09-07")
    j = r.json()
    print("consommé perso après annulation:", j["personal_use"], "(attendu 0.00)")
    assert j["personal_use"] == "0.00"
    print("  -> annulation restaure le stock et sort la conso perso du rapport : OK")

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
