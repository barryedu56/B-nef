from django.apps import AppConfig


class CommonConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.common"
    verbose_name = "Commun"

    def ready(self):
        from .admin_setup import setup_admin_site

        setup_admin_site()
