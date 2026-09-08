# Reconstruit `settled_amount` pour les transactions à crédit déjà existantes,
# à partir des vrais règlements enregistrés (kind=settlement, settles=<txn>,
# non annulés) — plutôt que de supposer que `is_settled=True` <=> réglée en
# totalité, ce qui était vrai jusqu'ici en pratique (aucune UI n'exposait de
# montant partiel) mais qu'on préfère vérifier sur les données réelles.
from decimal import Decimal

from django.db import migrations
from django.db.models import Sum


def backfill(apps, schema_editor):
    Transaction = apps.get_model("finance", "Transaction")
    credits = Transaction.objects.filter(is_credit=True)
    for txn in credits.iterator():
        total = (
            Transaction.objects.filter(settles_id=txn.id, voided_at__isnull=True)
            .aggregate(total=Sum("amount"))
            .get("total")
        ) or Decimal("0")
        is_settled = total >= txn.amount
        if total != txn.settled_amount or is_settled != txn.is_settled:
            txn.settled_amount = total
            txn.is_settled = is_settled
            txn.save(update_fields=["settled_amount", "is_settled"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0004_transaction_settled_amount'),
    ]

    operations = [
        migrations.RunPython(backfill, noop),
    ]
