from django.contrib import admin

from apps.common.admin_setup import ReadOnlyAdmin

from .models import CashCount, Category, PaymentMethod, Transaction


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "activity", "direction", "is_system")
    list_filter = ("direction", "is_system")
    search_fields = ("name", "owner__username")


@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "is_cash", "currency")
    search_fields = ("name", "owner__username")


@admin.register(Transaction)
class TransactionAdmin(ReadOnlyAdmin):
    list_display = (
        "occurred_on", "owner", "activity", "kind", "direction", "amount", "currency", "payment_method",
        "is_credit", "is_settled", "voided_at",
    )
    list_filter = ("kind", "direction", "is_credit", "currency")
    date_hierarchy = "occurred_on"
    search_fields = ("note", "activity__name", "activity__owner__username")
    list_select_related = ("activity__owner", "payment_method")

    @admin.display(description="Utilisateur", ordering="activity__owner__username")
    def owner(self, obj):
        return obj.activity.owner


@admin.register(CashCount)
class CashCountAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "owner", "payment_method", "activity", "expected", "counted", "difference", "activity_only")
    search_fields = ("owner__username",)
