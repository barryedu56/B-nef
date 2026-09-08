from django.contrib import admin

from .models import Budget


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ("__str__", "owner", "activity", "category", "period", "amount", "currency", "starts_on")
    list_filter = ("period", "currency")
