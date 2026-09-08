from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class Activity(TimeStampedModel):
    """Une « activité » : tout ce que l'utilisateur fait qui touche à l'argent
    (une boutique, un salaire, un taxi, un champ, les dépenses de la maison...).

    Chaque activité travaille dans sa propre devise ; la consolidation globale
    se fait dans la devise principale de l'utilisateur.
    """

    class Type(models.TextChoices):
        COMMERCE = "commerce", "Commerce"
        SERVICE = "service", "Service / prestation"
        SALARY = "salary", "Salaire / revenu fixe"
        RENTAL = "rental", "Location"
        FARMING = "farming", "Agriculture / élevage"
        HOUSEHOLD = "household", "Ménage / dépenses"
        OTHER = "other", "Autre"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="activities"
    )
    name = models.CharField("nom", max_length=120)
    type = models.CharField("type", max_length=16, choices=Type.choices, default=Type.OTHER)
    currency = models.ForeignKey(
        "currencies.Currency", on_delete=models.PROTECT, related_name="activities"
    )

    has_inventory = models.BooleanField("module inventaire", default=False)
    has_debts = models.BooleanField("module crédits & dettes", default=False)
    has_budget = models.BooleanField("module budget", default=False)

    opening_balance = models.DecimalField(
        "solde de caisse initial", max_digits=20, decimal_places=2, default=0
    )
    is_archived = models.BooleanField("archivée", default=False)

    class Meta:
        verbose_name = "activité"
        verbose_name_plural = "activités"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name
