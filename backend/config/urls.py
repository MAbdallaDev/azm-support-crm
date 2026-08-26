from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from config.health import health

urlpatterns = [
    # Django admin is this project's back-office — the equivalent of Odoo's
    # backend list/form views. Stories 02+ register models against it.
    path("admin/", admin.site.urls),
    path("api/v1/health/", health, name="health"),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/v1/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    # Auth: login, refresh, me. Stories 04+ append their own app URL modules here.
    path("api/v1/", include("apps.accounts.urls")),
]
