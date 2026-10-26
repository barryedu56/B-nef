from decimal import Decimal

from apps.activities.models import Activity
from apps.common.testutils import ApiTestCase


class OpeningBalanceTests(ApiTestCase):
    def test_vue_globale_convertit_le_solde_initial_de_chaque_activite(self):
        self.set_rate("USD", "GNF", "8600")
        Activity.objects.create(
            owner=self.user, name="Import", currency_id="USD", opening_balance=Decimal("100")
        )
        self.shop.opening_balance = Decimal("50000")
        self.shop.save()
        s = self.summary("/api/reports/global/", currency="GNF")
        self.assertEqual(s["cash_balance"], 50000 + 100 * 8600)


class CreditTests(ApiTestCase):
    def test_creances_et_dettes_visibles_sur_l_activite_et_en_global(self):
        client = self.party()
        self.client.post(
            "/api/sales/",
            {"activity": self.shop.pk, "lines": [{"product": self.product.pk, "quantity": "4"}],
             "is_credit": True, "amount_paid_now": "2000", "party": client.pk},
            format="json",
        )  # 6 000 de vente, 2 000 payés -> 4 000 dus
        self.client.post(
            "/api/purchases/",
            {"product": self.product.pk, "quantity": "5", "unit_cost": "1000", "is_credit": True},
            format="json",
        )  # 5 000 de dette fournisseur, sans tiers
        for path in (f"/api/reports/activity/{self.shop.pk}/", "/api/reports/global/"):
            s = self.summary(path)
            self.assertEqual(s["receivable"], 4000, path)
            self.assertEqual(s["payable"], 5000, path)
            self.assertEqual(s["cash_balance"], 2000, path)

    def test_operation_annulee_sort_des_creances(self):
        r = self.client.post(
            "/api/transactions/",
            {"activity": self.shop.pk, "direction": "in", "amount": "3000", "currency": "GNF",
             "occurred_on": "2026-01-15", "is_credit": True, "party": self.party().pk},
            format="json",
        )
        self.client.post(f"/api/transactions/{r.json()['id']}/void/", {}, format="json")
        self.assertEqual(self.summary("/api/reports/global/")["receivable"], 0)
