"""Auth routes, mounted at /api/v1/ by config/urls.py."""

from django.urls import path

from .views import LoginView, MeView, RefreshView

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/refresh/", RefreshView.as_view(), name="token_refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
]
