from django.contrib import admin

from .models import Category, PaymentMethod, Transaction


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "activity", "direction", "is_system")
    list_filter = ("direction", "is_system")


@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "is_cash")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        "occurred_on", "activity", "direction", "kind", "amount", "currency",
        "amount_base", "is_credit", "settled_amount", "is_settled",
    )
    list_filter = ("direction", "kind", "is_credit", "currency")
    date_hierarchy = "occurred_on"
    search_fields = ("note", "activity__name")
    autocomplete_fields = ()
