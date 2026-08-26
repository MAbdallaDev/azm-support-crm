"""Agent-facing REST API for tickets and their sub-resources.

Every viewset here inherits `ScopedQuerySetMixin` and sets `scope_function`.
That is not optional: the mixin raises `NotImplementedError` when it is missing,
because a silently unscoped queryset on a view that advertises itself as scoped
is the exact failure story 03 exists to prevent.

Sub-resources are `@action(detail=True)` rather than a nested router —
`drf-nested-routers` would be a new dependency and the stack is fixed.

**No viewset assigns `ticket.status`.** Every status change goes through
`services.ticket_service`, which validates the transition, stamps the
timestamps and writes the Activity log entry.
"""

import os

from django.db.models import Prefetch
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import status as http_status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.permissions import IsAgentOrAbove
from apps.accounts.scoping import (
    ScopedQuerySetMixin,
    scope_ticket_messages,
    scope_tickets,
)
from apps.tickets.filters import TicketFilterSet
from apps.tickets.models import (
    Attachment,
    CannedReply,
    Category,
    Tag,
    Ticket,
    TicketMessage,
)
from apps.tickets.pagination import StandardPagination
from apps.tickets.serializers import (
    AssignRequestSerializer,
    AttachmentSerializer,
    CannedReplySerializer,
    CategorySerializer,
    EscalateRequestSerializer,
    ResolveRequestSerializer,
    StatusRequestSerializer,
    TagSerializer,
    TicketDetailSerializer,
    TicketEventSerializer,
    TicketListSerializer,
    TicketMessageSerializer,
    TicketWriteSerializer,
)
from apps.tickets.services import ticket_service

# ---------------------------------------------------------------------------
# Attachment upload policy
# ---------------------------------------------------------------------------

MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024  # 10 MB

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "text/csv",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation",
}


def sanitise_filename(name: str) -> str:
    """Reduce an uploaded name to a bare, safe filename.

    Django's `upload_to` already protects the path on disk, but the `filename`
    column is ours and story 07 echoes it back into the browser — an
    unsanitised value is a stored-XSS vector there, not merely an untidy string.

    `../../etc/passwd` must land as `passwd`.
    """
    name = (name or "").replace("\x00", "")
    # basename() alone is not enough: a Windows-style "..\\..\\file" survives it
    # on POSIX, so both separators are normalised first.
    name = name.replace("\\", "/")
    name = os.path.basename(name)
    name = name.strip().lstrip(".")
    name = name.replace("/", "")
    return (name or "upload")[:255]


