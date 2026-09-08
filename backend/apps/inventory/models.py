from django.db import models

from apps.common.models import TimeStampedModel


class Product(TimeStampedModel):
    """Article en stock. Prix exprimés dans la devise de l'activité.

    `purchase_price` est le **coût moyen pondéré** courant, recalculé à chaque
    réapprovisionnement.
    """

    activity = models.ForeignKey(
        "activities.Activity", on_delete=models.CASCADE, related_name="products"
    )
    name = models.CharField("nom", max_length=120)
    sku = models.CharField("référence", max_length=40, blank=True)
    unit = models.CharField("unité", max_length=20, default="pièce")

    purchase_price = models.DecimalField(
        "prix d'achat (coût moyen)", max_digits=20, decimal_places=2, default=0
    )
    sale_price = models.DecimalField("prix de vente", max_digits=20, decimal_places=2, default=0)
    stock_quantity = models.DecimalField(
        "quantité en stock", max_digits=16, decimal_places=3, default=0
    )
    low_stock_threshold = models.DecimalField(
        "seuil d'alerte", max_digits=16, decimal_places=3, null=True, blank=True
    )
    category = models.CharField("catégorie", max_length=60, blank=True)
    is_archived = models.BooleanField("archivé", default=False)

    class Meta:
        verbose_name = "produit"
        verbose_name_plural = "produits"
        ordering = ["name"]
        indexes = [models.Index(fields=["activity", "is_archived"])]

    def __str__(self):
        return self.name

    @property
    def margin(self):
        return self.sale_price - self.purchase_price

    @property
    def stock_value(self):
        return self.stock_quantity * self.purchase_price

    @property
    def is_low_stock(self):
        if self.low_stock_threshold is None:
            return False
        return self.stock_quantity <= self.low_stock_threshold


class StockMovement(TimeStampedModel):
    class Type(models.TextChoices):
        IN = "in", "Entrée (achat)"
        OUT = "out", "Sortie (vente)"
        ADJUST = "adjust", "Ajustement (perte, casse, inventaire)"
        PERSONAL = "personal", "Consommation personnelle"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="movements")
    type = models.CharField("type", max_length=8, choices=Type.choices)
    quantity = models.DecimalField("quantité", max_digits=16, decimal_places=3)
    unit_cost = models.DecimalField("coût unitaire", max_digits=20, decimal_places=2, default=0)
    stock_after = models.DecimalField("stock après", max_digits=16, decimal_places=3)
    transaction = models.ForeignKey(
        "finance.Transaction",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_movements",
    )
    occurred_on = models.DateField("date")
    note = models.CharField("motif", max_length=255, blank=True)

    class Meta:
        verbose_name = "mouvement de stock"
        verbose_name_plural = "mouvements de stock"
        ordering = ["-occurred_on", "-created_at"]

    def __str__(self):
        return f"{self.get_type_display()} {self.quantity} × {self.product}"


class SaleLine(TimeStampedModel):
    transaction = models.ForeignKey(
        "finance.Transaction", on_delete=models.CASCADE, related_name="sale_lines"
    )
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="sale_lines")
    quantity = models.DecimalField("quantité", max_digits=16, decimal_places=3)
    unit_price = models.DecimalField("prix de vente unitaire", max_digits=20, decimal_places=2)
    unit_cost = models.DecimalField(
        "coût unitaire (figé)", max_digits=20, decimal_places=2, default=0
    )
    discount = models.DecimalField("remise", max_digits=20, decimal_places=2, default=0)

    class Meta:
        verbose_name = "ligne de vente"
        verbose_name_plural = "lignes de vente"

    @property
    def line_total(self):
        return self.quantity * self.unit_price - self.discount

    @property
    def line_margin(self):
        return self.line_total - self.quantity * self.unit_cost
