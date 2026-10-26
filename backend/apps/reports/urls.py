from django.urls import path

from .views import ActivitySummaryView, ExportView, GlobalSummaryView, ReportPdfView

urlpatterns = [
    path("global/", GlobalSummaryView.as_view(), name="report-global"),
    path("activity/<int:activity_id>/", ActivitySummaryView.as_view(), name="report-activity"),
    path("pdf/", ReportPdfView.as_view(), name="report-pdf"),
    path("export/", ExportView.as_view(), name="report-export"),
]
