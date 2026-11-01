from django.contrib import admin

from apps.common.admin_setup import ReadOnlyAdmin

from .models import Product, SaleLine, StockMovement


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "activity", "stock_quantity", "purchase_price", "sale_price", "is_archived")
    list_filter = ("is_archived",)
    search_fields = ("name", "sku", "activity__name", "activity__owner__username")
    # Stock et coût : seulement via les mouvements (réappro, vente, inventaire).
    readonly_fields = ("stock_quantity", "purchase_price")


@admin.register(StockMovement)
class StockMovementAdmin(ReadOnlyAdmin):
    list_display = ("occurred_on", "product", "type", "quantity", "unit_cost", "stock_after")
    list_filter = ("type",)
    date_hierarchy = "occurred_on"


@admin.register(SaleLine)
class SaleLineAdmin(ReadOnlyAdmin):
    list_display = ("transaction", "product", "quantity", "unit_price", "unit_cost", "discount")
