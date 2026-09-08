from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

from apps.common.phone import normalize_guinea_phone, validate_guinea_phone


class User(AbstractUser):
    """Utilisateur de l'application.

    `base_currency` est la devise principale (comptable) : toutes les
    consolidations et l'historique sont calculés dans cette devise.
    `display_currency` est la devise d'affichage choisie par l'utilisateur ;
    quand elle diffère de la devise principale, les montants sont reconvertis
    au taux le plus récent (vue "au cours du jour").
    """

    phone = models.CharField("téléphone", max_length=32, blank=True)
    language = models.CharField("langue", max_length=5, default="fr")
    avatar = models.ImageField("photo de profil", upload_to="avatars/", null=True, blank=True)

    base_currency = models.ForeignKey(
        "currencies.Currency",
        on_delete=models.PROTECT,
        related_name="users_base",
        default="GNF",
        verbose_name="devise principale",
    )
    display_currency = models.ForeignKey(
        "currencies.Currency",
        on_delete=models.SET_NULL,
        related_name="users_display",
        null=True,
        blank=True,
        verbose_name="devise d'affichage",
        help_text="Vide = même que la devise principale.",
    )

    class Meta:
        verbose_name = "utilisateur"
        verbose_name_plural = "utilisateurs"

    def clean(self):
        super().clean()
        if self.phone:
            self.phone = normalize_guinea_phone(self.phone)
            validate_guinea_phone(self.phone)

    @property
    def effective_display_currency_id(self):
        return self.display_currency_id or self.base_currency_id


class PasswordResetCode(models.Model):
    """Code à 6 chiffres envoyé par e-mail pour réinitialiser le mot de passe.

    Valable 15 minutes, à usage unique. En dev (sans serveur mail configuré),
    le code atterrit dans la console `runserver` au lieu d'une vraie boîte mail.
    """

    VALIDITY = timedelta(minutes=15)

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reset_codes")
    code = models.CharField("code", max_length=6)
    created_at = models.DateTimeField("créé le", auto_now_add=True)
    used_at = models.DateTimeField("utilisé le", null=True, blank=True)

    class Meta:
        verbose_name = "code de réinitialisation"
        verbose_name_plural = "codes de réinitialisation"
        indexes = [models.Index(fields=["user", "code"])]
        ordering = ["-created_at"]

    def is_valid(self) -> bool:
        if self.used_at is not None:
            return False
        return timezone.now() - self.created_at <= self.VALIDITY

    def __str__(self):
        return f"Code pour {self.user_id} ({self.created_at:%Y-%m-%d %H:%M})"
