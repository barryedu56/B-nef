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


class PasswordAwareTokenObtainPairSerializer(TokenObtainPairSerializer):
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
