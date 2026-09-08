"""À la création d'un utilisateur : catégories et moyens de paiement par défaut."""
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

DEFAULT_CATEGORIES = [
    ("in", ["Ventes", "Salaire", "Prestation de service", "Loyer perçu", "Autre entrée"]),
    (
        "out",
        [
            "Achat de marchandise",
            "Loyer",
            "Salaires",
            "Transport",
            "Carburant",
            "Électricité",
            "Eau",
            "Téléphone / Internet",
            "Impôts & taxes",
            "Alimentation",
            "Autre dépense",
        ],
    ),
]

DEFAULT_PAYMENT_METHODS = [
    ("Espèces", True),
    ("Orange Money", False),
    ("Wave", False),
    ("Banque", False),
]


@receiver(post_save, sender=settings.AUTH_USER_MODEL, dispatch_uid="accounts_user_defaults")
def create_user_defaults(sender, instance, created, **kwargs):
    if not created:
        return
    from apps.finance.models import Category, PaymentMethod

    Category.objects.bulk_create(
        [
            Category(owner=instance, name=name, direction=direction, is_system=True)
            for direction, names in DEFAULT_CATEGORIES
            for name in names
        ]
    )
    PaymentMethod.objects.bulk_create(
        [PaymentMethod(owner=instance, name=name, is_cash=is_cash) for name, is_cash in DEFAULT_PAYMENT_METHODS]
    )