class TicketViewSet(ScopedQuerySetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAgentOrAbove]
    # staticmethod matters: assigned bare, the function becomes an instance
    # method and the mixin's call passes the wrong first argument.
    scope_function = staticmethod(scope_tickets)
    queryset = Ticket.objects.all()
    pagination_class = StandardPagination
    filterset_class = TicketFilterSet
    # Declared per-viewset rather than globally, so the lookup endpoints below
    # stay cheap by not paying for search and ordering machinery.
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ("number", "subject", "customer__name", "customer__company")
    ordering_fields = ("created_at", "updated_at", "priority", "sla_resolution_due_at")
    ordering = ("-created_at",)

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == "list":
            # The queue is the most performance-sensitive route in the product:
            # each row renders customer, assignee, category and SLA state. Without
            # these joins that is five extra queries per row against ~150 seeded
            # tickets. test_queue_performance.py pins the property.
            return qs.select_related(
                "customer", "contact", "assignee", "category",
                "department", "branch", "sla_policy",
            )
        if self.action == "retrieve":
            return qs.select_related(
                "customer", "contact", "assignee", "created_by", "category",
                "department", "branch", "sla_policy", "ai_suggested_category", "csat",
            ).prefetch_related("tags")
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return TicketListSerializer
        if self.action in ("create", "update", "partial_update"):
            return TicketWriteSerializer
        return TicketDetailSerializer

    def perform_create(self, serializer):
        ticket = serializer.save(created_by=self.request.user)
        ticket_service.log_event(
            ticket, self.request.user, ticket_service.EVENT_CREATED, new=ticket.status
        )

    def perform_update(self, serializer):
        before = serializer.instance.priority
        ticket = serializer.save()
        if ticket.priority != before:
            ticket_service.log_event(
                ticket,
                self.request.user,
                ticket_service.EVENT_PRIORITY_CHANGED,
                field="priority",
                old=before,
                new=ticket.priority,
            )

    # -- sub-resources ------------------------------------------------------

    @extend_schema(
        summary="Conversation and internal notes on a ticket",
        request=TicketMessageSerializer,
        responses={200: TicketMessageSerializer(many=True), 201: TicketMessageSerializer},
    )
    @action(detail=True, methods=["get", "post"], url_path="messages")
    def messages(self, request, pk=None):
        ticket = self.get_object()
        if request.method == "GET":
            # Routed through scope_ticket_messages rather than ticket.messages
            # so the customer/internal-note boundary holds even here, where the
            # caller is already agent-or-above.
            qs = scope_ticket_messages(
                TicketMessage.objects.filter(ticket=ticket), request.user
            ).select_related("author")
            return Response(TicketMessageSerializer(qs, many=True).data)

        serializer = TicketMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = serializer.save(
            ticket=ticket,
            author=request.user,
            channel=serializer.validated_data.get("channel") or ticket.channel,
        )

        if not message.is_internal:
            # Only a public reply from staff counts: an internal note is one the
            # customer never saw, so it cannot be a "first response".
            ticket_service.record_first_response(ticket)

        ticket_service.log_event(
            ticket,
            request.user,
            ticket_service.EVENT_NOTE_ADDED
            if message.is_internal
            else ticket_service.EVENT_MESSAGE_ADDED,
            new=message.body[:160],
        )
        return Response(
            TicketMessageSerializer(message).data, status=http_status.HTTP_201_CREATED
        )

    @extend_schema(
        summary="Activity log for a ticket (append-only)",
        responses={200: TicketEventSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="events")
    def events(self, request, pk=None):
        ticket = self.get_object()
        qs = ticket.events.select_related("actor").all()
        return Response(TicketEventSerializer(qs, many=True).data)

    @extend_schema(
        summary="List or upload attachments",
        request={"multipart/form-data": AttachmentSerializer},
        responses={200: AttachmentSerializer(many=True), 201: AttachmentSerializer},
    )
    @action(
        detail=True,
        methods=["get", "post"],
        url_path="attachments",
        parser_classes=[MultiPartParser, FormParser],
    )
    def attachments(self, request, pk=None):
        ticket = self.get_object()
        if request.method == "GET":
            qs = ticket.attachments.select_related("uploaded_by").all()
            return Response(AttachmentSerializer(qs, many=True).data)

        upload = request.FILES.get("file")
        if upload is None:
            raise ValidationError({"file": "No file was submitted."})

        # size is read from the handle, never from the payload — a client-supplied
        # size would let an oversize upload declare itself small.
        if upload.size > MAX_ATTACHMENT_BYTES:
            raise ValidationError(
                {
                    "file": f"File is {upload.size} bytes; the limit is "
                    f"{MAX_ATTACHMENT_BYTES} bytes (10 MB)."
                }
            )

        content_type = (upload.content_type or "").split(";")[0].strip().lower()
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise ValidationError(
                {"file": f"Files of type '{content_type}' are not accepted."}
            )

        attachment = Attachment.objects.create(
            ticket=ticket,
            message_id=request.data.get("message") or None,
            file=upload,
            filename=sanitise_filename(upload.name),
            size=upload.size,
            uploaded_by=request.user,
        )
        ticket_service.log_event(
            ticket,
            request.user,
            ticket_service.EVENT_ATTACHMENT_ADDED,
            new=attachment.filename,
        )
        return Response(
            AttachmentSerializer(attachment).data, status=http_status.HTTP_201_CREATED
        )

    # -- transitions --------------------------------------------------------

    @extend_schema(
        summary="Assign a ticket, or auto-assign the least-loaded available agent",
        request=AssignRequestSerializer,
        responses={200: TicketDetailSerializer},
    )
    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        ticket = self.get_object()
        payload = AssignRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        assignee = None
        assignee_id = payload.validated_data.get("assignee")
        if assignee_id:
            from django.contrib.auth import get_user_model

            assignee = get_user_model().objects.filter(pk=assignee_id).first()
            if assignee is None:
                raise ValidationError({"assignee": f"No user with id {assignee_id}."})

        ticket = ticket_service.assign(
            ticket, assignee, request.user, payload.validated_data.get("reason", "")
        )
        return Response(TicketDetailSerializer(ticket).data)

    @extend_schema(
        summary="Move a ticket through the status state machine",
        description=(
            "Validated against the transition map in `services.ticket_service`. "
            "A move the map does not allow returns 400 naming both states."
        ),
        request=StatusRequestSerializer,
        responses={
            200: TicketDetailSerializer,
            400: OpenApiResponse(description="Transition not allowed from the current status."),
        },
    )
    @action(detail=True, methods=["post"], url_path="status")
    def status(self, request, pk=None):
        ticket = self.get_object()
        payload = StatusRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        try:
            ticket = ticket_service.transition_status(
                ticket,
                payload.validated_data["status"],
                request.user,
                payload.validated_data.get("note", ""),
            )
        except ticket_service.InvalidTransition as exc:
            # The service stays free of HTTP concerns; the translation happens
            # here, at the boundary. The message names both states.
            raise ValidationError({"status": str(exc)}) from exc
        return Response(TicketDetailSerializer(ticket).data)

    @extend_schema(
        summary="Escalate a ticket",
        request=EscalateRequestSerializer,
        responses={200: TicketDetailSerializer},
    )
    @action(detail=True, methods=["post"], url_path="escalate")
    def escalate(self, request, pk=None):
        ticket = self.get_object()
        payload = EscalateRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        try:
            ticket = ticket_service.escalate(
                ticket, request.user, payload.validated_data.get("reason", "")
            )
        except ticket_service.InvalidTransition as exc:
            raise ValidationError({"status": str(exc)}) from exc
        return Response(TicketDetailSerializer(ticket).data)

    @extend_schema(
        summary="Resolve a ticket, optionally recording a public resolution note",
        request=ResolveRequestSerializer,
        responses={200: TicketDetailSerializer},
    )
    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        ticket = self.get_object()
        payload = ResolveRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        try:
            ticket = ticket_service.resolve(
                ticket, request.user, payload.validated_data.get("resolution_note", "")
            )
        except ticket_service.InvalidTransition as exc:
            raise ValidationError({"status": str(exc)}) from exc
        return Response(TicketDetailSerializer(ticket).data)


# ---------------------------------------------------------------------------
# Reference data. Not scoped — these are lookups every agent shares, and Django
# admin is where they are edited.
# ---------------------------------------------------------------------------


@extend_schema_view(list=extend_schema(summary="Ticket categories"))
class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAgentOrAbove]
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    pagination_class = None


@extend_schema_view(list=extend_schema(summary="Tags"))
class TagViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAgentOrAbove]
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    pagination_class = None


@extend_schema_view(list=extend_schema(summary="Canned replies for the composer"))
class CannedReplyViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAgentOrAbove]
    queryset = CannedReply.objects.select_related("category").all()
    serializer_class = CannedReplySerializer
    pagination_class = None
    filter_backends = [SearchFilter]
    search_fields = ("shortcut", "title_en", "title_ar")
