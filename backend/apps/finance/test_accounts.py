"""Caisses : soldes par moyen de paiement, apports / retraits, transferts,
vérification de caisse, stock initial."""
from decimal import Decimal
from importlib import import_module

from django.apps import apps as django_apps

from apps.activities.models import Activity
from apps.common.testutils import ApiTestCase
from apps.finance.models import PaymentMethod, Transaction
from apps.inventory.models import Product


class AccountsTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.cash = PaymentMethod.objects.get(owner=self.user, name="Espèces")
        self.om = PaymentMethod.objects.get(owner=self.user, name="Orange Money")
        self.bank = PaymentMethod.objects.get(owner=self.user, name="Banque")

    def overview(self):
        r = self.client.get("/api/payment-methods/overview/")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        return Decimal(data["total"]), {a["name"]: Decimal(a["balance"]) for a in data["accounts"]}

    def activity_summary(self, activity=None):
        return self.summary(f"/api/reports/activity/{(activity or self.shop).pk}/")

    def op(self, **data):
        payload = {"activity": self.shop.pk, "currency": "GNF", "occurred_on": "2026-01-15", **data}
        return self.client.post("/api/transactions/", payload, format="json")

    def test_somme_de_depart_dans_la_caisse_choisie_sans_etre_un_gain(self):
        r = self.client.post(
            "/api/activities/",
            {"name": "Taxi", "currency": "GNF", "opening_balance": "300000", "opening_account": self.om.pk},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        taxi = Activity.objects.get(pk=r.json()["id"])
        total, per = self.overview()
        self.assertEqual(per["Orange Money"], 300000)
        self.assertEqual(total, 300000)
        s = self.activity_summary(taxi)
        self.assertEqual(s["cash_balance"], 300000)
        self.assertEqual(s["revenue"], 0)
        self.assertEqual(s["net_profit"], 0)

    def test_chaque_operation_va_dans_sa_caisse_et_espece_par_defaut(self):
        self.client.post("/api/sales/", {"activity": self.shop.pk, "payment_method": self.om.pk,
                                         "lines": [{"product": self.product.pk, "quantity": "2"}]}, format="json")
        self.op(direction="out", amount="1000")  # sans moyen de paiement → Espèces
        _, per = self.overview()
        self.assertEqual(per["Orange Money"], 3000)
        self.assertEqual(per["Espèces"], -1000)

    def test_apport_et_retrait_bougent_la_caisse_pas_le_benefice(self):
        self.assertEqual(self.op(direction="in", amount="50000", kind="contribution").status_code, 201)
        self.assertEqual(self.op(direction="out", amount="20000", kind="withdrawal").status_code, 201)
        s = self.activity_summary()
        self.assertEqual(s["cash_balance"], 30000)
        self.assertEqual(s["revenue"], 0)
        self.assertEqual(s["expenses"], 0)
        self.assertEqual(self.overview()[1]["Espèces"], 30000)

    def test_retrait_doit_etre_une_sortie(self):
        r = self.op(direction="in", amount="1000", kind="withdrawal")
        self.assertEqual(r.status_code, 400)

    def test_transfert_entre_caisses_et_entre_activites(self):
        house = Activity.objects.create(owner=self.user, name="Maison", currency_id="GNF")
        self.op(direction="in", amount="500000", kind="contribution")
        r = self.client.post("/api/transfers/", {"from_account": self.cash.pk, "to_account": self.bank.pk,
                                                 "from_activity": self.shop.pk, "amount": "200000"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        r = self.client.post("/api/transfers/", {"from_account": self.cash.pk, "to_account": self.cash.pk,
                                                 "from_activity": self.shop.pk, "to_activity": house.pk,
                                                 "amount": "100000"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        # boutique → maison dans la même caisse Espèces : le solde des
        # Espèces ne bouge pas, seule la répartition entre activités change.
        total, per = self.overview()
        self.assertEqual((per["Espèces"], per["Banque"], total), (300000, 200000, 500000))
        self.assertEqual(self.activity_summary()["cash_balance"], 400000)
        self.assertEqual(self.activity_summary(house)["cash_balance"], 100000)
        self.assertEqual(self.activity_summary()["net_profit"], 0)
        self.assertEqual(self.activity_summary(house)["expenses"], 0)

    def test_transfert_vers_la_meme_caisse_et_activite_refuse(self):
        r = self.client.post("/api/transfers/", {"from_account": self.cash.pk, "to_account": self.cash.pk,
                                                 "from_activity": self.shop.pk, "amount": "1000"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_annuler_un_transfert_annule_les_deux_moities(self):
        r = self.client.post("/api/transfers/", {"from_account": self.cash.pk, "to_account": self.om.pk,
                                                 "from_activity": self.shop.pk, "amount": "5000"}, format="json")
        out_id = r.json()["out"]["id"]
        self.client.post(f"/api/transactions/{out_id}/void/", {}, format="json")
        self.assertEqual(Transaction.objects.filter(kind="transfer", voided_at__isnull=True).count(), 0)
        _, per = self.overview()
        self.assertEqual((per["Espèces"], per["Orange Money"]), (0, 0))

    def test_verification_de_caisse_enregistre_l_ecart_comme_charge(self):
        self.op(direction="in", amount="100000", kind="contribution")
        r = self.client.post(f"/api/payment-methods/{self.cash.pk}/count/",
                             {"counted": "92000", "activity": self.shop.pk}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(Decimal(r.json()["difference"]), -8000)
        self.assertEqual(self.overview()[1]["Espèces"], 92000)
        s = self.activity_summary()
        self.assertEqual(s["cash_differences"], 8000)
        self.assertEqual(s["net_profit"], -8000)
        history = self.client.get(f"/api/payment-methods/{self.cash.pk}/counts/").json()
        self.assertEqual(len(history), 1)
        # un comptage juste n'ajoute aucune opération
        r = self.client.post(f"/api/payment-methods/{self.cash.pk}/count/",
                             {"counted": "92000", "activity": self.shop.pk}, format="json")
        self.assertEqual(Decimal(r.json()["difference"]), 0)
        self.assertIsNone(r.json()["transaction"])

    def test_caisse_en_dollars_et_total_au_taux_du_jour(self):
        self.set_rate("USD", "GNF", "8600")
        usd = PaymentMethod.objects.create(owner=self.user, name="Dollars", currency_id="USD")
        self.op(direction="in", amount="10", currency="USD", kind="contribution", payment_method=usd.pk)
        total, per = self.overview()
        self.assertEqual(per["Dollars"], 10)
        self.assertEqual(total, 86000)

    def test_stock_initial_valorise_sans_toucher_la_caisse(self):
        r = self.client.post("/api/products/", {"activity": self.shop.pk, "name": "Riz", "sale_price": "130000",
                                                "initial_quantity": "20", "initial_unit_cost": "100000"},
                             format="json")
        self.assertEqual(r.status_code, 201, r.content)
        rice = Product.objects.get(pk=r.json()["id"])
        self.assertEqual((rice.stock_quantity, rice.purchase_price), (20, 100000))
        self.client.post("/api/sales/", {"activity": self.shop.pk,
                                         "lines": [{"product": rice.pk, "quantity": "3"}]}, format="json")
        s = self.activity_summary()
        self.assertEqual(s["cogs"], 300000)
        self.assertEqual(s["net_profit"], 90000)
        self.assertEqual(s["cash_balance"], 390000)  # seule la vente a fait entrer de l'argent

    def test_stock_initial_sans_cout_refuse(self):
        r = self.client.post("/api/products/", {"activity": self.shop.pk, "name": "Riz", "initial_quantity": "5"},
                             format="json")
        self.assertEqual(r.status_code, 400)


class CashAccountsMigrationTests(ApiTestCase):
    def test_reprise_des_donnees_existantes(self):
        legacy = Activity.objects.create(owner=self.user, name="Ancienne", currency_id="GNF",
                                         opening_balance=Decimal("75000"))
        old = Transaction.objects.create(activity=legacy, direction="out", amount=1000, currency_id="GNF",
                                         amount_activity=1000, amount_base=1000, fx_date="2026-01-01",
                                         occurred_on="2026-01-01")
        migration = import_module("apps.finance.migrations.0008_backfill_cash_accounts")
        migration.forwards(django_apps, None)
        legacy.refresh_from_db(); old.refresh_from_db()
        self.assertEqual(legacy.opening_balance, 0)
        self.assertEqual(old.payment_method.name, "Espèces")
        start = Transaction.objects.get(activity=legacy, kind="contribution")
        self.assertEqual((start.amount, start.payment_method.name), (75000, "Espèces"))
        self.assertEqual(self.summary(f"/api/reports/activity/{legacy.pk}/")["cash_balance"], 74000)


class CashOnlyMovementsTests(ApiTestCase):
    def test_vente_a_credit_absente_des_mouvements_de_caisse(self):
        cash = PaymentMethod.objects.get(owner=self.user, name="Espèces")
        self.client.post("/api/sales/", {"activity": self.shop.pk, "is_credit": True, "amount_paid_now": "1000",
                                         "payment_method": cash.pk, "party": self.party().pk,
                                         "lines": [{"product": self.product.pk, "quantity": "2"}]}, format="json")
        rows = self.client.get("/api/transactions/", {"payment_method": cash.pk, "cash_only": 1}).json()["results"]
        self.assertEqual([(r["kind"], r["amount"]) for r in rows], [("settlement", "1000.00")])


class CashFlowTests(ApiTestCase):
    def test_entrees_sorties_par_nature_et_soldes(self):
        cash = PaymentMethod.objects.get(owner=self.user, name="Espèces")
        bank = PaymentMethod.objects.get(owner=self.user, name="Banque")
        post = lambda **d: self.client.post("/api/transactions/", {"activity": self.shop.pk, "currency": "GNF", **d},
                                            format="json")
        post(direction="in", amount="100000", kind="contribution", occurred_on="2026-02-20", payment_method=cash.pk)
        post(direction="out", amount="7000", occurred_on="2026-03-05", payment_method=cash.pk)
        self.client.post("/api/sales/", {"activity": self.shop.pk, "occurred_on": "2026-03-06", "payment_method": cash.pk,
                                         "lines": [{"product": self.product.pk, "quantity": "2"}]}, format="json")
        self.client.post("/api/sales/", {"activity": self.shop.pk, "occurred_on": "2026-03-07", "is_credit": True,
                                         "party": self.party().pk, "lines": [{"product": self.product.pk, "quantity": "1"}]},
                         format="json")  # à crédit : n'apparaît pas
        self.client.post("/api/transfers/", {"from_account": cash.pk, "to_account": bank.pk, "from_activity": self.shop.pk,
                                             "amount": "50000", "occurred_on": "2026-03-10"}, format="json")
        data = self.client.get("/api/payment-methods/flow/", {"period": "month", "date": "2026-03-15"}).json()
        esp = [a for a in data["accounts"] if a["name"] == "Espèces"][0]
        self.assertEqual(Decimal(esp["opening"]), 100000)
        self.assertEqual(Decimal(esp["in"]["sales"]), 3000)
        self.assertEqual(Decimal(esp["out"]["expenses"]), 7000)
        self.assertEqual(Decimal(esp["out"]["transfers_out"]), 50000)
        self.assertEqual(Decimal(esp["closing"]), 100000 + 3000 - 7000 - 50000)
        self.assertEqual(Decimal(data["totals"]["closing"]), 96000)
        self.assertEqual(Decimal(data["totals"]["in"]["transfers_in"]), 50000)
