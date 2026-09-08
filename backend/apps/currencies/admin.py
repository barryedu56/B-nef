from django.contrib import admin

from .models import Currency, ExchangeRate


@admin.register(Currency)
class CurrencyAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "symbol", "decimal_places", "is_active", "sort_order")
    list_editable = ("is_active", "sort_order")


@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = ("base", "quote", "rate", "as_of", "source", "fetched_at")
    list_filter = ("base", "quote", "source")
    date_hierarchy = "as_of"
