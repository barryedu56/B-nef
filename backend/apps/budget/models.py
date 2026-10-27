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


class RecurringOperation(TimeStampedModel):
    """Dépense (ou entrée) fixe qui revient : loyer, salaire, abonnement…
    À chaque échéance, l'opération est préparée et attend la confirmation de
    l'utilisateur (montant, caisse) avant d'être enregistrée : rien ne sort
    de la caisse tant qu'il n'a pas confirmé."""

    class Frequency(models.TextChoices):
        WEEKLY = "weekly", "Chaque semaine"
        MONTHLY = "monthly", "Chaque mois"
        YEARLY = "yearly", "Chaque année"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recurring_operations")
    activity = models.ForeignKey("activities.Activity", on_delete=models.CASCADE, related_name="recurring_operations")
    label = models.CharField("libellé", max_length=120)
    direction = models.CharField("sens", max_length=3, choices=[("in", "Entrée"), ("out", "Sortie")], default="out")
    amount = models.DecimalField("montant habituel", max_digits=20, decimal_places=2)
    category = models.ForeignKey(
        "finance.Category", on_delete=models.SET_NULL, null=True, blank=True, related_name="recurring_operations"
    )
    payment_method = models.ForeignKey(
        "finance.PaymentMethod", on_delete=models.SET_NULL, null=True, blank=True, related_name="recurring_operations"
    )
    frequency = models.CharField("fréquence", max_length=8, choices=Frequency.choices, default=Frequency.MONTHLY)
    # Jour de l'échéance pour une fréquence mensuelle / annuelle (31 = fin de mois).
    day = models.PositiveSmallIntegerField("jour", default=1)
    next_due = models.DateField("prochaine échéance")
    is_active = models.BooleanField("active", default=True)

    class Meta:
        verbose_name = "opération récurrente"
        verbose_name_plural = "opérations récurrentes"
        ordering = ["next_due", "label"]

    def __str__(self):
        return f"{self.label} — {self.amount} ({self.get_frequency_display()})"
