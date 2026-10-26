"""Vérifie le flux mot de passe oublié de bout en bout (transaction annulée).

    .venv\\Scripts\\python.exe scripts\\smoke_password_reset.py
"""
import os
import sys
from pathlib import Path

import django

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ["DJANGO_ALLOWED_HOSTS"] = "localhost,127.0.0.1,testserver"
# Le code n'est stocké qu'en empreinte : on le lit dans l'e-mail envoyé.
os.environ["EMAIL_SEND_ASYNC"] = "False"
django.setup()

from django.conf import settings  # noqa: E402

settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

from django.db import transaction  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

import re  # noqa: E402

from django.core import mail  # noqa: E402


class _Rollback(Exception):
    pass


def body():
    c = APIClient()

    r = c.post(
        "/api/auth/register/",
        {
            "username": "resettest",
            "password": "MotDePasseInitial1",
            "email": "resettest@example.com",
            "base_currency": "GNF",
        },
        format="json",
    )
    print("register:", r.status_code)

    # demande de code
    r = c.post("/api/auth/password-reset/request/", {"identifier": "resettest@example.com"}, format="json")
    print("request (email):", r.status_code, r.json())

    code = re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)
    print("code généré :", code)

    # mauvais code -> doit échouer
    r = c.post(
        "/api/auth/password-reset/confirm/",
        {"identifier": "resettest", "code": "000000", "new_password": "NouveauMotDePasse1"},
        format="json",
    )
    print("confirm (mauvais code):", r.status_code, r.json())
    assert r.status_code == 400, "un mauvais code doit être refusé"

    # bon code, identifiant = username cette fois (doit marcher aussi)
    r = c.post(
        "/api/auth/password-reset/confirm/",
        {"identifier": "resettest", "code": code, "new_password": "NouveauMotDePasse1"},
        format="json",
    )
    print("confirm (bon code):", r.status_code, r.json())
    assert r.status_code == 200, "le bon code doit être accepté"

    # le code ne doit plus être réutilisable
    r = c.post(
        "/api/auth/password-reset/confirm/",
        {"identifier": "resettest", "code": code, "new_password": "EncoreUnAutre1"},
        format="json",
    )
    print("confirm (code déjà utilisé):", r.status_code)
    assert r.status_code == 400, "un code déjà utilisé doit être refusé"

    # connexion avec le nouveau mot de passe
    r = c.post("/api/auth/token/", {"username": "resettest", "password": "NouveauMotDePasse1"}, format="json")
    print("login avec le nouveau mot de passe:", r.status_code)
    assert r.status_code == 200, "la connexion avec le nouveau mot de passe doit marcher"

    # identifiant inconnu -> même message générique (pas de fuite d'info)
    r = c.post("/api/auth/password-reset/request/", {"identifier": "personne@example.com"}, format="json")
    print("request (compte inconnu):", r.status_code, r.json())
    assert r.status_code == 200

    print("\nOK — transaction annulée (aucune donnée conservée).")


def main():
    try:
        with transaction.atomic():
            body()
            raise _Rollback
    except _Rollback:
        pass


if __name__ == "__main__":
    main()
