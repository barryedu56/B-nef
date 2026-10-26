from apps.activities.models import Activity
from apps.common.testutils import ApiTestCase
from apps.finance.models import Transaction
from apps.inventory.models import Product


class DeleteAccountTests(ApiTestCase):
    def test_suppression_efface_toutes_les_donnees_du_compte(self):
        other = self.make_user("voisin")
        other_shop = Activity.objects.create(owner=other, name="Autre", currency_id="GNF")
        self.client.post("/api/sales/", {"activity": self.shop.pk, "is_credit": True, "party": self.party().pk,
                                         "lines": [{"product": self.product.pk, "quantity": "2"}]}, format="json")
        self.client.post("/api/budgets/", {"period": "month", "amount": "10", "currency": "GNF",
                                           "starts_on": "2026-01-01"}, format="json")

        self.assertEqual(self.client.post("/api/auth/delete-account/", {"password": "faux"}, format="json").status_code, 400)
        r = self.client.post("/api/auth/delete-account/", {"password": "MotDePasse123"}, format="json")
        self.assertEqual(r.status_code, 204)

        self.assertFalse(type(self.user).objects.filter(pk=self.user.pk).exists())
        self.assertFalse(Activity.objects.filter(pk=self.shop.pk).exists())
        self.assertFalse(Product.objects.filter(pk=self.product.pk).exists())
        self.assertFalse(Transaction.objects.filter(activity_id=self.shop.pk).exists())
        self.assertTrue(Activity.objects.filter(pk=other_shop.pk).exists())
