"""Changer de devise principale : tout l'historique est converti tout de
suite, sinon les totaux afficheraient les anciens montants sous le nouveau
symbole."""
from decimal import Decimal

from apps.common.testutils import ApiTestCase
from apps.finance.models import Transaction


class BaseCurrencyChangeTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        r = self.client.post("/api/transactions/", {
            "activity": self.shop.pk, "direction": "in", "amount": "860000", "currency": "GNF",
            "occurred_on": "2026-01-10",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)

    def test_les_totaux_passent_dans_la_nouvelle_devise(self):
        self.set_rate("USD", "GNF", "8600")
        r = self.client.patch("/api/auth/me/", {"base_currency": "USD"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        txn = Transaction.objects.get()
        self.assertEqual(txn.amount_base, Decimal("100.00"))
        s = self.summary("/api/reports/global/", date="2026-01-10")
        self.assertEqual((s["currency"], s["revenue"]), ("USD", 100))
        # Et retour en GNF : on retrouve le montant d'origine.
        self.client.patch("/api/auth/me/", {"base_currency": "GNF"}, format="json")
        self.assertEqual(Transaction.objects.get().amount_base, Decimal("860000"))

    def test_sans_taux_le_changement_est_refuse_sans_rien_casser(self):
        r = self.client.patch("/api/auth/me/", {"base_currency": "EUR"}, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("base_currency", r.json())
        self.user.refresh_from_db()
        self.assertEqual(self.user.base_currency_id, "GNF")
        self.assertEqual(Transaction.objects.get().amount_base, Decimal("860000"))


class HealthTests(ApiTestCase):
    def test_sante_sans_connexion(self):
        from rest_framework.test import APIClient

        r = APIClient().get("/api/health/")
        self.assertEqual((r.status_code, r.json()), (200, {"ok": True}))
