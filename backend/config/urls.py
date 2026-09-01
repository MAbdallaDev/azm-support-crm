from django.conf import settings
from django.conf.urls.static import static
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
    # Auth: login, refresh, me. Stories 05+ append their own app URL modules here.
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.customers.urls")),
    path("api/v1/", include("apps.tickets.urls")),
    path("api/v1/", include("apps.kb.urls")),
    path("api/v1/", include("apps.reports.urls")),
    path("api/v1/", include("apps.ai.urls")),
    # The portal is a separate trust boundary, so it gets its own prefix rather
    # than sharing the agent routes with a filter.
    path("api/v1/portal/", include("apps.portal.urls")),
]

# Every uploaded attachment 404'd — nothing ever served MEDIA_ROOT. Dev-only
# by design: `django.views.static.serve` (what `static()` wires up) has no
# place in a production deployment, which would front uploads with a real
# web server or object storage instead.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
