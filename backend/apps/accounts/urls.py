"""Auth routes, mounted at /api/v1/ by config/urls.py."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    BranchViewSet,
    ChangePasswordView,
    DepartmentViewSet,
    LoginView,
    MeView,
    NotificationUnreadCountView,
    NotificationViewSet,
    RefreshView,
)

router = DefaultRouter()
router.register("branches", BranchViewSet, basename="branch")
router.register("departments", DepartmentViewSet, basename="department")
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/refresh/", RefreshView.as_view(), name="token_refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change-password"),
    path(
        "notifications/unread-count/",
        NotificationUnreadCountView.as_view(),
        name="notification-unread-count",
    ),
] + router.urls
