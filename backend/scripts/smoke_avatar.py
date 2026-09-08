"""Vérifie l'upload/suppression de la photo de profil. Le compte de test est
annulé (transaction), mais le FICHIER uploadé (hors transaction DB) est
supprimé explicitement à la fin pour ne rien laisser sur le disque.

    .venv\\Scripts\\python.exe scripts\\smoke_avatar.py
"""
import io
import os
import sys
from pathlib import Path

import django

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ["DJANGO_ALLOWED_HOSTS"] = "localhost,127.0.0.1,testserver"
django.setup()

from django.db import transaction  # noqa: E402
from PIL import Image  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402


class _Rollback(Exception):
    pass


def _fake_png(name="avatar.png"):
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), color=(79, 70, 229)).save(buf, format="PNG")
    buf.seek(0)
    buf.name = name
    return buf


def body():
    c = APIClient()
    c.post(
        "/api/auth/register/",
        {"username": "avatartest", "password": "MotDePasse123", "email": "avatartest@example.com", "base_currency": "GNF"},
        format="json",
    )
    token = c.post("/api/auth/token/", {"username": "avatartest", "password": "MotDePasse123"}, format="json").json()["access"]
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    r = c.get("/api/auth/me/")
    print("avatar avant upload:", r.json()["avatar"], "(attendu None)")
    assert r.json()["avatar"] is None

    r = c.post("/api/auth/me/avatar/", {"avatar": _fake_png()}, format="multipart")
    print("upload avatar:", r.status_code)
    assert r.status_code == 200
    avatar_url = r.json()["avatar"]
    print("url avatar:", avatar_url)
    assert avatar_url and "avatars/" in avatar_url

    r = c.get("/api/auth/me/")
    assert r.json()["avatar"] == avatar_url
    print("  -> avatar bien attaché au compte : OK")

    # remplacement : l'ancien fichier doit être supprimé du disque
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(username="avatartest")
    old_path = user.avatar.path
    assert os.path.exists(old_path)

    r = c.post("/api/auth/me/avatar/", {"avatar": _fake_png("avatar2.png")}, format="multipart")
    assert r.status_code == 200
    print("  -> remplacement de l'avatar : OK,", "ancien fichier supprimé :", not os.path.exists(old_path))
    assert not os.path.exists(old_path)

    user.refresh_from_db()
    new_path = user.avatar.path

    r = c.delete("/api/auth/me/avatar/")
    print("suppression avatar:", r.status_code, r.json()["avatar"])
    assert r.status_code == 200
    assert r.json()["avatar"] is None
    assert not os.path.exists(new_path)
    print("  -> suppression : fichier bien effacé du disque : OK")

    print("\nOK — transaction annulée, fichiers de test nettoyés.")


def main():
    try:
        with transaction.atomic():
            body()
            raise _Rollback
    except _Rollback:
        pass


if __name__ == "__main__":
    main()
