"""Validation des numéros de téléphone mobile guinéens.

Plan de numérotation ARPT (Autorité de Régulation des Postes et
Télécommunications de Guinée) : depuis le basculement à 9 chiffres en 2013,
un numéro mobile guinéen s'écrit `PP XXXXXXX` où `PP` identifie
l'opérateur — 61/62 Orange, 65 Cellcom, 66 MTN (Areeba) sont les préfixes
actuellement en service (60 Sotelgui et 63 Intercel existent dans le plan
d'origine mais ne correspondent plus à un opérateur mobile actif).
Sources : ARPT (basculement 9 chiffres, 2013), listes d'indicatifs
opérateurs (Orange/MTN Guinée).
"""
import re

from django.core.exceptions import ValidationError

GUINEA_MOBILE_PREFIXES = ("61", "62", "65", "66")

_NON_DIGITS = re.compile(r"\D+")


def normalize_guinea_phone(value: str) -> str:
    """Ne garde que les chiffres — l'utilisateur peut taper des espaces ou
    des tirets, on les retire avant de stocker/valider."""
    return _NON_DIGITS.sub("", value or "")


def validate_guinea_phone(value: str) -> None:
    """Lève une erreur si `value` (déjà normalisé, chiffres seuls) n'est pas
    un numéro mobile guinéen valide : 9 chiffres, commençant par 61, 62, 65
    ou 66. Une valeur vide est acceptée (le téléphone reste facultatif) —
    seule une valeur non vide et incorrecte est refusée.
    """
    if not value:
        return
    if len(value) != 9 or not value.isdigit() or value[:2] not in GUINEA_MOBILE_PREFIXES:
        raise ValidationError(
            "Numéro invalide : 9 chiffres, en commençant par 61, 62, 65 ou 66 "
            "(ex. 622 12 34 56)."
        )


def clean_guinea_phone(value: str) -> str:
    """Normalise puis valide — pratique pour un `validate_phone` de
    serializer DRF : la `ValidationError` Django levée par
    `validate_guinea_phone` est comprise nativement par DRF."""
    value = normalize_guinea_phone(value)
    validate_guinea_phone(value)
    return value
