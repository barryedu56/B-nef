from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.activities.views import ActivityViewSet
from apps.budget.views import BudgetViewSet, RecurringOperationViewSet
from apps.contacts.views import PartyViewSet
from apps.currencies.views import ConvertView, CurrencyViewSet, ExchangeRateViewSet
from apps.finance.views import (
    CategoryViewSet,
    PaymentMethodViewSet,
    PersonalUseView,
    PurchaseView,
    SaleView,
    StockAdjustmentView,
    TransactionViewSet,
    TransferView,
)
from apps.inventory.views import ProductViewSet, SaleLineViewSet, StockMovementViewSet

router = DefaultRouter()
router.register("activities", ActivityViewSet, basename="activity")
router.register("categories", CategoryViewSet, basename="category")
router.register("payment-methods", PaymentMethodViewSet, basename="paymentmethod")
router.register("transactions", TransactionViewSet, basename="transaction")
router.register("products", ProductViewSet, basename="product")
router.register("stock-movements", StockMovementViewSet, basename="stockmovement")
router.register("sale-lines", SaleLineViewSet, basename="saleline")
router.register("parties", PartyViewSet, basename="party")
router.register("budgets", BudgetViewSet, basename="budget")
router.register("recurring", RecurringOperationViewSet, basename="recurring")
router.register("currencies", CurrencyViewSet, basename="currency")
router.register("exchange-rates", ExchangeRateViewSet, basename="exchangerate")

def health(_request):
    """Réponse minimale (pas de base de données, pas de connexion) : l'app
    mobile s'en sert pour savoir si le serveur Bénef est joignable."""
    return JsonResponse({"ok": True})


api_patterns = [
    path("health/", health, name="health"),
    path("auth/", include("apps.accounts.urls")),
    path("convert/", ConvertView.as_view(), name="currency-convert"),
    path("sales/", SaleView.as_view(), name="sale-create"),
    path("purchases/", PurchaseView.as_view(), name="purchase-create"),
    path("stock-adjustments/", StockAdjustmentView.as_view(), name="stock-adjustment"),
    path("personal-use/", PersonalUseView.as_view(), name="personal-use"),
    path("transfers/", TransferView.as_view(), name="transfer-create"),
    path("reports/", include("apps.reports.urls")),
    path("", include(router.urls)),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include((api_patterns, "api"))),
    path("api-auth/", include("rest_framework.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
