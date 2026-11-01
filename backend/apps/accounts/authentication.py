"""Jetons de connexion liés au mot de passe.

Chaque jeton porte une empreinte (`pwd`) du mot de passe en vigueur quand il
a été émis. Dès que le mot de passe change, l'empreinte ne correspond plus :
tous les jetons émis avant — y compris un jeton d'accès volé, valable 12 h —
sont refusés immédiatement, sur tous les appareils.
"""
import hashlib
import hmac

from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

CLAIM = "pwd"


def password_fingerprint(user) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), user.password.encode(), hashlib.sha256).hexdigest()[:16]


def tokens_for(user) -> dict:
    refresh = RefreshToken.for_user(user)
    refresh[CLAIM] = password_fingerprint(user)
    # Le jeton d'accès hérite des champs du jeton de rafraîchissement.
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


# Même message que le compte n'existe pas, soit désactivé ou que le mot de
# passe soit faux : on ne révèle jamais lequel des trois (un pirate pourrait
# sinon tester quels noms d'utilisateur existent).
LOGIN_FAILED = "Nom d'utilisateur ou mot de passe incorrect."


class PasswordAwareTokenObtainPairSerializer(TokenObtainPairSerializer):
    default_error_messages = {"no_active_account": LOGIN_FAILED}

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token[CLAIM] = password_fingerprint(user)
        return token


class PasswordAwareJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        claim = validated_token.get(CLAIM)
        if not claim or not hmac.compare_digest(claim, password_fingerprint(user)):
            raise AuthenticationFailed("Session expirée : le mot de passe a été modifié.", code="password_changed")
        return user
