from decimal import Decimal

from django.utils import timezone

from apps.common.testutils import ApiTestCase
from apps.finance.models import Category


class BudgetStatusTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.today = timezone.localdate().isoformat()
        self.transport = Category.objects.get(owner=self.user, name="Transport")
        self.loyer = Category.objects.get(owner=self.user, name="Loyer")

    def spend(self, amount, category, **extra):
        r = self.client.post(
            "/api/transactions/",
            {"activity": self.shop.pk, "direction": "out", "amount": str(amount), "currency": "GNF",
             "occurred_on": self.today, "category": category.pk, **extra},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()

    def budget(self, amount, **extra):
        r = self.client.post(
            "/api/budgets/",
            {"activity": self.shop.pk, "period": "month", "amount": str(amount), "currency": "GNF",
             "starts_on": "2020-01-01", **extra},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()

    def status(self):
        r = self.client.get("/api/budgets/status/")
        self.assertEqual(r.status_code, 200)
        return {row["id"]: row for row in r.json()}

    def test_depense_par_categorie_et_statuts(self):
        transport = self.budget(10000, category=self.transport.pk)
        loyer = self.budget(50000, category=self.loyer.pk)
        self.spend(8500, self.transport)
        self.spend(60000, self.loyer)
        rows = self.status()
        self.assertEqual(rows[transport["id"]]["spent"], "8500.00")
        self.assertEqual(rows[transport["id"]]["status"], "warning")  # 85 %
        self.assertEqual(rows[loyer["id"]]["status"], "over")
        self.assertEqual(rows[loyer["id"]]["remaining"], "-10000.00")
        # dépassements en premier
        self.assertEqual(list(rows)[0], loyer["id"])

    def test_budget_global_de_l_activite_et_operations_annulees(self):
        b = self.budget(100000)
        self.spend(20000, self.transport)
        txn = self.spend(30000, self.loyer)
        self.client.post(f"/api/transactions/{txn['id']}/void/", {}, format="json")
        self.assertEqual(self.status()[b["id"]]["spent"], "20000.00")
        self.assertEqual(self.status()[b["id"]]["status"], "ok")

    def test_reappro_et_entrees_ne_comptent_pas(self):
        b = self.budget(100000)
        self.client.post("/api/purchases/", {"product": self.product.pk, "quantity": "5", "unit_cost": "1000"},
                         format="json")
        self.client.post("/api/transactions/", {"activity": self.shop.pk, "direction": "in", "amount": "9000",
                                                "currency": "GNF", "occurred_on": self.today}, format="json")
        self.assertEqual(self.status()[b["id"]]["spent"], "0.00")

    def test_budget_en_autre_devise_converti(self):
        self.set_rate("USD", "GNF", "8600")
        r = self.client.post("/api/budgets/", {"period": "month", "amount": "10", "currency": "USD",
                                               "starts_on": "2020-01-01"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.spend(43000, self.transport)
        self.assertEqual(Decimal(self.status()[r.json()["id"]]["spent"]), Decimal("5.00"))

    def test_categorie_d_entree_refusee(self):
        ventes = Category.objects.get(owner=self.user, name="Ventes")
        r = self.client.post("/api/budgets/", {"period": "month", "amount": "10", "currency": "GNF",
                                               "starts_on": "2020-01-01", "category": ventes.pk}, format="json")
        self.assertEqual(r.status_code, 400)
