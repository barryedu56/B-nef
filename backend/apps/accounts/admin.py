from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import PasswordResetCode, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Bénef", {"fields": ("phone", "language", "base_currency", "display_currency")}),
    )
    list_display = ("username", "email", "phone", "base_currency", "is_staff")


@admin.register(PasswordResetCode)
class PasswordResetCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "code", "created_at", "used_at")
    readonly_fields = ("user", "code", "created_at", "used_at")
