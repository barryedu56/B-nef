"""Gestionnaire d'erreurs DRF : transforme les erreurs métier prévisibles en
réponses 400 lisibles plutôt qu'en erreurs serveur 500."""
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
    return drf_exception_handler(exc, context)
