"""Limitation de débit sur les endpoints sensibles (auth).

Sans ça, rien n'empêche un script d'essayer des milliers de mots de passe
(connexion), de codes de réinitialisation à 6 chiffres (1 million de
combinaisons pour une fenêtre de 15 min), ou de créer des comptes en masse
(inscription). Les taux sont volontairement larges pour ne jamais gêner un
utilisateur légitime qui se trompe deux fois de mot de passe.

Usage : `throttle_classes = [ScopedRateThrottle]` + `throttle_scope = "login"`
sur la vue — `ScopedRateThrottle` lit le scope sur la VUE (attribut
`throttle_scope`), pas sur la classe de throttle elle-même. Les taux par
scope sont définis dans `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`
(config/settings.py).
"""
from rest_framework.throttling import ScopedRateThrottle

__all__ = ["ScopedRateThrottle"]
