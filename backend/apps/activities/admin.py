from django.contrib import admin

from .models import Activity


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "type", "currency", "has_inventory", "has_debts", "is_archived")
    list_filter = ("type", "currency", "has_inventory", "is_archived")
    search_fields = ("name", "owner__username")
