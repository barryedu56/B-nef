"""Frais de transfert : sur un transfert, un achat payé, un règlement —
une charge prise dans la caisse qui paie, annulée avec son opération."""
from datetime import date
from decimal import Decimal

from apps.common.testutils import ApiTestCase
from apps.finance.models import PaymentMethod, Transaction


class FeeTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.cash = PaymentMethod.objects.get(owner=self.user, name="Espèces")
        self.om = PaymentMethod.objects.get(owner=self.user, name="Orange Money")
        self.bank = PaymentMethod.objects.get(owner=self.user, name="Banque")
        self.client.post("/api/transactions/", {
            "activity": self.shop.pk, "direction": "in", "amount": "500000", "currency": "GNF",
            "kind": "contribution", "payment_method": self.om.pk, "occurred_on": "2020-01-01",
        }, format="json")

    def balances(self):
        data = self.client.get("/api/payment-methods/overview/").json()
        return {a["name"]: Decimal(a["balance"]) for a in data["accounts"]}

    def shop_summary(self):
        return self.summary(f"/api/reports/activity/{self.shop.pk}/")

    def test_transfert_avec_frais(self):
        r = self.client.post("/api/transfers/", {
            "from_account": self.om.pk, "to_account": self.bank.pk, "from_activity": self.shop.pk,
            "amount": "100000", "fee": "1500",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["out"]["fees_total"], "1500.00")
        per = self.balances()
        self.assertEqual(per["Orange Money"], 500000 - 101500)
        self.assertEqual(per["Banque"], 100000)
        s = self.shop_summary()
        self.assertEqual(s["expenses"], 1500)
        self.assertEqual(s["net_profit"], -1500)
        fee = Transaction.objects.get(kind="fee")
        self.assertEqual(fee.category.name, "Frais de transfert")

        flow = self.client.get("/api/payment-methods/flow/", {"period": "month"}).json()
        self.assertEqual(Decimal(flow["totals"]["out"]["fees"]), 1500)

        # Annuler le transfert annule aussi ses frais.
        out_id = r.json()["out"]["id"]
        self.assertEqual(self.client.post(f"/api/transactions/{out_id}/void/", {}, format="json").status_code, 200)
        self.assertEqual(self.balances()["Orange Money"], 500000)
        self.assertEqual(self.shop_summary()["expenses"], 0)

    def test_annuler_la_moitie_entrante_annule_aussi_les_frais(self):
        r = self.client.post("/api/transfers/", {
            "from_account": self.om.pk, "to_account": self.cash.pk, "from_activity": self.shop.pk,
            "amount": "200000", "fee": "3000",
        }, format="json")
        in_id = r.json()["in"]["id"]
        self.client.post(f"/api/transactions/{in_id}/void/", {}, format="json")
        self.assertFalse(Transaction.objects.filter(kind="fee", voided_at__isnull=True).exists())

    def test_achat_paye_avec_frais_charge_pas_cout_du_stock(self):
        r = self.client.post("/api/purchases/", {
            "product": self.product.pk, "quantity": "10", "unit_cost": "1000",
            "payment_method": self.om.pk, "fee": "500",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.product.refresh_from_db()
        self.assertEqual(self.product.purchase_price, Decimal("1000.00"))  # les frais ne gonflent pas le coût
        self.assertEqual(self.balances()["Orange Money"], 500000 - 10000 - 500)
        self.assertEqual(self.shop_summary()["expenses"], 500)

    def test_achat_a_credit_frais_sur_l_acompte_seulement(self):
        supplier = self.party(name="Grossiste")
        r = self.client.post("/api/purchases/", {
            "product": self.product.pk, "quantity": "10", "unit_cost": "1000", "party": supplier.pk,
            "is_credit": True, "fee": "500",
        }, format="json")
        self.assertEqual(r.status_code, 400)  # rien n'est payé : pas de frais
        r = self.client.post("/api/purchases/", {
            "product": self.product.pk, "quantity": "10", "unit_cost": "1000", "party": supplier.pk,
            "is_credit": True, "amount_paid_now": "4000", "payment_method": self.om.pk, "fee": "200",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        fee = Transaction.objects.get(kind="fee")
        self.assertEqual(fee.fee_for.kind, "settlement")
        self.assertEqual(self.balances()["Orange Money"], 500000 - 4000 - 200)

    def test_reglement_de_dette_avec_frais(self):
        supplier = self.party(name="Grossiste")
        r = self.client.post("/api/purchases/", {
            "product": self.product.pk, "quantity": "10", "unit_cost": "1000", "party": supplier.pk, "is_credit": True,
        }, format="json")
        txn_id = r.json()["transaction"]["id"]
        r = self.client.post(f"/api/transactions/{txn_id}/settle/", {
            "amount": "6000", "payment_method": self.om.pk, "fee": "300",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["fees_total"], "300.00")
        self.assertEqual(self.balances()["Orange Money"], 500000 - 6300)
        # Le fournisseur n'a reçu que 6 000 : les frais vont à l'opérateur.
        statement = self.client.get(f"/api/parties/{supplier.pk}/statement/").json()
        self.assertEqual(Decimal(statement["paid"]), 6000)
        self.assertEqual(Decimal(statement["owed_to_party"]), 4000)
        # Annuler le règlement annule ses frais.
        self.client.post(f"/api/transactions/{r.json()['id']}/void/", {}, format="json")
        self.assertEqual(self.balances()["Orange Money"], 500000)

    def test_les_frais_comptent_dans_un_budget_de_charges(self):
        from apps.budget.services import _spent
        from apps.budget.models import Budget
        self.client.post("/api/transfers/", {
            "from_account": self.om.pk, "to_account": self.bank.pk, "from_activity": self.shop.pk,
            "amount": "100000", "fee": "1500",
        }, format="json")
        budget = Budget(owner=self.user, activity=self.shop, currency_id="GNF", amount=Decimal("10000"))
        today = date.today()
        self.assertEqual(_spent(budget, today.replace(day=1), today), 1500)

    def test_frais_negatifs_refuses(self):
        r = self.client.post("/api/transfers/", {
            "from_account": self.om.pk, "to_account": self.bank.pk, "from_activity": self.shop.pk,
            "amount": "100000", "fee": "-5",
        }, format="json")
        self.assertEqual(r.status_code, 400)
