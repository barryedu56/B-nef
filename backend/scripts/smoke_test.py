"""Test de bout en bout des services métier (transaction annulée à la fin).

    .venv\\Scripts\\python.exe scripts\\smoke_test.py
"""
import os
import sys
from decimal import Decimal
from pathlib import Path

import django

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model  # noqa: E402
from django.db import transaction  # noqa: E402

from apps.activities.models import Activity  # noqa: E402
from apps.currencies.services import convert, get_rate  # noqa: E402
from apps.finance.models import Transaction  # noqa: E402
from apps.finance.services import create_transaction  # noqa: E402
from apps.inventory.models import Product  # noqa: E402
from apps.inventory.services import register_sale, restock  # noqa: E402
from apps.reports import services as reports  # noqa: E402

User = get_user_model()


class _Rollback(Exception):
    pass


def body():
    user = User.objects.create_user("demo_x", password="demo12345", base_currency_id="GNF")
    print("Utilisateur:", user, "| devise principale:", user.base_currency_id)

    print("Taux GNF->USD:", get_rate("GNF", "USD"))
    print("100 000 GNF ->", convert(Decimal("100000"), "GNF", "USD"), "USD")
    print("100 000 GNF ->", convert(Decimal("100000"), "GNF", "XOF"), "XOF")

    boutique = Activity.objects.create(
        owner=user, name="Boutique du marché", type=Activity.Type.COMMERCE,
        currency_id="GNF", has_inventory=True, has_debts=True, opening_balance=Decimal("500000"),
    )
    riz = Product.objects.create(
        activity=boutique, name="Sac de riz 25kg", sale_price=Decimal("150000")
    )

    restock(product=riz, quantity=Decimal("20"), unit_cost=Decimal("120000"))
    riz.refresh_from_db()
    print(f"\nAprès réappro : stock={riz.stock_quantity}  coût moyen={riz.purchase_price}")

    sale = register_sale(
        activity=boutique,
        lines=[{"product": riz.pk, "quantity": Decimal("8"), "unit_price": Decimal("150000")}],
    )
    riz.refresh_from_db()
    print(f"Après vente   : stock={riz.stock_quantity}  vente={sale.amount} {sale.currency_id}")

    create_transaction(
        activity=boutique, direction=Transaction.Direction.OUT, amount=Decimal("35000"),
        currency="GNF", occurred_on=sale.occurred_on, kind=Transaction.Kind.SIMPLE, note="Transport",
    )

    salaire = Activity.objects.create(
        owner=user, name="Salaire", type=Activity.Type.SALARY, currency_id="XOF",
    )
    create_transaction(
        activity=salaire, direction=Transaction.Direction.IN, amount=Decimal("400000"),
        currency="XOF", occurred_on=sale.occurred_on, kind=Transaction.Kind.SIMPLE, note="Salaire",
    )

    s = reports.activity_summary(boutique, "month")
    print("\n--- Résumé boutique (devise activité : GNF) ---")
    for k, v in s.as_dict().items():
        print(f"  {k}: {v}")

    g = reports.global_summary(user, "month")
    print("\n--- Résumé global (devise principale : GNF) ---")
    for k, v in g.as_dict().items():
        print(f"  {k}: {v}")

    print("\n--- Ventilation par activité ---")
    for row in reports.per_activity_breakdown(user, "month"):
        print("  ", row)

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
