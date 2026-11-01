"""Console d'administration : réservée aux administrateurs, actions
journalisées, aucune action possible sur son propre compte."""
from apps.common.testutils import ApiTestCase
from apps.finance.models import Transaction

from .models import AdminAction


class ConsoleTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.boss = self.make_user("patron")
        self.boss.is_staff = True
        self.boss.save()
        self.admin = self.client_for(self.boss)
        r = self.client.post("/api/transactions/", {
            "activity": self.shop.pk, "direction": "out", "amount": "1000", "currency": "GNF",
            "occurred_on": "2026-01-10",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)

    def test_reservee_aux_administrateurs(self):
        for path in ("overview", "feed", "health", "users", "operations", "rates", "journal"):
            self.assertEqual(self.client.get(f"/api/console/{path}/").status_code, 403, path)
            self.assertEqual(self.admin.get(f"/api/console/{path}/").status_code, 200, path)

    def test_vue_d_ensemble_et_utilisateurs(self):
        o = self.admin.get("/api/console/overview/").json()
        self.assertEqual(o["users"]["total"], 1)  # les admins ne comptent pas
        self.assertEqual(o["operations"]["total"], 1)
        users = self.admin.get("/api/console/users/", {"search": "ahm"}).json()["results"]
        self.assertEqual([u["username"] for u in users], ["ahmad"])
        self.assertEqual(users[0]["operations"], 1)
        d = self.admin.get(f"/api/console/users/{self.user.pk}/").json()
        self.assertEqual(d["activities_list"][0]["name"], "Boutique")
        self.assertEqual(len(d["recent_operations"]), 1)

    def test_desactivation_reactivation_journalisees(self):
        r = self.admin.post(f"/api/console/users/{self.user.pk}/deactivate/")
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.admin.post(f"/api/console/users/{self.user.pk}/reactivate/")
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
        self.assertEqual(AdminAction.objects.filter(target_user=self.user).count(), 2)

    def test_pas_d_action_sur_soi_meme(self):
        r = self.admin.post(f"/api/console/users/{self.boss.pk}/deactivate/")
        self.assertEqual(r.status_code, 400)
        self.boss.refresh_from_db()
        self.assertTrue(self.boss.is_active)

    def test_mot_de_passe_temporaire(self):
        r = self.admin.post(f"/api/console/users/{self.user.pk}/temp-password/")
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(r.json()["password"]))

    def test_annulation_avec_motif(self):
        txn = Transaction.objects.get()
        url = f"/api/console/operations/{txn.pk}/void/"
        self.assertEqual(self.admin.post(url, {}, format="json").status_code, 400)
        r = self.admin.post(url, {"reason": "demande du client"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        txn.refresh_from_db()
        self.assertIsNotNone(txn.voided_at)
        self.assertIn("[admin]", txn.voided_reason)

    def test_taux_manuel(self):
        r = self.admin.post("/api/console/rates/", {"base": "USD", "quote": "GNF", "rate": "8650"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        rates = self.admin.get("/api/console/rates/").json()
        self.assertTrue(any(x["base"] == "USD" and x["quote"] == "GNF" and x["source"] == "manuel" for x in rates))
        self.assertEqual(self.admin.post("/api/console/rates/", {"base": "GNF", "quote": "GNF", "rate": "1"},
                                         format="json").status_code, 400)
