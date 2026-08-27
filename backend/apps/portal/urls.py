"""Portal routes, mounted at /api/v1/portal/ by config/urls.py."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.portal.views import PortalCSATView, PortalKBArticleViewSet, PortalTicketViewSet

router = DefaultRouter()
router.register("tickets", PortalTicketViewSet, basename="portal-ticket")
router.register("kb/articles", PortalKBArticleViewSet, basename="portal-kbarticle")

urlpatterns = [
    path("csat/", PortalCSATView.as_view(), name="portal-csat"),
    *router.urls,
]
