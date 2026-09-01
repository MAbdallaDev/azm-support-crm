"""Customer-portal API. `IsCustomer` throughout, own serializers throughout.

Scoping is the same machinery as the agent app — `scope_tickets` and
`scope_ticket_messages` from story 03 — because a second implementation of
"which rows may this customer see" is a second place for it to be wrong. What
differs is the *serialization*: the portal has its own classes and never imports
an agent one.
"""

from django.db import IntegrityError
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status as http_status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.generics import CreateAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCustomer
from apps.accounts.scoping import (
    ScopedQuerySetMixin,
    scope_kb_articles,
    scope_ticket_messages,
    scope_tickets,
)
from apps.kb.models import KBArticle
from apps.portal.serializers import (
    PortalAttachmentSerializer,
    PortalCSATSerializer,
    PortalKBArticleSerializer,
    PortalMessageSerializer,
    PortalTicketCreateSerializer,
    PortalTicketSerializer,
    RegisterResponseSerializer,
    RegisterSerializer,
)
from apps.tickets.models import Attachment, Status, Ticket, TicketMessage
from apps.tickets.pagination import StandardPagination
from apps.tickets.services import ticket_service
from apps.tickets.views import (
    ALLOWED_CONTENT_TYPES,
    MAX_ATTACHMENT_BYTES,
    sanitise_filename,
)

RATEABLE_STATUSES = (Status.RESOLVED, Status.CLOSED)


def _create_attachments(request, ticket, message=None):
    """The same checks `TicketViewSet.attachments` applies, imported rather than
    copied — two independently-maintained copies of a security check is how one
    of them goes stale.
    """
    created = []
    for upload in request.FILES.getlist("attachments"):
        if upload.size > MAX_ATTACHMENT_BYTES:
            raise ValidationError(
                {
                    "attachments": (
                        f"File is {upload.size} bytes; the limit is "
                        f"{MAX_ATTACHMENT_BYTES} bytes (10 MB)."
                    )
                }
            )
        content_type = (upload.content_type or "").split(";")[0].strip().lower()
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise ValidationError(
                {"attachments": f"Files of type '{content_type}' are not accepted."}
            )
        created.append(
            Attachment.objects.create(
                ticket=ticket,
                message=message,
                file=upload,
                filename=sanitise_filename(upload.name),
                size=upload.size,
                uploaded_by=request.user,
            )
        )
    return created


