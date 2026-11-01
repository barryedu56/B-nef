from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from django.db.models import Count

from .models import PasswordResetCode, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Bénef", {"fields": ("phone", "language", "base_currency", "display_currency")}),
    )
    list_display = (
        "username", "email", "phone", "date_joined", "last_login", "activity_count", "transaction_count", "is_active",
    )
    list_filter = ("is_active", "is_staff", "base_currency", "date_joined")
    search_fields = ("username", "email", "phone")
    ordering = ("-date_joined",)
    actions = ("deactivate", "reactivate")

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _activities=Count("activities", distinct=True),
            _transactions=Count("activities__transactions", distinct=True),
        )

    @admin.display(description="Activités", ordering="_activities")
    def activity_count(self, obj):
        return obj._activities

    @admin.display(description="Opérations", ordering="_transactions")
    def transaction_count(self, obj):
        return obj._transactions

    @admin.action(description="Désactiver le compte (ne peut plus se connecter, données gardées)")
    def deactivate(self, request, queryset):
        count = queryset.exclude(pk=request.user.pk).update(is_active=False)
        self.message_user(request, f"{count} compte(s) désactivé(s).", messages.SUCCESS)

    @admin.action(description="Réactiver le compte")
    def reactivate(self, request, queryset):
        count = queryset.update(is_active=True)
        self.message_user(request, f"{count} compte(s) réactivé(s).", messages.SUCCESS)


@admin.register(PasswordResetCode)
class PasswordResetCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "attempts", "created_at", "used_at")
    readonly_fields = ("user", "attempts", "created_at", "used_at")
