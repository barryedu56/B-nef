"""Outils partagés par les tests (`python manage.py test`)."""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.activities.models import Activity
from apps.contacts.models import Party
from apps.currencies.models import ExchangeRate
from apps.inventory.models import Product


class ApiTestCase(TestCase):
    """Un utilisateur GNF connecté, une boutique GNF avec inventaire et un
    produit en stock (10 pièces achetées 1 000, vendues 1 500)."""

    def setUp(self):
        cache.clear()  # les taux de change sont mis en cache
        self.user = self.make_user("ahmad")
        self.client = self.client_for(self.user)
        self.shop = Activity.objects.create(
            owner=self.user, name="Boutique", type="commerce", currency_id="GNF",
            has_inventory=True, has_debts=True,
        )
        self.product = Product.objects.create(
            activity=self.shop, name="Savon", purchase_price=Decimal("1000"),
            sale_price=Decimal("1500"), stock_quantity=Decimal("10"),
        )

    @staticmethod
    def make_user(username, base_currency="GNF"):
        return get_user_model().objects.create_user(
            username=username, password="MotDePasse123",
            email=f"{username}@example.com", base_currency_id=base_currency,
        )

    @staticmethod
    def client_for(user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    @staticmethod
    def set_rate(base, quote, rate, as_of=date(2020, 1, 1)):
        ExchangeRate.objects.create(base_id=base, quote_id=quote, rate=Decimal(rate), as_of=as_of)
        cache.clear()

    def party(self, owner=None, name="Fatou"):
        return Party.objects.create(owner=owner or self.user, name=name, kind="client")

    def summary(self, path, **params):
        r = self.client.get(path, {"period": "month", **params})
        self.assertEqual(r.status_code, 200, r.content)
        return {k: (Decimal(v) if isinstance(v, str) and k in _MONEY else v) for k, v in r.json().items()}


_MONEY = {
    "revenue", "cogs", "gross_margin", "expenses", "stock_losses", "net_profit",
    "stock_value", "cash_balance", "receivable", "payable",
}