@extend_schema(tags=["portal"])
class PortalTicketViewSet(ScopedQuerySetMixin, viewsets.ModelViewSet):
    """The customer's own tickets. List, create, retrieve — no update, no delete.

    A customer changes a ticket by replying to it, not by editing fields.
    """

    permission_classes = [IsCustomer]
    scope_function = staticmethod(scope_tickets)
    queryset = Ticket.objects.all()
    pagination_class = StandardPagination
    http_method_names = ["get", "post", "head", "options"]
    # DRF's default parser set already includes MultiPartParser and FormParser
    # alongside JSONParser — attachments arrive multipart, everything else
    # keeps working exactly as story 05 left it (existing tests POST JSON).

    def get_queryset(self):
        return super().get_queryset().select_related("category", "csat")

    def get_serializer_class(self):
        if self.action == "create":
            return PortalTicketCreateSerializer
        return PortalTicketSerializer

    def perform_create(self, serializer):
        """`customer` comes from the session, never the payload.

        Accepting a customer id from the request body would let any portal user
        file tickets against any account.

        **`department` must be set to something.** `scope_tickets` shows an
        agent only work in their own department, assigned to them, or watched
        by them (story 08 hit the identical bug on the agent-side new-ticket
        form); a portal ticket left with `department=None` matches none of
        those for *any* agent or manager — only an admin (unfiltered) could
        ever see it. Found live during story 10's demo-script rehearsal: a
        freshly submitted portal ticket searched for in every agent and
        manager queue and found in neither. The submit form has no department
        field for a customer to pick from (routing is an internal concern),
        so this defaults to the "general" department — a real routing rule
        (e.g. by category) is a Phase 2 refinement, not a gap this MVP ships
        silently.
        """
        from apps.accounts.models import Department

        user = self.request.user
        if user.customer_id is None:
            raise ValidationError(
                {"detail": "This login is not linked to a customer account."}
            )
        default_department = (
            Department.objects.filter(code="general").first()
            or Department.objects.order_by("code").first()
        )
        ticket = serializer.save(
            customer=user.customer,
            created_by=user,
            branch=user.customer.branch,
            department=default_department,
            status=Status.NEW,
        )
        # Same two hook points as the agent app — the SLA clock starts for a
        # portal-raised ticket exactly as it does for an agent-raised one.
        from apps.tickets.services import sla_service

        sla_service.compute_due_dates(ticket)
        ticket_service.log_event(
            ticket, user, ticket_service.EVENT_CREATED, new=ticket.status
        )
        # Attachments are validated and stored against the ticket itself
        # (message=None) — a submission's own files, not a reply's.
        _create_attachments(self.request, ticket)

    @extend_schema(
        summary="The public conversation on a ticket",
        request=PortalMessageSerializer,
        responses={
            200: PortalMessageSerializer(many=True),
            201: PortalMessageSerializer,
        },
    )
    @action(detail=True, methods=["get", "post"], url_path="messages")
    def messages(self, request, pk=None):
        ticket = self.get_object()

        if request.method == "GET":
            # scope_ticket_messages applies .filter(is_internal=False) for
            # customers. That single filter is the internal-note boundary; there
            # is no second check further down, which is why it is tested
            # directly in test_portal_boundary.py.
            qs = scope_ticket_messages(
                TicketMessage.objects.filter(ticket=ticket), request.user
            ).select_related("author")
            return Response(
                PortalMessageSerializer(qs, many=True, context={"request": request}).data
            )

        serializer = PortalMessageSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        message = serializer.save(
            ticket=ticket,
            author=request.user,
            # A customer cannot create an internal note. Not "should not" — the
            # field is not settable from this serializer at all.
            is_internal=False,
            channel=ticket.channel,
        )
        _create_attachments(request, ticket, message=message)
        ticket_service.log_event(
            ticket, request.user, ticket_service.EVENT_MESSAGE_ADDED, new=message.body[:160]
        )
        return Response(
            PortalMessageSerializer(message, context={"request": request}).data,
            status=http_status.HTTP_201_CREATED,
        )

    @extend_schema(
        summary="Every file on this ticket — from creation and from replies",
        responses={200: PortalAttachmentSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="attachments")
    def attachments(self, request, pk=None):
        ticket = self.get_object()
        qs = ticket.attachments.select_related("uploaded_by").all()
        return Response(
            PortalAttachmentSerializer(qs, many=True, context={"request": request}).data
        )


@extend_schema(
    tags=["portal"],
    summary="Rate a resolved ticket",
    request=PortalCSATSerializer,
    responses={
        201: PortalCSATSerializer,
        409: OpenApiResponse(description="This ticket has already been rated."),
    },
)
class PortalCSATView(CreateAPIView):
    """One rating per ticket, by that ticket's customer, once it is finished."""

    permission_classes = [IsCustomer]
    serializer_class = PortalCSATSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.validated_data["ticket"]

        # Resolved through the caller's scope, so rating someone else's ticket is
        # a 404 rather than a 403 — consistent with every other detail route.
        visible = scope_tickets(Ticket.objects.all(), request.user).filter(pk=ticket.pk)
        if not visible.exists():
            return Response(
                {"detail": "No such ticket."}, status=http_status.HTTP_404_NOT_FOUND
            )

        if ticket.status not in RATEABLE_STATUSES:
            raise ValidationError(
                {"ticket": "A ticket can only be rated once it is resolved or closed."}
            )

        try:
            serializer.save()
        except IntegrityError:
            # CSATRating.ticket is a OneToOneField, so a second submission raises
            # at the database. Caught and translated rather than surfacing as a
            # 500 — a duplicate rating is a client error, not a server fault.
            return Response(
                {"detail": "This ticket has already been rated."},
                status=http_status.HTTP_409_CONFLICT,
            )
        return Response(serializer.data, status=http_status.HTTP_201_CREATED)


@extend_schema(tags=["portal"])
class PortalKBArticleViewSet(ScopedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """Published help articles. Drafts are excluded by `scope_kb_articles`."""

    permission_classes = [IsCustomer]
    scope_function = staticmethod(scope_kb_articles)
    queryset = KBArticle.objects.select_related("category").all()
    serializer_class = PortalKBArticleSerializer
    pagination_class = StandardPagination
    lookup_field = "slug"

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("q")
        if search:
            from django.db.models import Q

            qs = qs.filter(
                Q(title_en__icontains=search)
                | Q(title_ar__icontains=search)
                | Q(body_en__icontains=search)
                | Q(body_ar__icontains=search)
            )
        # Same slug filter KBArticleViewSet (the agent side) already applies —
        # the portal home's category shortcuts send this, not a free-text q.
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category__slug=category)
        return qs


@extend_schema(
    tags=["portal"],
    summary="Register a portal account",
    description=(
        "The one unauthenticated route this app adds. Links to an existing "
        "Customer record by email where one matches, otherwise creates one. "
        "Returns the same shape as login — registering and being signed in are "
        "one action, not two requests. Registration attempts are not "
        "rate-limited in this MVP; that belongs to a later phase, alongside "
        "throttling every other public endpoint."
    ),
    request=RegisterSerializer,
    responses={201: RegisterResponseSerializer},
)
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            RegisterResponseSerializer.build(user), status=http_status.HTTP_201_CREATED
        )
