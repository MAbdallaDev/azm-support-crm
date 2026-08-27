"""AI routes, mounted at /api/v1/ by config/urls.py."""

from django.urls import path

from apps.ai.views import CategorizeView, SuggestReplyView, SummarizeView

urlpatterns = [
    path("ai/summarize/", SummarizeView.as_view(), name="ai-summarize"),
    path("ai/suggest-reply/", SuggestReplyView.as_view(), name="ai-suggest-reply"),
    path("ai/categorize/", CategorizeView.as_view(), name="ai-categorize"),
]
