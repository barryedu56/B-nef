from django.urls import path

from . import views

urlpatterns = [
    path("overview/", views.OverviewView.as_view()),
    path("feed/", views.FeedView.as_view()),
    path("health/", views.HealthView.as_view()),
    path("users/", views.UsersView.as_view()),
    path("users/<int:pk>/", views.UserDetailView.as_view()),
    path("users/<int:pk>/<str:action>/", views.UserActionView.as_view()),
    path("operations/", views.OperationsView.as_view()),
    path("operations/<int:pk>/void/", views.VoidOperationView.as_view()),
    path("rates/", views.RatesView.as_view()),
    path("journal/", views.JournalView.as_view()),
]
