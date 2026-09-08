from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel
from apps.common.phone import normalize_guinea_phone, validate_guinea_phone


class Party(TimeStampedModel):
    """Un tiers : client, fournisseur, ou les deux.

    Le solde (créance / dette) n'est pas stocké : il se calcule à partir des
    transactions à crédit et de leurs règlements, dans la devise principale.
    """

    class Kind(models.TextChoices):
        CLIENT = "client", "Client"
        SUPPLIER = "supplier", "Fournisseur"
        BOTH = "both", "Client et fournisseur"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="parties"
    )
    name = models.CharField("nom", max_length=120)
    phone = models.CharField("téléphone", max_length=32, blank=True)
    kind = models.CharField("type", max_length=8, choices=Kind.choices, default=Kind.CLIENT)
    note = models.CharField("note", max_length=255, blank=True)
    is_archived = models.BooleanField("archivé", default=False)

    class Meta:
        verbose_name = "tiers"
        verbose_name_plural = "tiers"
        ordering = ["name"]

    def clean(self):
        super().clean()
        if self.phone:
            self.phone = normalize_guinea_phone(self.phone)
            validate_guinea_phone(self.phone)

    def __str__(self):
        return self.name
