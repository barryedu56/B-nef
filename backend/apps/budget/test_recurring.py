"""Dépenses fixes : préparées à chaque échéance, enregistrées seulement à
la confirmation de l'utilisateur."""
from datetime import date, timedelta
from decimal import Decimal

from apps.budget.models import RecurringOperation
from apps.budget.services import following_due
from apps.common.testutils import ApiTestCase
from apps.finance.models import Category, PaymentMethod, Transaction


class RecurringTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.om = PaymentMethod.objects.get(owner=self.user, name="Orange Money")
        self.rent = Category.objects.create(owner=self.user, name="Loyer", direction="out")

    def create(self, start, **extra):
        r = self.client.post("/api/recurring/", {
            "activity": self.shop.pk, "label": "Loyer boutique", "amount": "500000", "category": self.rent.pk,
            "payment_method": self.om.pk, "frequency": "monthly", "start_date": start.isoformat(), **extra,
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()

    def test_rien_n_est_enregistre_avant_confirmation(self):
        today = date.today()
        rec = self.create(today - timedelta(days=1))
        due = self.client.get("/api/recurring/due/").json()
        self.assertEqual(len(due), 1)
        self.assertEqual(due[0]["recurring"]["label"], "Loyer boutique")
        self.assertFalse(Transaction.objects.exists())
        # Confirmation : montant modifié (la facture a changé), avec frais.
        r = self.client.post(f"/api/recurring/{rec['id']}/confirm/", {
            "due_date": due[0]["due_date"], "amount": "450000", "fee": "1000",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        txn = Transaction.objects.get(kind="simple")
        self.assertEqual((txn.amount, txn.category_id, txn.payment_method_id), (Decimal("450000"), self.rent.pk, self.om.pk))
        self.assertEqual(Transaction.objects.filter(kind="fee").count(), 1)
        self.assertEqual(self.client.get("/api/recurring/due/").json(), [])
        # Confirmer deux fois la même échéance (ex. rejouée hors-ligne) : refusé.
        again = self.client.post(f"/api/recurring/{rec['id']}/confirm/", {"due_date": due[0]["due_date"]}, format="json")
        self.assertEqual(again.status_code, 400)
        self.assertEqual(Transaction.objects.filter(kind="simple").count(), 1)

    def test_echeances_en_retard_et_pas_cette_fois(self):
        start = date.today() - timedelta(days=70)
        rec = self.create(start)
        due = self.client.get("/api/recurring/due/").json()
        self.assertGreaterEqual(len(due), 2)
        r = self.client.post(f"/api/recurring/{rec['id']}/confirm/", {"due_date": due[1]["due_date"]}, format="json")
        self.assertEqual(r.status_code, 400)  # la plus ancienne d'abord
        r = self.client.post(f"/api/recurring/{rec['id']}/skip/", {"due_date": due[0]["due_date"]}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertFalse(Transaction.objects.exists())
        self.assertEqual(len(self.client.get("/api/recurring/due/").json()), len(due) - 1)

    def test_fin_de_mois(self):
        rec = RecurringOperation(frequency="monthly", day=31)
        self.assertEqual(following_due(rec, date(2026, 1, 31)), date(2026, 2, 28))
        self.assertEqual(following_due(rec, date(2026, 2, 28)), date(2026, 3, 31))
        self.assertEqual(following_due(RecurringOperation(frequency="weekly", day=1), date(2026, 1, 1)), date(2026, 1, 8))

    def test_desactivee_plus_rien_a_confirmer(self):
        rec = self.create(date.today())
        self.client.patch(f"/api/recurring/{rec['id']}/", {"is_active": False}, format="json")
        self.assertEqual(self.client.get("/api/recurring/due/").json(), [])

    def test_activite_d_un_autre_compte_refusee(self):
        from apps.activities.models import Activity
        other = Activity.objects.create(owner=self.make_user("autre"), name="X", currency_id="GNF")
        r = self.client.post("/api/recurring/", {
            "activity": other.pk, "label": "X", "amount": "1", "start_date": date.today().isoformat(),
        }, format="json")
        self.assertEqual(r.status_code, 400)
