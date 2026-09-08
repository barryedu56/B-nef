from django.contrib import admin

from .models import Product, SaleLine, StockMovement


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "activity", "stock_quantity", "purchase_price", "sale_price", "is_archived")
    list_filter = ("activity", "is_archived")
    search_fields = ("name", "sku")


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("occurred_on", "product", "type", "quantity", "unit_cost", "stock_after")
    list_filter = ("type",)
    date_hierarchy = "occurred_on"


@admin.register(SaleLine)
class SaleLineAdmin(admin.ModelAdmin):
    list_display = ("transaction", "product", "quantity", "unit_price", "unit_cost", "discount")
