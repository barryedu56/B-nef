"""Réinitialisation de mot de passe par code envoyé par e-mail."""
import secrets

from django.core.mail import send_mail

from .models import PasswordResetCode


def generate_reset_code(user) -> str:
    """Invalide les codes non utilisés de l'utilisateur et en crée un nouveau."""
    PasswordResetCode.objects.filter(user=user, used_at__isnull=True).delete()
    code = f"{secrets.randbelow(1_000_000):06d}"
    PasswordResetCode.objects.create(user=user, code=code)
    return code


def send_reset_email(user, code: str) -> None:
    send_mail(
        subject="Bénef — code de réinitialisation",
        message=(
            f"Bonjour {user.username},\n\n"
            f"Voici ton code de réinitialisation de mot de passe : {code}\n"
            "Il est valable 15 minutes et ne peut servir qu'une fois.\n\n"
            "Si tu n'es pas à l'origine de cette demande, ignore ce message."
        ),
        from_email=None,  # utilise DEFAULT_FROM_EMAIL
        recipient_list=[user.email],
        fail_silently=False,
    )
