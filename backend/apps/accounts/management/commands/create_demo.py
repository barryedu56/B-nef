"""Compte de démonstration avec des données réalistes (examinateurs du Play
Store, présentations) :

    python manage.py create_demo --password "UnMotDePasseSolide"

Recrée le compte à chaque lancement (les anciennes données démo sont
effacées). Tout passe par les services métier : stock, coût moyen et
caisse sont cohérents comme pour un vrai utilisateur.
"""
import random
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.services import delete_account
from apps.activities.models import Activity
from apps.budget.models import Budget
from apps.contacts.models import Party
from apps.finance import accounts
from apps.finance.models import Category, PaymentMethod, Transaction
from apps.finance.services import create_transaction
from apps.inventory.models import Product
from apps.inventory.services import register_sale, restock

PRODUCTS = [
    ("Sac de riz 25 kg", 230000, 265000),
    ("Huile 5 L", 95000, 115000),
    ("Sucre 1 kg", 11000, 14000),
    ("Savon (carton)", 60000, 75000),
    ("Lait en poudre", 32000, 40000),
]


class Command(BaseCommand):
    help = "Crée (ou recrée) le compte de démonstration avec des données réalistes."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="demo")
        parser.add_argument("--password", required=True)
        parser.add_argument("--days", type=int, default=60)

    @transaction.atomic
    def handle(self, *args, username, password, days, **options):
        if len(password) < 10:
            raise CommandError("Mot de passe trop court (10 caractères minimum).")
        User = get_user_model()
        old = User.objects.filter(username=username).first()
        if old is not None:
            delete_account(old)
        user = User.objects.create_user(
            username=username, password=password, email=f"{username}@example.com", base_currency_id="GNF"
        )
        rnd = random.Random(42)
        today = timezone.localdate()
        start = today - timedelta(days=days)

        shop = Activity.objects.create(
            owner=user, name="Boutique Madina", type=Activity.Type.COMMERCE, currency_id="GNF",
            has_inventory=True, has_debts=True, has_budget=True,
        )
        Activity.objects.create(owner=user, name="Maison", type=Activity.Type.HOUSEHOLD, currency_id="GNF")
        cash = PaymentMethod.objects.get(owner=user, name="Espèces")
        om = PaymentMethod.objects.get(owner=user, name="Orange Money")
        bank = PaymentMethod.objects.get(owner=user, name="Banque")
        # Argent de départ, réparti comme dans la vraie vie : un peu
        # d'espèces, l'essentiel à la banque (qui paie les gros achats).
        for account, amount in ((cash, 1_500_000), (bank, 18_000_000)):
            create_transaction(activity=shop, direction="in", amount=Decimal(amount), currency="GNF",
                               occurred_on=start, kind=Transaction.Kind.CONTRIBUTION, payment_method=account,
                               note="Somme de départ")
        client = Party.objects.create(owner=user, name="Mariama Diallo", phone="622000001", kind="client")
        supplier = Party.objects.create(owner=user, name="Grossiste Kaloum", phone="628000002", kind="supplier")
        transport = Category.objects.get(owner=user, name="Transport")
        rent = Category.objects.get(owner=user, name="Loyer")

        products = []
        for name, cost, price in PRODUCTS:
            product = Product.objects.create(
                activity=shop, name=name, sale_price=Decimal(price), low_stock_threshold=Decimal(5)
            )
            restock(product=product, quantity=Decimal(20), unit_cost=Decimal(cost), occurred_on=start,
                    payment_method=bank, party=supplier, user=user)
            products.append(product)

        for offset in range(days):
            day = start + timedelta(days=offset + 1)
            for _ in range(rnd.randint(1, 3)):
                lines = []
                for product in rnd.sample(products, 2):
                    product.refresh_from_db()
                    qty = Decimal(rnd.randint(1, 2))
                    if product.stock_quantity < qty + product.low_stock_threshold:
                        cost = next(c for n, c, _ in PRODUCTS if n == product.name)
                        restock(product=product, quantity=Decimal(30), unit_cost=Decimal(cost), occurred_on=day,
                                payment_method=bank, party=supplier, user=user)
                        product.refresh_from_db()
                    lines.append({"product": product, "quantity": qty})
                register_sale(activity=shop, lines=lines, occurred_on=day,
                              payment_method=rnd.choice([cash, om]), user=user)
            if offset % 7 == 6:
                # Chaque semaine, l'argent au-delà d'un fonds de caisse part à
                # la banque (espèces déposées, Orange Money viré).
                balances = accounts.balances(user)
                for account, keep, label in ((cash, 1_000_000, "Dépôt des espèces"), (om, 500_000, "Virement Orange Money")):
                    surplus = balances[account.pk] - Decimal(keep)
                    if surplus > 0:
                        accounts.transfer(user=user, from_account=account, to_account=bank, amount=surplus,
                                          from_activity=shop, to_activity=shop, occurred_on=day,
                                          note=f"{label} à la banque")
            if offset % 7 == 0:
                create_transaction(activity=shop, direction="out", amount=Decimal(rnd.randint(3, 8) * 10000),
                                   currency="GNF", occurred_on=day, category=transport, payment_method=cash,
                                   note="Transport marchandises")
        create_transaction(activity=shop, direction="out", amount=Decimal(1500000), currency="GNF",
                           occurred_on=today.replace(day=1), category=rent, payment_method=om, note="Loyer boutique")
        products[0].refresh_from_db()
        register_sale(activity=shop, lines=[{"product": products[0], "quantity": Decimal(2)}], occurred_on=today,
                      party=client, is_credit=True, amount_paid_now=Decimal(200000), payment_method=cash, user=user)
        Budget.objects.create(owner=user, activity=shop, category=transport, period="month",
                              amount=Decimal(250000), currency_id="GNF", starts_on=start)

        self.stdout.write(self.style.SUCCESS(f"Compte « {username} » prêt ({days} jours de données)."))
