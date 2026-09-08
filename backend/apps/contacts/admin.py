from django.contrib import admin

from .models import Party


@admin.register(Party)
class PartyAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "kind", "phone", "is_archived")
    list_filter = ("kind", "is_archived")
    search_fields = ("name", "phone")
