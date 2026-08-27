"""Knowledge base API — browsed by agents in story 08 and by customers in the portal."""

from django.db.models import Count, F
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAgentOrAbove
from apps.accounts.scoping import ScopedQuerySetMixin, scope_kb_articles
from apps.kb.models import KBArticle, KBCategory
from apps.kb.serializers import (
    KBArticleDetailSerializer,
    KBArticleListSerializer,
    KBArticleWriteSerializer,
    KBCategorySerializer,
)
from apps.tickets.pagination import StandardPagination


@extend_schema(tags=["kb"])
class KBCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Reference data. Categories are edited in Django admin, not here."""

    permission_classes = [IsAuthenticated]
    serializer_class = KBCategorySerializer
    pagination_class = None
    lookup_field = "slug"

    def get_queryset(self):
        # Annotated rather than counted per row: story 08's sidebar renders the
        # count beside every category.
        return KBCategory.objects.annotate(article_count=Count("articles")).all()


@extend_schema(tags=["kb"])
class KBArticleViewSet(ScopedQuerySetMixin, viewsets.ModelViewSet):
    """Full CRUD for staff; read-only for customers.

    The read/write split is enforced by two things working together:
    `scope_kb_articles` hides drafts from customers, and `get_permissions`
    refuses write verbs to anyone below agent. Either alone would be a hole.
    """

    scope_function = staticmethod(scope_kb_articles)
    queryset = KBArticle.objects.select_related("category", "author").all()
    pagination_class = StandardPagination
    lookup_field = "slug"
    filter_backends = [OrderingFilter]
    ordering_fields = ("updated_at", "view_count", "helpful_count", "title_en")
    ordering = ("-updated_at",)
    filterset_fields = ["category", "status"]

    def get_permissions(self):
        if self.action in ("list", "retrieve", "helpful"):
            return [IsAuthenticated()]
        return [IsAgentOrAbove()]

    def get_serializer_class(self):
        if self.action == "list":
            return KBArticleListSerializer
        if self.action in ("create", "update", "partial_update"):
            return KBArticleWriteSerializer
        return KBArticleDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category__slug=category)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        search = self.request.query_params.get("q")
        if search:
            # icontains across both languages. Postgres full-text search with
            # Arabic stemming is Phase 2; this matches substrings, which is what
            # a 10-article knowledge base actually needs. Verified against real
            # Arabic strings in test_kb_api.py — "it compiles" is not evidence
            # that a non-ASCII icontains behaves as expected under a given
            # collation.
            from django.db.models import Q

            qs = qs.filter(
                Q(title_en__icontains=search)
                | Q(title_ar__icontains=search)
                | Q(body_en__icontains=search)
                | Q(body_ar__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @extend_schema(
        summary="An article, incrementing its view count",
        parameters=[OpenApiParameter("q", str, description="Ignored on retrieve.")],
        responses={200: KBArticleDetailSerializer},
    )
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # F() expression, not read-modify-write: two concurrent readers doing
        # `article.view_count += 1; save()` both read the same number and one
        # increment is lost. This is a single atomic UPDATE and costs no extra
        # round trip.
        KBArticle.objects.filter(pk=instance.pk).update(view_count=F("view_count") + 1)
        instance.view_count += 1
        return Response(self.get_serializer(instance).data)

    @extend_schema(
        summary="Mark an article helpful",
        request=None,
        responses={200: OpenApiResponse(description="The new helpful_count.")},
    )
    @action(detail=True, methods=["post"], url_path="helpful")
    def helpful(self, request, slug=None):
        instance = self.get_object()
        KBArticle.objects.filter(pk=instance.pk).update(
            helpful_count=F("helpful_count") + 1
        )
        instance.refresh_from_db(fields=["helpful_count"])
        return Response({"helpful_count": instance.helpful_count})
