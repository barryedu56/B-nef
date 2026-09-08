from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class Direction(models.TextChoices):
    IN = "in", "Entrée"
    OUT = "out", "Sortie"


class Category(TimeStampedModel):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="categories"
    )
    activity = models.ForeignKey(
        "activities.Activity",
        on_delete=models.CASCADE,
        related_name="categories",
        null=True,
        blank=True,
        help_text="Vide = catégorie disponible pour toutes les activités.",
    )
    name = models.CharField("nom", max_length=80)
    direction = models.CharField("sens", max_length=3, choices=Direction.choices)
    is_system = models.BooleanField("catégorie système", default=False)

    class Meta:
        verbose_name = "catégorie"
        verbose_name_plural = "catégories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class PaymentMethod(TimeStampedModel):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payment_methods"
    )
    name = models.CharField("nom", max_length=60)
    is_cash = models.BooleanField("espèces / liquide", default=False)

    class Meta:
        verbose_name = "moyen de paiement"
        verbose_name_plural = "moyens de paiement"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Transaction(TimeStampedModel):
    """Un mouvement d'argent rattaché à une activité.

    Trois montants sont stockés :
      - `amount` / `currency`      : ce que l'utilisateur a saisi
      - `amount_activity`          : converti dans la devise de l'activité
      - `amount_base`              : converti dans la devise principale de l'utilisateur
    Les conversions sont figées au taux de la date `occurred_on` (comptabilité
    à valeur historique). Le taux utilisé est conservé dans `fx_rate_to_base`.
    """

    Direction = Direction

    class Kind(models.TextChoices):
        SIMPLE = "simple", "Entrée / sortie simple"
        SALE = "sale", "Vente"
        PURCHASE = "purchase", "Achat / réapprovisionnement"
        SETTLEMENT = "settlement", "Règlement d'une dette"
        ADJUSTMENT = "adjustment", "Ajustement"
        OPENING_BALANCE = "opening_balance", "Solde initial (report)"
        PERSONAL_USE = "personal_use", "Consommation personnelle"

    activity = models.ForeignKey(
        "activities.Activity", on_delete=models.CASCADE, related_name="transactions"
    )
    direction = models.CharField("sens", max_length=3, choices=Direction.choices)
    kind = models.CharField("type", max_length=20, choices=Kind.choices, default=Kind.SIMPLE)

    amount = models.DecimalField("montant saisi", max_digits=20, decimal_places=2)
    currency = models.ForeignKey(
        "currencies.Currency", on_delete=models.PROTECT, related_name="transactions"
    )
    amount_activity = models.DecimalField(
        "montant (devise activité)", max_digits=20, decimal_places=2
    )
    amount_base = models.DecimalField(
        "montant (devise principale)", max_digits=20, decimal_places=2
    )
    fx_rate_to_base = models.DecimalField(
        "taux vers devise principale", max_digits=24, decimal_places=12, default=1
    )
    fx_date = models.DateField("date du taux")

    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions"
    )
    payment_method = models.ForeignKey(
        PaymentMethod, on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions"
    )
    party = models.ForeignKey(
        "contacts.Party",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions",
    )

    occurred_on = models.DateField("date de l'opération")
    note = models.CharField("note", max_length=255, blank=True)

    # Crédit : l'argent n'a pas encore été encaissé / décaissé à `occurred_on`.
    # La transaction compte quand même dans le résultat (comptabilité d'engagement)
    # mais pas dans la trésorerie tant qu'elle n'est pas soldée.
    is_credit = models.BooleanField("à crédit", default=False)
    # Cumul de ce qui a déjà été réglé (un ou plusieurs règlements partiels
    # possibles — même devise que `amount`, jamais convertie). `is_settled`
    # ne devient vrai que quand ce cumul atteint `amount` : voir
    # apps/finance/ops.py::settle_transaction.
    settled_amount = models.DecimalField("montant déjà réglé", max_digits=20, decimal_places=2, default=0)
    is_settled = models.BooleanField("soldée", default=False)
    settles = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="settlements",
        help_text="Transaction à crédit que ce règlement vient solder.",
    )

    # Annulation façon comptable : on ne supprime jamais une écriture, on
    # l'annule (elle reste visible dans l'historique, mais sort de tous les
    # calculs). Voir apps/finance/void.py.
    voided_at = models.DateTimeField("annulée le", null=True, blank=True)
    voided_reason = models.CharField("motif d'annulation", max_length=255, blank=True)
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        verbose_name = "transaction"
        verbose_name_plural = "transactions"
        ordering = ["-occurred_on", "-created_at"]
        indexes = [
            models.Index(fields=["activity", "-occurred_on"]),
            models.Index(fields=["activity", "direction", "kind"]),
        ]

    def __str__(self):
        return f"{self.get_direction_display()} {self.amount} {self.currency_id} — {self.activity}"

    @property
    def affects_cash_now(self) -> bool:
        """La transaction impacte-t-elle la caisse immédiatement ?"""
        if self.kind == self.Kind.SETTLEMENT:
            return True
        return not self.is_credit

    @property
    def remaining_amount(self) -> Decimal:
        """Ce qu'il reste à régler (même devise que `amount`). 0 si non à crédit."""
        if not self.is_credit:
            return Decimal("0")
        remaining = self.amount - self.settled_amount
        return remaining if remaining > 0 else Decimal("0")

    @property
    def is_voided(self) -> bool:
        return self.voided_at is not None
