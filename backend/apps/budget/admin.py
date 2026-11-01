from django.contrib import admin

from .models import Budget, RecurringOperation


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ("__str__", "owner", "activity", "category", "period", "amount", "currency", "starts_on")
    list_filter = ("period", "currency")


@admin.register(RecurringOperation)
class RecurringOperationAdmin(admin.ModelAdmin):
    list_display = ("label", "owner", "activity", "amount", "frequency", "next_due", "is_active")
    list_filter = ("frequency", "is_active")
    search_fields = ("label", "owner__username")
