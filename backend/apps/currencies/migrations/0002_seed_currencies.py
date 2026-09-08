from django.db import migrations

CURRENCIES = [
    # code, nom, symbole, décimales, ordre
    ("GNF", "Franc guinéen", "FG", 0, 1),
    ("XOF", "Franc CFA (BCEAO)", "FCFA", 0, 2),
    ("USD", "Dollar américain", "$", 2, 3),
    ("EUR", "Euro", "€", 2, 4),
]


def seed(apps, schema_editor):
    Currency = apps.get_model("currencies", "Currency")
    for code, name, symbol, decimals, order in CURRENCIES:
        Currency.objects.update_or_create(
            code=code,
            defaults={
                "name": name,
                "symbol": symbol,
                "decimal_places": decimals,
                "sort_order": order,
                "is_active": True,
            },
        )


def unseed(apps, schema_editor):
    Currency = apps.get_model("currencies", "Currency")
    Currency.objects.filter(code__in=[c[0] for c in CURRENCIES]).delete()


class Migration(migrations.Migration):
    dependencies = [("currencies", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
