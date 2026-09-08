from django.db import models


class Currency(models.Model):
    """Devise (code ISO 4217). Ex. GNF, XOF, USD, EUR."""

    code = models.CharField("code", max_length=3, primary_key=True)
    name = models.CharField("nom", max_length=64)
    symbol = models.CharField("symbole", max_length=8, blank=True)
    decimal_places = models.PositiveSmallIntegerField(
        "décimales", default=2, help_text="0 pour GNF / XOF, 2 pour USD / EUR."
    )
    is_active = models.BooleanField("active", default=True)
    sort_order = models.PositiveSmallIntegerField("ordre", default=100)

    class Meta:
        verbose_name = "devise"
        verbose_name_plural = "devises"
        ordering = ["sort_order", "code"]

    def __str__(self):
        return self.code


class ExchangeRate(models.Model):
    """Taux de change : 1 unité de `base` = `rate` unités de `quote` au `as_of`."""

    base = models.ForeignKey(
        Currency, on_delete=models.CASCADE, related_name="rates_as_base", verbose_name="de"
    )
    quote = models.ForeignKey(
        Currency, on_delete=models.CASCADE, related_name="rates_as_quote", verbose_name="vers"
    )
    rate = models.DecimalField("taux", max_digits=24, decimal_places=12)
    as_of = models.DateField("date du taux")
    source = models.CharField("source", max_length=40, default="fawazahmed0")
    fetched_at = models.DateTimeField("récupéré le", auto_now=True)

    class Meta:
        verbose_name = "taux de change"
        verbose_name_plural = "taux de change"
        constraints = [
            models.UniqueConstraint(
                fields=["base", "quote", "as_of"], name="uniq_rate_base_quote_date"
            )
        ]
        indexes = [models.Index(fields=["base", "quote", "-as_of"])]
        ordering = ["-as_of"]

    def __str__(self):
        return f"{self.base_id}/{self.quote_id} = {self.rate} ({self.as_of})"
