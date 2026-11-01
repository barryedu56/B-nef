"""Administration du propriétaire : tableau de bord, comptes, données
comptables en lecture seule, limite d'essais de connexion."""
from django.core.cache import cache
from django.test import Client, override_settings

from apps.common.testutils import ApiTestCase
from apps.finance.models import Transaction


# Pas de collectstatic en test : stockage simple des fichiers CSS de l'admin.
@override_settings(STORAGES={
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
})
class AdminTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.boss = self.make_user("patron")
        self.boss.is_staff = self.boss.is_superuser = True
        self.boss.save()
        self.web = Client()
        self.web.force_login(self.boss)
        self.client.post("/api/transactions/", {
            "activity": self.shop.pk, "direction": "out", "amount": "1000", "currency": "GNF",
            "occurred_on": "2026-01-10",
        }, format="json")

    def test_tableau_de_bord(self):
        r = self.web.get("/admin/")
        self.assertEqual(r.status_code, 200)
        page = r.content.decode()
        self.assertIn("Bénef — Administration", page)
        self.assertIn("Inscrits cette semaine", page)
        self.assertIn("ahmad", page)  # dernières inscriptions

    def test_liste_des_comptes_et_desactivation(self):
        r = self.web.get("/admin/accounts/user/")
        self.assertEqual(r.status_code, 200)
        self.web.post("/admin/accounts/user/", {"action": "deactivate", "_selected_action": [self.user.pk]})
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

    def test_operations_en_lecture_seule(self):
        txn = Transaction.objects.get()
        self.assertEqual(self.web.get(f"/admin/finance/transaction/{txn.pk}/change/").status_code, 200)
        r = self.web.post(f"/admin/finance/transaction/{txn.pk}/delete/", {"post": "yes"})
        self.assertEqual(r.status_code, 403)
        self.assertTrue(Transaction.objects.filter(pk=txn.pk).exists())

    def test_trop_d_essais_de_connexion(self):
        cache.clear()
        anon = Client()
        for _ in range(10):
            anon.post("/admin/login/", {"username": "patron", "password": "faux"})
        r = anon.post("/admin/login/", {"username": "patron", "password": "MotDePasse123"})
        self.assertEqual(r.status_code, 429)
