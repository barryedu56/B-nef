from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField("créé le", auto_now_add=True)
    updated_at = models.DateTimeField("modifié le", auto_now=True)

    class Meta:
        abstract = True


class IdempotencyRecord(models.Model):
    """Réponse déjà renvoyée pour une clé `Idempotency-Key`.

    L'app mobile hors-ligne renvoie une opération tant qu'elle n'a pas reçu
    de réponse : si la première tentative est bien arrivée mais que la
    réponse s'est perdue (réseau coupé), la seconde doit renvoyer le même
    résultat au lieu de créer une deuxième vente. Voir
    apps/common/idempotency.py.
    """

    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="+")
    key = models.CharField(max_length=64)
    method = models.CharField(max_length=8)
    path = models.CharField(max_length=255)
    status_code = models.PositiveSmallIntegerField()
    body = models.JSONField(null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "key"], name="uniq_idempotency_user_key")
        ]
