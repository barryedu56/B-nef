from rest_framework.test import APIClient

from apps.accounts.authentication import tokens_for
from apps.finance.models import Transaction

from .testutils import ApiTestCase


class IdempotencyTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        # Passe par un vrai jeton JWT, comme l'app mobile (le middleware ne
        # voit pas force_authenticate).
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens_for(self.user)['access']}")

    def sell(self, key, qty="1"):
        return self.client.post(
            "/api/sales/",
            {"activity": self.shop.pk, "lines": [{"product": self.product.pk, "quantity": qty}]},
            format="json", HTTP_IDEMPOTENCY_KEY=key,
        )

    def test_meme_cle_rejouee_ne_cree_qu_une_vente(self):
        first = self.sell("vente-1")
        second = self.sell("vente-1")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(second.json()["id"], first.json()["id"])
        self.assertEqual(second["Idempotent-Replayed"], "true")
        self.assertEqual(Transaction.objects.count(), 1)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 9)

    def test_cles_differentes_creent_deux_ventes(self):
        self.sell("a")
        self.sell("b")
        self.assertEqual(Transaction.objects.count(), 2)

    def test_echec_non_memorise_on_peut_reessayer(self):
        self.assertEqual(self.sell("k", qty="50").status_code, 400)
        self.product.stock_quantity = 100
        self.product.save()
        self.assertEqual(self.sell("k", qty="50").status_code, 201)

    def test_cle_d_un_autre_utilisateur_independante(self):
        self.sell("partagee")
        other = self.make_user("autre")
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens_for(other)['access']}")
        r = c.post(
            "/api/sales/",
            {"activity": self.shop.pk, "lines": [{"product": self.product.pk, "quantity": "1"}]},
            format="json", HTTP_IDEMPOTENCY_KEY="partagee",
        )
        self.assertEqual(r.status_code, 404)  # pas de fuite de la réponse du premier

    def test_cle_reutilisee_sur_un_autre_endpoint_refusee(self):
        self.sell("x")
        r = self.client.post(
            "/api/stock-adjustments/", {"product": self.product.pk, "new_quantity": "3"},
            format="json", HTTP_IDEMPOTENCY_KEY="x",
        )
        self.assertEqual(r.status_code, 422)
