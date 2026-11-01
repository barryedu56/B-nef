"""Gestionnaire d'erreurs DRF : transforme les erreurs métier prévisibles en
réponses 400 lisibles plutôt qu'en erreurs serveur 500."""
import math

from rest_framework.exceptions import Throttled
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from apps.currencies.services import RateUnavailable


def exception_handler(exc, context):
    if isinstance(exc, RateUnavailable):
        return Response(
            {"detail": f"{exc}. Les taux de change ne sont pas encore disponibles : "
                       f"réessaie plus tard ou saisis le montant dans la devise de l'activité."},
            status=400,
        )
    if isinstance(exc, Throttled):
        response = drf_exception_handler(exc, context)
        wait = math.ceil((exc.wait or 60) / 60)
        response.data = {
            "detail": f"Trop de tentatives. Pour ta sécurité, réessaie dans {wait} minute{'s' if wait > 1 else ''}."
        }
        return response
    return drf_exception_handler(exc, context)
