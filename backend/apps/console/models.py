from django.conf import settings
from django.db import models


class AdminAction(models.Model):
    """Journal des actions faites depuis la console (qui, quoi, sur quel
    compte, quand) : protection en cas de litige avec un utilisateur."""

    admin = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    action = models.CharField("action", max_length=40)
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    target = models.CharField("cible", max_length=200, blank=True)
    details = models.JSONField("détails", default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "action d'administration"
        verbose_name_plural = "actions d'administration"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.created_at:%d/%m/%Y %H:%M} — {self.action} — {self.target}"
