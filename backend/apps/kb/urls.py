"""Knowledge base routes, mounted at /api/v1/ by config/urls.py."""

from rest_framework.routers import DefaultRouter

from apps.kb.views import KBArticleViewSet, KBCategoryViewSet

router = DefaultRouter()
router.register("kb/categories", KBCategoryViewSet, basename="kbcategory")
router.register("kb/articles", KBArticleViewSet, basename="kbarticle")

urlpatterns = router.urls
