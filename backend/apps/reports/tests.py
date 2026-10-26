from decimal import Decimal

from apps.activities.models import Activity
from apps.common.testutils import ApiTestCase
from apps.inventory.models import Product


class OpeningBalanceTests(ApiTestCase):
    def test_vue_globale_convertit_la_somme_de_depart_de_chaque_activite(self):
        self.set_rate("USD", "GNF", "8600")
        r = self.client.post("/api/activities/", {"name": "Import", "currency": "USD", "opening_balance": "100"},
                             format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.client.post("/api/activities/", {"name": "Kiosque", "currency": "GNF", "opening_balance": "50000"},
                         format="json")
        s = self.summary("/api/reports/global/", currency="GNF")
        self.assertEqual(s["cash_balance"], 50000 + 100 * 8600)
        self.assertEqual(s["revenue"], 0)  # une somme de départ n'est pas un gain


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


class StockValueTests(ApiTestCase):
    def test_vue_globale_convertit_la_valeur_du_stock_de_chaque_activite(self):
        self.set_rate("USD", "GNF", "8600")
        shop_usd = Activity.objects.create(owner=self.user, name="Import", currency_id="USD", has_inventory=True)
        Product.objects.create(activity=shop_usd, name="Téléphone", purchase_price=Decimal("50"),
                               stock_quantity=Decimal("2"))
        s = self.summary("/api/reports/global/", currency="GNF")
        self.assertEqual(s["stock_value"], 10 * 1000 + 2 * 50 * 8600)


class ReportPerformanceTests(ApiTestCase):
    """Le nombre de requêtes d'un rapport ne doit pas dépendre du nombre de
    ventes (autrefois une boucle Python sur chaque ligne de vente)."""

    def sell(self, n):
        for _ in range(n):
            self.client.post(
                "/api/sales/",
                {"activity": self.shop.pk, "lines": [{"product": self.product.pk, "quantity": "1"}],
                 "recorded_offline": True},
                format="json",
            )

    def count_queries(self, path):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        with CaptureQueriesContext(connection) as ctx:
            self.assertEqual(self.client.get(path).status_code, 200)
        return len(ctx.captured_queries)

    def test_nombre_de_requetes_constant(self):
        paths = ["/api/reports/global/?period=year", f"/api/reports/activity/{self.shop.pk}/?period=year"]
        self.sell(2)
        before = [self.count_queries(p) for p in paths]
        self.sell(15)
        after = [self.count_queries(p) for p in paths]
        self.assertEqual(before, after)

    def test_benefice_mensuel_coherent_avec_le_resume(self):
        self.sell(3)  # 3 × (1 500 − 1 000)
        r = self.client.get(f"/api/reports/activity/{self.shop.pk}/?period=month").json()
        self.assertEqual(r["net_profit"], "1500.00")
        self.assertEqual(r["timeseries"][-1]["net_profit"], "1500.00")


class PartyListPerformanceTests(ApiTestCase):
    def test_soldes_des_tiers_en_nombre_de_requetes_constant(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        def list_queries():
            with CaptureQueriesContext(connection) as ctx:
                r = self.client.get("/api/parties/")
            self.assertEqual(r.status_code, 200)
            return len(ctx.captured_queries), r.json()["results"]

        for i in range(2):
            self.client.post(
                "/api/transactions/",
                {"activity": self.shop.pk, "direction": "in", "amount": "1000", "currency": "GNF",
                 "occurred_on": "2026-01-15", "is_credit": True, "party": self.party(name=f"C{i}").pk},
                format="json",
            )
        few, _ = list_queries()
        for i in range(8):
            self.party(name=f"D{i}")
        many, results = list_queries()
        self.assertEqual(few, many)
        self.assertEqual(sorted(r["balance"] for r in results if r["name"].startswith("C")), ["1000.00", "1000.00"])


class ExportTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.client.post("/api/sales/", {"activity": self.shop.pk, "occurred_on": "2026-03-10",
                                         "lines": [{"product": self.product.pk, "quantity": "2"}]}, format="json")
        r = self.client.post("/api/transactions/", {"activity": self.shop.pk, "direction": "out", "amount": "700.50",
                                                    "currency": "GNF", "occurred_on": "2026-03-12", "note": "Taxi"},
                             format="json")
        self.client.post(f"/api/transactions/{r.json()['id']}/void/", {"reason": "doublon"}, format="json")
        self.client.post("/api/transactions/", {"activity": self.shop.pk, "direction": "out", "amount": "500",
                                                "currency": "GNF", "occurred_on": "2026-04-01"}, format="json")

    def test_excel_operations_et_compte_de_resultat(self):
        import io

        from openpyxl import load_workbook

        r = self.client.get("/api/reports/export/", {"start": "2026-03-01", "end": "2026-03-31"})
        self.assertEqual(r.status_code, 200)
        self.assertIn(".xlsx", r["Content-Disposition"])
        wb = load_workbook(io.BytesIO(r.content))
        ops = list(wb["Opérations"].values)
        self.assertEqual(ops[0][0], "Date")
        self.assertEqual(len(ops), 3)  # en-tête + vente + sortie annulée (avril exclu)
        voided = [row for row in ops[1:] if row[16] == "oui"][0]
        self.assertEqual(voided[8], -700.5)
        self.assertEqual(voided[17], "doublon")
        summary = {row[0]: row[1] for row in wb["Compte de résultat"].values if row and len(row) > 1}
        self.assertEqual(summary["Chiffre d'affaires"], 3000)
        self.assertEqual(summary["Bénéfice net"], 1000)  # la sortie annulée ne compte pas

    def test_csv_format_francais(self):
        r = self.client.get("/api/reports/export/", {"file": "csv", "start": "2026-03-01", "end": "2026-03-31",
                                                     "activity": self.shop.pk})
        self.assertEqual(r.status_code, 200)
        text = r.content.decode("utf-8")
        self.assertTrue(text.startswith("﻿Date;Activité;"))
        self.assertIn("12/03/2026", text)
        self.assertIn("-700,50", text)

    def test_activite_d_un_autre_compte_refusee(self):
        other = self.make_user("autre")
        r = self.client_for(other).get("/api/reports/export/", {"activity": self.shop.pk})
        self.assertEqual(r.status_code, 404)


class PurchasesTotalTests(ApiTestCase):
    def test_achats_de_la_periode_sans_toucher_le_benefice(self):
        self.client.post("/api/purchases/", {"product": self.product.pk, "quantity": "5", "unit_cost": "1000"},
                         format="json")
        self.client.post("/api/purchases/", {"product": self.product.pk, "quantity": "2", "unit_cost": "1000",
                                             "is_credit": True}, format="json")
        s = self.summary(f"/api/reports/activity/{self.shop.pk}/")
        self.assertEqual(s["purchases"], 7000)
        self.assertEqual(s["net_profit"], 0)
        self.assertEqual(s["expenses"], 0)


class PartyStatementTests(ApiTestCase):
    def test_bilan_fournisseur_et_client(self):
        from apps.contacts.models import Party

        supplier = Party.objects.create(owner=self.user, name="Grossiste", kind="supplier")
        client = self.party()
        self.client.post("/api/purchases/", {"product": self.product.pk, "quantity": "10", "unit_cost": "1000",
                                             "party": supplier.pk, "is_credit": True, "amount_paid_now": "4000"},
                         format="json")
        self.client.post("/api/purchases/", {"product": self.product.pk, "quantity": "2", "unit_cost": "1000",
                                             "party": supplier.pk}, format="json")
        self.client.post("/api/sales/", {"activity": self.shop.pk, "party": client.pk, "is_credit": True,
                                         "amount_paid_now": "1000", "lines": [{"product": self.product.pk, "quantity": "2"}]},
                         format="json")
        s = self.client.get(f"/api/parties/{supplier.pk}/statement/").json()
        self.assertEqual((s["bought"], s["paid"], s["owed_to_party"]), ("12000.00", "6000.00", "6000.00"))
        c = self.client.get(f"/api/parties/{client.pk}/statement/").json()
        self.assertEqual((c["sold"], c["received"], c["owed_by_party"]), ("3000.00", "1000.00", "2000.00"))
