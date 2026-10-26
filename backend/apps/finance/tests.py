from apps.common.testutils import ApiTestCase

from .models import Category


class TransactionCreationTests(ApiTestCase):
    def create(self, **data):
        payload = {
            "activity": self.shop.pk, "direction": "in", "amount": "5000",
            "currency": "GNF", "occurred_on": "2026-01-15", **data,
        }
        return self.client.post("/api/transactions/", payload, format="json")

    def test_operation_simple_acceptee(self):
        self.assertEqual(self.create().status_code, 201)

    def test_types_reserves_aux_ecrans_dedies_refuses(self):
        for kind in ("sale", "purchase", "settlement", "adjustment", "personal_use"):
            r = self.create(kind=kind)
            self.assertEqual(r.status_code, 400, kind)
            self.assertIn("kind", r.json())

    def test_solde_initial_exige_credit_et_tiers(self):
        self.assertEqual(self.create(kind="opening_balance").status_code, 400)
        r = self.create(kind="opening_balance", is_credit=True, party=self.party().pk)
        self.assertEqual(r.status_code, 201, r.content)


class OwnershipTests(ApiTestCase):
    """Un utilisateur ne doit jamais pouvoir pointer vers les données d'un autre."""

    def setUp(self):
        super().setUp()
        self.other = self.make_user("intrus")

    def test_tiers_d_un_autre_compte_refuse(self):
        r = self.client.post(
            "/api/transactions/",
            {"activity": self.shop.pk, "direction": "in", "amount": "5000", "currency": "GNF",
             "occurred_on": "2026-01-15", "is_credit": True, "party": self.party(owner=self.other).pk},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("party", r.json())

    def test_categorie_d_un_autre_compte_refusee(self):
        foreign = Category.objects.filter(owner=self.other).first()
        r = self.client.post(
            "/api/transactions/",
            {"activity": self.shop.pk, "direction": "in", "amount": "5000", "currency": "GNF",
             "occurred_on": "2026-01-15", "category": foreign.pk},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("category", r.json())

    def test_modifier_une_operation_vers_le_tiers_d_un_autre_refuse(self):
        txn = self.client.post(
            "/api/transactions/",
            {"activity": self.shop.pk, "direction": "in", "amount": "5000", "currency": "GNF",
             "occurred_on": "2026-01-15"},
            format="json",
        ).json()
        r = self.client.patch(
            f"/api/transactions/{txn['id']}/", {"party": self.party(owner=self.other).pk}, format="json"
        )
        self.assertEqual(r.status_code, 400)

    def test_categorie_ou_budget_sur_l_activite_d_un_autre_refuse(self):
        theirs = self.client_for(self.other)
        r = theirs.post(
            "/api/categories/", {"activity": self.shop.pk, "name": "x", "direction": "out"}, format="json"
        )
        self.assertEqual(r.status_code, 400)
        r = theirs.post(
            "/api/budgets/",
            {"activity": self.shop.pk, "period": "month", "amount": "1000", "currency": "GNF",
             "starts_on": "2026-01-01"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)


class MissingRateTests(ApiTestCase):
    def test_devise_sans_taux_renvoie_400_et_pas_500(self):
        r = self.client.post(
            "/api/transactions/",
            {"activity": self.shop.pk, "direction": "in", "amount": "10", "currency": "USD",
             "occurred_on": "2026-01-15"},
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("taux", r.json()["detail"])


class CategoryAndPaymentMethodTests(ApiTestCase):
    def test_creer_renommer_et_supprimer_une_categorie_inutilisee(self):
        r = self.client.post("/api/categories/", {"name": " Fournitures ", "direction": "out"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["name"], "Fournitures")
        cid = r.json()["id"]
        self.assertEqual(self.client.patch(f"/api/categories/{cid}/", {"name": "Papeterie"}, format="json").status_code, 200)
        self.assertEqual(self.client.delete(f"/api/categories/{cid}/").status_code, 204)

    def test_doublon_refuse(self):
        r = self.client.post("/api/categories/", {"name": "transport", "direction": "out"}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/payment-methods/", {"name": "orange money"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_categorie_utilisee_non_supprimable_et_sens_fige(self):
        cat = Category.objects.get(owner=self.user, name="Transport")
        self.client.post("/api/transactions/", {"activity": self.shop.pk, "direction": "out", "amount": "100",
                                                "currency": "GNF", "occurred_on": "2026-01-15", "category": cat.pk},
                         format="json")
        self.assertEqual(self.client.delete(f"/api/categories/{cat.pk}/").status_code, 400)
        r = self.client.patch(f"/api/categories/{cat.pk}/", {"direction": "in"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_moyen_de_paiement_utilise_non_supprimable(self):
        r = self.client.post("/api/payment-methods/", {"name": "MTN Money"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        pm = r.json()["id"]
        self.client.post("/api/transactions/", {"activity": self.shop.pk, "direction": "in", "amount": "100",
                                                "currency": "GNF", "occurred_on": "2026-01-15", "payment_method": pm},
                         format="json")
        self.assertEqual(self.client.delete(f"/api/payment-methods/{pm}/").status_code, 400)
