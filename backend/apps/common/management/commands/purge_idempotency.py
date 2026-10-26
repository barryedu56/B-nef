from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.common.models import IdempotencyRecord


class Command(BaseCommand):
    help = "Supprime les clés Idempotency-Key de plus de N jours (défaut : 30)."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=30)

    def handle(self, *args, days, **options):
        cutoff = timezone.now() - timedelta(days=days)
        deleted, _ = IdempotencyRecord.objects.filter(created_at__lt=cutoff).delete()
        self.stdout.write(self.style.SUCCESS(f"{deleted} clé(s) supprimée(s)."))
