"""Rejeu sûr des requêtes d'écriture (`Idempotency-Key`).

Le client (app mobile, file d'attente hors-ligne) génère un identifiant
unique par opération et le renvoie à chaque tentative. La première réponse
réussie (2xx) est mémorisée ; toute tentative suivante avec la même clé
reçoit cette réponse telle quelle, sans réexécuter l'opération.
"""
import json

from django.db import IntegrityError
from django.http import JsonResponse
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from .models import IdempotencyRecord

_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_MAX_KEY_LENGTH = 64


class IdempotencyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self._jwt = JWTAuthentication()

    def __call__(self, request):
        key = request.headers.get("Idempotency-Key", "").strip()
        if not key or request.method not in _WRITE_METHODS:
            return self.get_response(request)
        if len(key) > _MAX_KEY_LENGTH:
            return JsonResponse({"detail": "Idempotency-Key trop longue (64 caractères max)."}, status=400)

        user = self._authenticate(request)
        if user is None:  # requête anonyme ou jeton invalide : la vue répondra 401
            return self.get_response(request)

        previous = IdempotencyRecord.objects.filter(user=user, key=key).first()
        if previous is not None:
            if previous.method != request.method or previous.path != request.path:
                return JsonResponse(
                    {"detail": "Cette Idempotency-Key a déjà servi pour une autre opération."},
                    status=422,
                )
            response = JsonResponse(previous.body, status=previous.status_code, safe=False)
            response["Idempotent-Replayed"] = "true"
            return response

        response = self.get_response(request)
        if 200 <= response.status_code < 300 and _is_json(response):
            try:
                body = json.loads(response.content or b"null")
                IdempotencyRecord.objects.create(
                    user=user, key=key, method=request.method, path=request.path[:255],
                    status_code=response.status_code, body=body,
                )
            except (ValueError, IntegrityError):
                pass  # tentative concurrente déjà enregistrée, ou corps non JSON
        return response

    def _authenticate(self, request):
        try:
            result = self._jwt.authenticate(request)
        except (InvalidToken, TokenError):
            return None
        if result is not None:
            return result[0]
        user = getattr(request, "user", None)
        return user if user is not None and user.is_authenticated else None


def _is_json(response) -> bool:
    return response.get("Content-Type", "").startswith("application/json")
