from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class Budget(TimeStampedModel):
    """Montant prévu pour une catégorie (ou une activité entière) sur une période."""

    class Period(models.TextChoices):
        WEEK = "week", "Semaine"
        MONTH = "month", "Mois"
        YEAR = "year", "Année"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="budgets"
    )
    activity = models.ForeignKey(
        "activities.Activity",
        on_delete=models.CASCADE,
        related_name="budgets",
        null=True,
        blank=True,
        help_text="Vide = budget global (toutes activités).",
    )
    category = models.ForeignKey(
        "finance.Category",
        on_delete=models.CASCADE,
        related_name="budgets",
        null=True,
        blank=True,
        help_text="Vide = budget de dépenses global de l'activité.",
    )
    period = models.CharField("période", max_length=5, choices=Period.choices, default=Period.MONTH)
    amount = models.DecimalField("montant prévu", max_digits=20, decimal_places=2)
    currency = models.ForeignKey("currencies.Currency", on_delete=models.PROTECT)
    starts_on = models.DateField("à partir du")

    class Meta:
        verbose_name = "budget"
        verbose_name_plural = "budgets"
        ordering = ["-starts_on"]

    def __str__(self):
        target = self.category or self.activity or "global"
        return f"Budget {target} — {self.amount} {self.currency_id} / {self.get_period_display()}"
