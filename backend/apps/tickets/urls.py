"""Ticket routes, mounted at /api/v1/ by config/urls.py."""

from rest_framework.routers import DefaultRouter

from apps.tickets.views import (
    CannedReplyViewSet,
    CategoryViewSet,
    TagViewSet,
    TicketViewSet,
)

router = DefaultRouter()
router.register("tickets", TicketViewSet, basename="ticket")
router.register("categories", CategoryViewSet, basename="category")
router.register("tags", TagViewSet, basename="tag")
router.register("canned-replies", CannedReplyViewSet, basename="cannedreply")

urlpatterns = router.urls
