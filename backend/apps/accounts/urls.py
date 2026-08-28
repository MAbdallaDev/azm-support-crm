"""Auth routes, mounted at /api/v1/ by config/urls.py."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import BranchViewSet, DepartmentViewSet, LoginView, MeView, RefreshView

router = DefaultRouter()
router.register("branches", BranchViewSet, basename="branch")
router.register("departments", DepartmentViewSet, basename="department")

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/refresh/", RefreshView.as_view(), name="token_refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
] + router.urls
