"""Report routes, mounted at /api/v1/ by config/urls.py."""

from django.urls import path

from apps.reports.views import (
    AgentsReportView,
    CSATReportView,
    MySummaryView,
    OverviewReportView,
    VolumeReportView,
)

urlpatterns = [
    path("reports/overview/", OverviewReportView.as_view(), name="report-overview"),
    path("reports/volume/", VolumeReportView.as_view(), name="report-volume"),
    path("reports/agents/", AgentsReportView.as_view(), name="report-agents"),
    path("reports/csat/", CSATReportView.as_view(), name="report-csat"),
    # Agent-reachable, unlike the four above. Story 07's dashboard.
    path("reports/my-summary/", MySummaryView.as_view(), name="report-my-summary"),
]
