from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.activities.views import ActivityViewSet
from apps.budget.views import BudgetViewSet
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
router.register("currencies", CurrencyViewSet, basename="currency")
router.register("exchange-rates", ExchangeRateViewSet, basename="exchangerate")

api_patterns = [
    path("auth/", include("apps.accounts.urls")),
    path("convert/", ConvertView.as_view(), name="currency-convert"),
    path("sales/", SaleView.as_view(), name="sale-create"),
    path("purchases/", PurchaseView.as_view(), name="purchase-create"),
    path("stock-adjustments/", StockAdjustmentView.as_view(), name="stock-adjustment"),
    path("personal-use/", PersonalUseView.as_view(), name="personal-use"),
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
