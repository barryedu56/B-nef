from decimal import Decimal

from apps.common.testutils import ApiTestCase
from apps.finance.models import Transaction

from .models import Product


class SaleTests(ApiTestCase):
    def sell(self, qty, **extra):
        return self.client.post(
            "/api/sales/",
            {"activity": self.shop.pk, "lines": [{"product": self.product.pk, "quantity": qty}], **extra},
            format="json",
        )

    def test_vente_refusee_si_stock_insuffisant(self):
        r = self.sell("11")
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("Stock insuffisant", r.json()["detail"])
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 10)
        self.assertFalse(Transaction.objects.exists())

    def test_stock_insuffisant_detecte_sur_plusieurs_lignes_du_meme_produit(self):
        line = {"product": self.product.pk, "quantity": "6"}
        r = self.client.post(
            "/api/sales/", {"activity": self.shop.pk, "lines": [line, line]}, format="json"
        )
        self.assertEqual(r.status_code, 400, r.content)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 10)

    def test_vente_de_tout_le_stock_acceptee(self):
        r = self.sell("10")
        self.assertEqual(r.status_code, 201, r.content)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 0)

    def test_acompte_superieur_au_total_renvoie_400_sans_rien_ecrire(self):
        r = self.sell("2", is_credit=True, amount_paid_now="5000", party=self.party().pk)
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("acompte", r.json()["detail"])
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 10)
        self.assertFalse(Transaction.objects.exists())


class PurchaseTests(ApiTestCase):
    def test_acompte_superieur_au_total_renvoie_400(self):
        r = self.client.post(
            "/api/purchases/",
            {"product": self.product.pk, "quantity": "2", "unit_cost": "1000",
             "is_credit": True, "amount_paid_now": "3000"},
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.content)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 10)

    def test_reponse_renvoie_le_stock_a_jour(self):
        r = self.client.post(
            "/api/purchases/",
            {"product": self.product.pk, "quantity": "10", "unit_cost": "2000"},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(Decimal(r.json()["product"]["stock_quantity"]), 20)
        self.assertEqual(Decimal(r.json()["product"]["purchase_price"]), 1500)


class StockAdjustmentTests(ApiTestCase):
    def adjust(self, qty):
        return self.client.post(
            "/api/stock-adjustments/", {"product": self.product.pk, "new_quantity": qty}, format="json"
        )

    def test_perte_comptee_en_charge_sans_toucher_la_caisse(self):
        r = self.adjust("7")  # 3 savons cassés, à 1 000 l'unité
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(Decimal(r.json()["product"]["stock_quantity"]), 7)
        s = self.summary(f"/api/reports/activity/{self.shop.pk}/")
        self.assertEqual(s["stock_losses"], 3000)
        self.assertEqual(s["expenses"], 3000)
        self.assertEqual(s["net_profit"], -3000)
        self.assertEqual(s["cash_balance"], 0)
        self.assertEqual(s["stock_value"], 7000)

    def test_surplus_compte_en_gain(self):
        self.adjust("12")
        s = self.summary(f"/api/reports/activity/{self.shop.pk}/")
        self.assertEqual(s["stock_losses"], -2000)
        self.assertEqual(s["net_profit"], 2000)

    def test_stock_negatif_refuse(self):
        self.assertEqual(self.adjust("-1").status_code, 400)

    def test_ajustement_ne_s_annule_pas(self):
        self.adjust("7")
        txn = Transaction.objects.get(kind=Transaction.Kind.ADJUSTMENT)
        r = self.client.post(f"/api/transactions/{txn.pk}/void/", {}, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        self.assertEqual(Product.objects.get(pk=self.product.pk).stock_quantity, 7)


class OfflineSaleTests(ApiTestCase):
    def test_vente_hors_ligne_acceptee_meme_si_stock_insuffisant(self):
        r = self.client.post(
            "/api/sales/",
            {"activity": self.shop.pk, "lines": [{"product": self.product.pk, "quantity": "12"}],
             "recorded_offline": True, "occurred_on": "2026-01-10"},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["occurred_on"], "2026-01-10")
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, -2)

    def test_consommation_hors_ligne_acceptee(self):
        r = self.client.post(
            "/api/personal-use/",
            {"product": self.product.pk, "quantity": "11", "recorded_offline": True},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
