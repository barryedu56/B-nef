import io
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import Workbook

from apps.activities.models import Activity
from apps.common.testutils import ApiTestCase
from apps.finance.models import PaymentMethod
from apps.inventory.models import Product


class OnboardingTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.kiosk = Activity.objects.create(owner=self.user, name="Kiosque", currency_id="GNF")
        self.cash = PaymentMethod.objects.get(owner=self.user, name="Espèces")
        self.om = PaymentMethod.objects.get(owner=self.user, name="Orange Money")

    def onboard(self, **data):
        return self.client.post(f"/api/activities/{self.kiosk.pk}/onboarding/", data, format="json")

    def test_demarrage_complet_sans_fausser_le_benefice(self):
        r = self.onboard(
            cash=[{"account": self.cash.pk, "amount": "800000"}, {"account": self.om.pk, "amount": "1200000"}],
            products=[{"name": "Riz", "unit": "sac", "quantity": "10", "unit_cost": "230000", "sale_price": "265000"},
                      {"name": "Sucre", "quantity": "0"}],
            parties=[{"name": "Mariam", "direction": "in", "amount": "150000", "phone": "622000001"},
                     {"name": "Grossiste", "direction": "out", "amount": "400000"}],
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["stock_value"], "2300000.00")
        self.kiosk.refresh_from_db()
        self.assertTrue(self.kiosk.has_inventory and self.kiosk.has_debts)
        s = self.summary(f"/api/reports/activity/{self.kiosk.pk}/")
        self.assertEqual((s["cash_balance"], s["stock_value"], s["receivable"], s["payable"]),
                         (2000000, 2300000, 150000, 400000))
        self.assertEqual((s["revenue"], s["net_profit"]), (0, 0))
        overview = {a["name"]: Decimal(a["balance"]) for a in self.client.get("/api/payment-methods/overview/").json()["accounts"]}
        self.assertEqual((overview["Espèces"], overview["Orange Money"]), (800000, 1200000))

    def test_frais_du_stock_repartis_sur_le_cout_unitaire(self):
        # 10 sacs à 230 000 + 40 000 de transport pour le lot → 234 000 le sac.
        r = self.onboard(products=[{"name": "Riz", "unit": "sac", "quantity": "10", "unit_cost": "230000",
                                    "sale_price": "265000", "extra_fees": "40000"}])
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["stock_value"], "2340000.00")
        riz = Product.objects.get(activity=self.kiosk, name="Riz")
        self.assertEqual(riz.purchase_price, Decimal("234000.00"))
        # Les frais du stock d'avant ne sortent d'aucune caisse et ne sont pas une charge.
        s = self.summary(f"/api/reports/activity/{self.kiosk.pk}/")
        self.assertEqual((s["cash_balance"], s["expenses"]), (0, 0))

    def test_tout_ou_rien(self):
        r = self.onboard(
            cash=[{"account": self.cash.pk, "amount": "5000"}],
            products=[{"name": "Riz", "quantity": "10"}],  # coût manquant
        )
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Product.objects.filter(activity=self.kiosk).exists())
        s = self.summary(f"/api/reports/activity/{self.kiosk.pk}/")
        self.assertEqual(s["cash_balance"], 0)

    def test_produit_en_double_refuse(self):
        Product.objects.create(activity=self.kiosk, name="Riz")
        r = self.onboard(products=[{"name": "riz", "quantity": "0"}])
        self.assertEqual(r.status_code, 400)

    def test_caisse_d_un_autre_compte_refusee(self):
        other = self.make_user("autre")
        foreign = PaymentMethod.objects.filter(owner=other).first()
        self.assertEqual(self.onboard(cash=[{"account": foreign.pk, "amount": "1000"}]).status_code, 400)


class ProductImportTests(ApiTestCase):
    def upload(self, name, content):
        return self.client.post("/api/products/import-parse/", {"file": SimpleUploadedFile(name, content)},
                                format="multipart")

    def test_excel_avec_colonnes_nommees_librement(self):
        wb = Workbook()
        ws = wb.active
        ws.append(["Désignation", "Qté", "Prix d'achat", "Prix de vente", "Unité"])
        ws.append(["Riz 25 kg", 20, 230000, 265000, "sac"])
        ws.append(["Huile", "3", "95 000", "115000", None])
        ws.append(["Savon", 5, None, 1500, None])  # stock sans coût → erreur
        out = io.BytesIO(); wb.save(out)
        r = self.upload("stock.xlsx", out.getvalue())
        self.assertEqual(r.status_code, 200, r.content)
        data = r.json()
        self.assertEqual([p["name"] for p in data["products"]], ["Riz 25 kg", "Huile"])
        self.assertEqual(data["products"][1]["unit_cost"], "95000")
        self.assertEqual(data["products"][1]["unit"], "pièce")
        self.assertEqual(data["errors"][0]["line"], 4)

    def test_creation_produit_avec_stock_initial_et_frais(self):
        r = self.client.post("/api/products/", {
            "activity": self.shop.pk, "name": "Ciment", "initial_quantity": "40",
            "initial_unit_cost": "85000", "initial_extra_fees": "200000", "sale_price": "95000",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["purchase_price"], "90000.00")

    def test_csv_point_virgule_virgule_decimale(self):
        content = "Nom;Quantité;Coût;Prix de vente\nSucre 1 kg;10;11000;14000\nLait;2,5;32000;40000\n".encode("latin-1")
        r = self.upload("stock.csv", content)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["products"][1]["quantity"], "2.5")

    def test_fichier_sans_colonne_nom(self):
        r = self.upload("x.csv", b"A;B\n1;2\n")
        self.assertEqual(r.status_code, 400)

    def test_modele_telechargeable(self):
        r = self.client.get("/api/products/import-template/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("benef-modele-produits.xlsx", r["Content-Disposition"])

    def test_le_modele_se_relit(self):
        template = self.client.get("/api/products/import-template/").content
        data = self.upload("benef-modele-produits.xlsx", template).json()
        self.assertEqual([p["name"] for p in data["products"]], ["Sac de riz 25 kg", "Huile 5 L"])
        self.assertEqual((data["products"][0]["unit"], data["products"][0]["low_stock_threshold"]), ("sac", "5"))
        self.assertEqual(data["products"][0]["extra_fees"], "40000")
        self.assertEqual(data["errors"], [])
