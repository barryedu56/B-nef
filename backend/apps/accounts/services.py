"""Réinitialisation de mot de passe par code envoyé par e-mail, et
suppression définitive d'un compte."""
import hashlib
import hmac
import secrets
import threading
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction as db_transaction
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from apps.inventory.models import SaleLine

from .models import PasswordResetCode

# Limites par compte (en plus de la limite par adresse IP des vues) : pas
# plus d'un code par minute ni de 5 par heure — sinon on pourrait inonder
# la boîte mail de quelqu'un depuis plusieurs adresses.
RESEND_DELAY = timedelta(minutes=1)
MAX_CODES_PER_HOUR = 5


def _hash_code(user_id: int, code: str) -> str:
    """Empreinte du code liée au compte et à la clé secrète du serveur."""
    message = f"{user_id}:{code}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()


def generate_reset_code(user) -> str | None:
    """Annule les codes en attente du compte et en crée un nouveau. Renvoie
    None (aucun e-mail) si le compte a déjà reçu trop de codes récemment."""
    now = timezone.now()
    recent = PasswordResetCode.objects.filter(user=user, created_at__gte=now - timedelta(hours=1))
    if recent.filter(created_at__gte=now - RESEND_DELAY).exists() or recent.count() >= MAX_CODES_PER_HOUR:
        return None
    PasswordResetCode.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
    code = f"{secrets.randbelow(1_000_000):06d}"
    PasswordResetCode.objects.create(user=user, code_hash=_hash_code(user.pk, code))
    return code


def check_reset_code(user, code: str) -> PasswordResetCode | None:
    """Le code en cours du compte s'il correspond, sinon None. Chaque erreur
    compte : après 5, le code est annulé et il faut en redemander un."""
    current = PasswordResetCode.objects.filter(user=user, used_at__isnull=True).order_by("-created_at").first()
    if current is None or not current.is_valid():
        return None
    if hmac.compare_digest(current.code_hash, _hash_code(user.pk, code)):
        return current
    current.attempts += 1
    if current.attempts >= PasswordResetCode.MAX_ATTEMPTS:
        current.used_at = timezone.now()
    current.save(update_fields=["attempts", "used_at"])
    return None


def set_new_password(user, new_password: str) -> None:
    """Change le mot de passe et coupe toutes les sessions ouvertes : les
    anciens jetons ne correspondent plus au nouveau mot de passe (voir
    authentication.py), et les jetons de rafraîchissement sont aussi mis sur
    liste noire."""
    user.set_password(new_password)
    user.save(update_fields=["password"])
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)
    _send_async(
        user.email,
        "Bénef — ton mot de passe a été modifié",
        (
            f"Bonjour {user.username},\n\n"
            "Le mot de passe de ton compte Bénef vient d'être modifié, et toutes tes sessions ont été "
            "déconnectées.\n\n"
            "Si ce n'est pas toi : utilise tout de suite « Mot de passe oublié » pour reprendre la main, "
            "puis contacte-nous."
        ),
    )


def _send_async(recipient: str, subject: str, message: str) -> None:
    """Envoie l'e-mail sans faire attendre la réponse : sinon une demande
    pour un compte existant (envoi SMTP) répondrait plus lentement qu'une
    demande pour un compte inconnu, ce qui trahirait quels comptes existent."""
    if not recipient:
        return

    def send():
        send_mail(subject=subject, message=message, from_email=None, recipient_list=[recipient], fail_silently=True)

    if getattr(settings, "EMAIL_SEND_ASYNC", True):
        db_transaction.on_commit(lambda: threading.Thread(target=send, daemon=True).start())
    else:
        send()


def send_reset_email(user, code: str) -> None:
    _send_async(
        user.email,
        "Bénef — code de réinitialisation",
        (
            f"Bonjour {user.username},\n\n"
            f"Voici ton code de réinitialisation de mot de passe : {code}\n"
            "Il est valable 15 minutes et ne peut servir qu'une fois.\n\n"
            "Ne le communique à personne : l'équipe Bénef ne te le demandera jamais.\n"
            "Si tu n'es pas à l'origine de cette demande, ignore ce message — ton mot de passe ne change pas."
        ),
    )


@db_transaction.atomic
def delete_account(user) -> None:
    """Supprime le compte et TOUTES ses données (activités, opérations,
    stock, tiers, budgets…) — exigence du Play Store et droit de
    l'utilisateur sur ses données. Irréversible.

    Les lignes de vente protègent leurs produits (PROTECT, pour qu'on ne
    puisse pas supprimer un produit déjà vendu) : elles partent d'abord.
    """
    SaleLine.objects.filter(transaction__activity__owner=user).delete()
    if user.avatar:
        user.avatar.delete(save=False)
    user.delete()
