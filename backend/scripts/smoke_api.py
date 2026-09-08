"""Test des endpoints HTTP via le client DRF (transaction annulée à la fin).

    .venv\\Scripts\\python.exe scripts\\smoke_api.py
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

    r = c.post(
        "/api/auth/register/",
        {"username": "apitest_x", "password": "MotDePasse123", "email": "apitest_x@example.com", "base_currency": "GNF"},
        format="json",
    )
    print("register:", r.status_code, r.json())

    r = c.post(
        "/api/auth/token/",
        {"username": "apitest_x", "password": "MotDePasse123"},
        format="json",
    )
    token = r.json()["access"]
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    print("token: ok")

    r = c.get("/api/auth/me/")
    print("me:", r.status_code, r.json())

    r = c.get("/api/categories/")
    print("catégories par défaut:", r.status_code, r.json()["count"])

    r = c.get("/api/currencies/")
    print("currencies:", r.status_code, [x["code"] for x in r.json()])

    r = c.get("/api/convert/?amount=250000&from=GNF&to=USD")
    print("convert:", r.status_code, r.json())

    r = c.post(
        "/api/activities/",
        {"name": "Kiosque", "type": "commerce", "currency": "GNF", "has_inventory": True},
        format="json",
    )
    act = r.json()
    print("activity:", r.status_code, act["id"], act["name"])

    r = c.post(
        "/api/products/",
        {"activity": act["id"], "name": "Bidon d'huile 5L", "sale_price": "80000", "low_stock_threshold": "5"},
        format="json",
    )
    prod = r.json()
    print("product:", r.status_code, prod["id"])

    r = c.post(
        "/api/purchases/",
        {"product": prod["id"], "quantity": "10", "unit_cost": "62000"},
        format="json",
    )
    print("purchase:", r.status_code, r.json()["product"])

    r = c.post(
        "/api/sales/",
        {"activity": act["id"], "lines": [{"product": prod["id"], "quantity": "3", "unit_price": "80000"}]},
        format="json",
    )
    print("sale (prix explicite):", r.status_code, r.json().get("amount"), r.json().get("kind"))

    # cas réel des apps mobile/web : pas de unit_price envoyé -> doit retomber
    # sur le prix de vente du produit, pas planter (régression du 07/09/2026).
    r = c.post(
        "/api/sales/",
        {"activity": act["id"], "lines": [{"product": prod["id"], "quantity": "1"}]},
        format="json",
    )
    print("sale (prix par défaut):", r.status_code, r.json().get("amount"), r.json().get("kind"))
    assert r.status_code == 201, f"la vente sans unit_price explicite a échoué : {r.content!r}"

    r = c.get(f"/api/reports/activity/{act['id']}/?period=month&currency=USD")
    print("report activity (affichage USD):", r.status_code)
    for k in ("revenue", "cogs", "gross_margin", "net_profit", "stock_value",
              "source_currency", "display_currency", "converted"):
        print(f"   {k}: {r.json().get(k)}")

    r = c.get("/api/reports/global/?period=month")
    j = r.json()
    print("report global:", r.status_code, "net_profit:", j.get("net_profit"), "patrimoine:", j.get("patrimoine"))

    r = c.get("/api/products/?activity=%s&low_stock=1" % act["id"])
    print("produits stock faible:", r.status_code, r.json()["count"])

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
