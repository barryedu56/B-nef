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


import re  # noqa: E402
from unittest import mock  # noqa: E402

from django.core import mail  # noqa: E402
from django.test import override_settings  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from apps.accounts.models import PasswordResetCode  # noqa: E402

NO_THROTTLE = mock.patch("rest_framework.throttling.ScopedRateThrottle.allow_request", return_value=True)


@override_settings(EMAIL_SEND_ASYNC=False, EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class PasswordResetSecurityTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.anon = APIClient()
        patcher = NO_THROTTLE
        patcher.start()
        self.addCleanup(patcher.stop)

    def request_code(self, identifier="ahmad"):
        r = self.anon.post("/api/auth/password-reset/request/", {"identifier": identifier}, format="json")
        self.assertEqual(r.status_code, 200)
        return r.json()["detail"]

    def last_code(self):
        return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)

    def confirm(self, code, password="Nouveau-Secret-2026"):
        return self.anon.post(
            "/api/auth/password-reset/confirm/",
            {"identifier": "ahmad@example.com", "code": code, "new_password": password},
            format="json",
        )

    def login(self, password):
        return self.anon.post("/api/auth/token/", {"username": "ahmad", "password": password}, format="json")

    def test_code_jamais_stocke_en_clair(self):
        self.request_code()
        code = self.last_code()
        stored = PasswordResetCode.objects.get(user=self.user)
        self.assertNotIn(code, stored.code_hash)
        self.assertEqual(len(stored.code_hash), 64)

    def test_compte_inconnu_meme_reponse_et_aucun_mail(self):
        known = self.request_code()
        mail.outbox.clear()
        self.assertEqual(self.request_code("personne"), known)
        self.assertEqual(mail.outbox, [])

    def test_cinq_erreurs_annulent_le_code(self):
        self.request_code()
        good = self.last_code()
        wrong = "000000" if good != "000000" else "111111"
        for _ in range(5):
            self.assertEqual(self.confirm(wrong).status_code, 400)
        self.assertEqual(self.confirm(good).status_code, 400)  # trop tard, même le bon code
        self.assertEqual(self.login("MotDePasse123").status_code, 200)

    def test_pas_plus_d_un_code_par_minute(self):
        self.request_code()
        self.request_code()
        self.assertEqual(len(mail.outbox), 1)

    def test_reinitialisation_coupe_les_sessions_et_previent(self):
        tokens = self.login("MotDePasse123").json()
        old = APIClient()
        old.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        self.assertEqual(old.get("/api/auth/me/").status_code, 200)

        self.request_code()
        self.assertEqual(self.confirm(self.last_code()).status_code, 200)

        self.assertIn("a été modifié", mail.outbox[-1].subject)
        self.assertEqual(old.get("/api/auth/me/").status_code, 401)
        r = self.anon.post("/api/auth/token/refresh/", {"refresh": tokens["refresh"]}, format="json")
        self.assertEqual(r.status_code, 401)
        self.assertEqual(self.login("MotDePasse123").status_code, 401)
        self.assertEqual(self.login("Nouveau-Secret-2026").status_code, 200)

    def test_code_a_usage_unique(self):
        self.request_code()
        code = self.last_code()
        self.assertEqual(self.confirm(code).status_code, 200)
        self.assertEqual(self.confirm(code, "Encore-Autre-2026").status_code, 400)

    def test_mot_de_passe_trop_proche_du_nom_refuse(self):
        self.request_code()
        r = self.confirm(self.last_code(), password="ahmad123")
        self.assertEqual(r.status_code, 400)
        self.assertIn("new_password", r.json())


@override_settings(EMAIL_SEND_ASYNC=False, EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class ChangePasswordTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        patcher = NO_THROTTLE
        patcher.start()
        self.addCleanup(patcher.stop)
        anon = APIClient()
        self.tokens = anon.post("/api/auth/token/", {"username": "ahmad", "password": "MotDePasse123"}, format="json").json()
        self.session = APIClient()
        self.session.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tokens['access']}")

    def test_mauvais_mot_de_passe_actuel(self):
        r = self.session.post("/api/auth/change-password/", {"current_password": "faux", "new_password": "Nouveau-Secret-2026"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_changement_renvoie_de_nouveaux_jetons_et_coupe_les_anciens(self):
        r = self.session.post(
            "/api/auth/change-password/",
            {"current_password": "MotDePasse123", "new_password": "Nouveau-Secret-2026"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        fresh = APIClient()
        fresh.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")
        self.assertEqual(fresh.get("/api/auth/me/").status_code, 200)
        self.assertEqual(self.session.get("/api/auth/me/").status_code, 401)
        self.assertIn("a été modifié", mail.outbox[-1].subject)
