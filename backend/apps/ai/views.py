"""AI endpoints — advisory only.

Each endpoint writes **at most one** advisory column and nothing else. No
category is applied, no status moves, no assignee changes, no message is
created. `suggest_reply` persists nothing whatsoever: it returns text the agent
edits and sends through story 04's messages endpoint.

"An agent always approves" is a product rule from the brief.
`tests/test_ai_advisory.py` snapshots the entire ticket row before and after
every call and asserts only the permitted field moved — which is what turns the
rule from a claim into a property.
"""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAgentOrAbove
from apps.accounts.scoping import scope_tickets
from apps.ai.serializers import (
    AIRequestSerializer,
    CategorizeResponseSerializer,
    SuggestedSolutionsResponseSerializer,
    SuggestReplyRequestSerializer,
    SuggestReplyResponseSerializer,
    SummarizeResponseSerializer,
)
from apps.ai.services import get_backend
from apps.tickets.models import Category, Ticket


class AIView(APIView):
    """Shared base: agent-or-above, and the ticket resolved through the caller's scope."""

    permission_classes = [IsAgentOrAbove]
    request_serializer = AIRequestSerializer

    def get_ticket(self, request, source=None):
        # `source` lets a GET-based view (suggested-solutions, read-only) reuse
        # this exact scope-and-404 logic against `query_params` instead of
        # `data` — a second copy of it is how the two would start disagreeing
        # about what "out of scope" means.
        payload = self.request_serializer(data=source if source is not None else request.data)
        payload.is_valid(raise_exception=True)

        # Resolved through scope_tickets, not Ticket.objects: asking the AI about
        # a ticket you cannot see would otherwise be a read primitive around the
        # scoping story 03 built. Out of scope is 404, consistent with every
        # other detail route.
        ticket = (
            scope_tickets(Ticket.objects.all(), request.user)
            .select_related("customer", "category")
            .filter(pk=payload.validated_data["ticket"])
            .first()
        )
        if ticket is None:
            raise NotFound("No such ticket.")
        return ticket, payload.validated_data


@extend_schema(
    tags=["ai"],
    summary="Summarise a ticket (writes ai_summary)",
    request=AIRequestSerializer,
    responses={200: SummarizeResponseSerializer},
)
class SummarizeView(AIView):
    def post(self, request):
        ticket, _ = self.get_ticket(request)
        backend = get_backend()
        summary = backend.summarize(ticket)

        # update() rather than save(): it writes exactly this column and cannot
        # accidentally flush an unrelated in-memory change onto the row.
        Ticket.objects.filter(pk=ticket.pk).update(ai_summary=summary)

        return Response(
            {"ticket": ticket.pk, "backend": backend.name, "summary": summary}
        )


@extend_schema(
    tags=["ai"],
    summary="Draft a reply (persists nothing)",
    request=SuggestReplyRequestSerializer,
    responses={200: SuggestReplyResponseSerializer},
)
class SuggestReplyView(AIView):
    request_serializer = SuggestReplyRequestSerializer

    def post(self, request):
        ticket, data = self.get_ticket(request)
        backend = get_backend()
        draft = backend.suggest_reply(ticket, data.get("context", ""))
        language = (
            ticket.customer.preferred_language if ticket.customer_id else "en"
        )
        return Response(
            {
                "ticket": ticket.pk,
                "backend": backend.name,
                "suggested_reply": draft,
                "language": language,
            }
        )


@extend_schema(
    tags=["ai"],
    summary="Suggest a category (writes ai_suggested_category only)",
    request=AIRequestSerializer,
    responses={200: CategorizeResponseSerializer},
)
class CategorizeView(AIView):
    def post(self, request):
        ticket, _ = self.get_ticket(request)
        backend = get_backend()
        result = backend.categorize(ticket.subject, ticket.description or "")

        category = None
        if result.get("category_id"):
            category = Category.objects.filter(pk=result["category_id"]).first()

        # Writes the *suggestion* column. `ticket.category` is deliberately left
        # alone — applying it would be the AI making the decision, which is the
        # one thing this feature must not do.
        Ticket.objects.filter(pk=ticket.pk).update(
            ai_suggested_category=category
        )

        return Response({"ticket": ticket.pk, "backend": backend.name, **result})


@extend_schema(
    tags=["ai"],
    summary="Similar already-resolved tickets (writes nothing)",
    parameters=[OpenApiParameter("ticket", int, OpenApiParameter.QUERY)],
    responses={200: SuggestedSolutionsResponseSerializer},
)
class SuggestedSolutionsView(AIView):
    """A GET, unlike its three siblings — there is no advisory column to
    write, so this is read-only in fact as well as intent.
    """

    def get(self, request):
        ticket, _ = self.get_ticket(request, source=request.query_params)
        backend = get_backend()
        solutions = backend.suggest_solutions(ticket)
        return Response({"ticket": ticket.pk, "backend": backend.name, "solutions": solutions})
