"""Récupère les taux de change du jour depuis une API gratuite.

    py manage.py fetch_rates

Source : @fawazahmed0/currency-api (gratuit, sans clé, couvre GNF, XOF, USD, EUR...).
À planifier une fois par jour (Planificateur de tâches Windows, cron, ou Celery beat).
"""
from datetime import datetime
from decimal import Decimal

import requests
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.currencies.models import Currency, ExchangeRate


class Command(BaseCommand):
    help = "Télécharge et enregistre les taux de change des devises actives."

    def add_arguments(self, parser):
        parser.add_argument(
            "--base",
            action="append",
            help="Limiter à ces devises de base (répétable). Défaut : toutes les devises actives.",
        )

    def handle(self, *args, **options):
        bases = options.get("base")
        currencies = list(Currency.objects.filter(is_active=True))
        active_codes = {c.code for c in currencies}
        if bases:
            currencies = [c for c in currencies if c.code in {b.upper() for b in bases}]

        if not currencies:
            self.stderr.write("Aucune devise active. Lance d'abord les migrations.")
            return

        total = 0
        for base in currencies:
            payload = self._fetch(base.code)
            if payload is None:
                self.stderr.write(f"  {base.code} : échec du téléchargement")
                continue

            as_of = _parse_date(payload.get("date"))
            table = payload.get(base.code.lower(), {})
            written = 0
            for quote in active_codes:
                if quote == base.code:
                    continue
                value = table.get(quote.lower())
                if value is None:
                    continue
                ExchangeRate.objects.update_or_create(
                    base_id=base.code,
                    quote_id=quote,
                    as_of=as_of,
                    defaults={"rate": Decimal(str(value)), "source": "fawazahmed0"},
                )
                written += 1
            total += written
            self.stdout.write(f"  {base.code} -> {written} taux ({as_of})")

        self.stdout.write(self.style.SUCCESS(f"OK : {total} taux enregistrés."))

    def _fetch(self, base_code):
        for template in settings.EXCHANGE_RATE_SOURCES:
            url = template.format(base=base_code.lower())
            try:
                resp = requests.get(url, timeout=15)
                resp.raise_for_status()
                return resp.json()
            except (requests.RequestException, ValueError):
                continue
        return None


def _parse_date(raw):
    if raw:
        try:
            return datetime.strptime(raw, "%Y-%m-%d").date()
        except ValueError:
            pass
    return timezone.localdate()
