"""Customer routes, mounted at /api/v1/ by config/urls.py."""

from rest_framework.routers import DefaultRouter

from apps.customers.views import ContactViewSet, CustomerViewSet

router = DefaultRouter()
router.register("customers", CustomerViewSet, basename="customer")
router.register("contacts", ContactViewSet, basename="contact")

urlpatterns = router.urls
