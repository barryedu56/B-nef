"""Vue « Mon argent » filtrée sur une activité : la part de chaque activité
dans des caisses communes, sans rien changer aux soldes réels."""
from decimal import Decimal

from apps.activities.models import Activity
from apps.common.testutils import ApiTestCase
from apps.finance.models import CashCount, PaymentMethod


class ActivityFilterTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.taxi = Activity.objects.create(owner=self.user, name="Taxi", currency_id="GNF")
        self.cash = PaymentMethod.objects.get(owner=self.user, name="Espèces")
        self.om = PaymentMethod.objects.get(owner=self.user, name="Orange Money")
        # Boutique : 500 000 en espèces, loyer 100 000 par Orange Money.
        # Taxi : 200 000 par Orange Money.
        self.op(self.shop, "in", "500000", self.cash)
        self.op(self.shop, "out", "100000", self.om)
        self.op(self.taxi, "in", "200000", self.om)

    def op(self, activity, direction, amount, account):
        r = self.client.post("/api/transactions/", {
            "activity": activity.pk, "direction": direction, "amount": amount, "currency": "GNF",
            "payment_method": account.pk, "occurred_on": "2026-01-10",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)

    def overview(self, activity=None):
        params = {"activity": activity.pk} if activity else {}
        data = self.client.get("/api/payment-methods/overview/", params).json()
        return data, {a["name"]: a for a in data["accounts"]}

    def test_part_de_chaque_activite_et_somme_egale_au_total(self):
        all_data, all_rows = self.overview()
        shop_data, shop_rows = self.overview(self.shop)
        taxi_data, taxi_rows = self.overview(self.taxi)
        self.assertEqual(Decimal(all_data["total"]), 600000)
        self.assertEqual(Decimal(shop_data["total"]), 400000)
        self.assertEqual(Decimal(taxi_data["total"]), 200000)
        self.assertEqual(shop_data["activity"]["name"], "Boutique")
        # La boutique a dépensé dans Orange Money l'argent apporté par le taxi.
        self.assertEqual(Decimal(shop_rows["Orange Money"]["balance"]), -100000)
        self.assertEqual(Decimal(shop_rows["Orange Money"]["account_balance"]), 100000)
        for name in all_rows:
            self.assertEqual(
                Decimal(shop_rows[name]["balance"]) + Decimal(taxi_rows[name]["balance"]),
                Decimal(all_rows[name]["balance"]),
            )
        # Le total filtré = la « Caisse » du tableau de bord de l'activité.
        s = self.summary(f"/api/reports/activity/{self.shop.pk}/")
        self.assertEqual(s["cash_balance"], Decimal(shop_data["total"]))

    def test_entrees_sorties_filtrees(self):
        flow = self.client.get("/api/payment-methods/flow/", {"period": "year", "date": "2026-01-10",
                                                              "activity": self.taxi.pk}).json()
        self.assertEqual(Decimal(flow["totals"]["total_in"]), 200000)
        self.assertEqual(Decimal(flow["totals"]["total_out"]), 0)

    def test_verifier_la_part_d_une_activite(self):
        # Tiroir de la boutique : on compte 490 000 au lieu de 500 000.
        r = self.client.post(f"/api/payment-methods/{self.cash.pk}/count/", {
            "counted": "490000", "activity": self.shop.pk, "activity_only": True,
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual((Decimal(r.json()["expected"]), Decimal(r.json()["difference"])), (500000, -10000))
        self.assertTrue(CashCount.objects.get().activity_only)
        _, shop_rows = self.overview(self.shop)
        self.assertEqual(Decimal(shop_rows["Espèces"]["balance"]), 490000)
        self.assertIsNotNone(shop_rows["Espèces"]["last_count"])
        _, taxi_rows = self.overview(self.taxi)
        self.assertIsNone(taxi_rows["Espèces"]["last_count"])

    def test_verifier_toute_la_caisse_reste_comme_avant(self):
        r = self.client.post(f"/api/payment-methods/{self.om.pk}/count/", {
            "counted": "100000", "activity": self.taxi.pk,
        }, format="json")
        self.assertEqual(Decimal(r.json()["expected"]), 100000)
        self.assertEqual(Decimal(r.json()["difference"]), 0)
        self.assertFalse(r.json()["activity_only"])

    def test_activite_d_un_autre_compte_refusee(self):
        other = Activity.objects.create(owner=self.make_user("autre"), name="X", currency_id="GNF")
        r = self.client.get("/api/payment-methods/overview/", {"activity": other.pk})
        self.assertEqual(r.status_code, 404)
