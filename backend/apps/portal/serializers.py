"""Portal serializers — a separate trust boundary, not the agent app with fields hidden.

**Nothing here imports from `apps.tickets.serializers` or `apps.kb.serializers`,
and that is the entire point.** Reusing an agent serializer with a shorter
`fields` tuple works right up until someone adds a field to the agent version:
the new field appears in the portal too, silently, because nothing in the code
says it must not. Separate classes make every portal-visible field a deliberate
decision, and `tests/test_portal_boundary.py` recurses the actual responses to
prove the forbidden set never appears.

What a customer must never see: who is working their ticket, which department or
branch owns it, the SLA policy or countdown, escalation state, watchers, the AI
advisory fields, and — above all — internal notes.
"""

from rest_framework import serializers

from apps.kb.models import KBArticle
from apps.tickets.models import CSATRating, Priority, Ticket, TicketMessage

# A customer may open a ticket at these priorities only. "urgent" is a
# commitment the support team makes, not one the requester declares.
PORTAL_PRIORITIES = (Priority.LOW, Priority.NORMAL)


class PortalTicketSerializer(serializers.ModelSerializer):
    """A ticket as its own customer sees it.

    `sla_resolution_due_at` is exposed as `target_date` — a date the customer was
    promised, not a live countdown. A ticking breach timer in a customer's face
    invites an argument about a number they cannot influence.
    """

    category = serializers.CharField(source="category.name_en", read_only=True, default="")
    channel = serializers.CharField(source="get_channel_display", read_only=True)
    status = serializers.CharField(source="get_status_display", read_only=True)
    target_date = serializers.DateTimeField(source="sla_resolution_due_at", read_only=True)
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = (
            "id", "number", "subject", "status", "category", "channel",
            "created_at", "target_date", "resolved_at", "message_count",
        )
        read_only_fields = fields

    def get_message_count(self, obj) -> int:
        """Public messages only — an internal note must not even be countable."""
        return obj.messages.filter(is_internal=False).count()


class PortalTicketCreateSerializer(serializers.ModelSerializer):
    """Submitting a ticket from the portal.

    `assignee`, `status`, `department` and `branch` are simply not fields here,
    so a payload containing them is ignored rather than rejected. The intake
    calls for dropping them silently, and it is the right call: a 400 naming a
    field the client never saw confirms the field exists.
    """

    class Meta:
        model = Ticket
        fields = ("id", "number", "subject", "description", "category", "priority", "channel")
        read_only_fields = ("id", "number")

    def validate_priority(self, value):
        """Clamped, not rejected — same reasoning as the dropped fields."""
        return value if value in PORTAL_PRIORITIES else Priority.NORMAL


class PortalMessageSerializer(serializers.ModelSerializer):
    """A message in the portal thread.

    `author_kind` is `"you"` or `"support"` — never the agent's name. Individual
    agents should not become the customer's point of contact, and a name is
    personal data the customer has no need for.
    """

    author_kind = serializers.SerializerMethodField()

    class Meta:
        model = TicketMessage
        fields = ("id", "body", "author_kind", "created_at")
        read_only_fields = ("id", "author_kind", "created_at")

    def get_author_kind(self, obj) -> str:
        user = self.context.get("request").user if self.context.get("request") else None
        if user is not None and obj.author_id == user.pk:
            return "you"
        if obj.author_id and getattr(obj.author, "role", None) == "customer":
            return "you"
        return "support"


class PortalCSATSerializer(serializers.ModelSerializer):
    ticket = serializers.PrimaryKeyRelatedField(queryset=Ticket.objects.all())

    class Meta:
        model = CSATRating
        fields = ("id", "ticket", "score", "comment", "created_at")
        read_only_fields = ("id", "created_at")


class PortalKBArticleSerializer(serializers.ModelSerializer):
    """Published articles only — enforced by `scope_kb_articles`, not here.

    `author` is absent deliberately: who wrote a help article is internal.
    """

    category = serializers.CharField(source="category.name_en", read_only=True, default="")

    class Meta:
        model = KBArticle
        fields = (
            "id", "slug", "title_en", "title_ar", "body_en", "body_ar",
            "category", "updated_at",
        )
        read_only_fields = fields
