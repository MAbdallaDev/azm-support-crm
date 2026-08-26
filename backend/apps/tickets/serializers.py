"""Ticket serializers, split by weight.

The queue is ~150 rows; the detail page is one. A single fat serializer would
make every queue row pay for the detail page's nested customer, tags and SLA
block. `get_serializer_class()` picks per action.
"""

from django.utils import timezone
from rest_framework import serializers

from apps.tickets.models import (
    Attachment,
    CannedReply,
    Category,
    CSATRating,
    Status,
    Tag,
    Ticket,
    TicketEvent,
    TicketMessage,
)


def is_breached(ticket, now=None) -> bool:
    """SLA breach derived from the stored due timestamps.

    Not from the `sla_response_breached` / `sla_resolution_breached` columns:
    nothing writes those yet — story 05 owns SLA — so reading them would report
    False for every row and story 07's Breaching tab would look empty with no
    error. This matches story 05's computed-on-read design, and the identical
    expression lives in `filters.py` so the filter and the field agree.
    """
    now = now or timezone.now()
    if (
        ticket.sla_response_due_at
        and ticket.sla_response_due_at < now
        and not ticket.first_response_at
    ):
        return True
    return bool(
        ticket.sla_resolution_due_at
        and ticket.sla_resolution_due_at < now
        and not ticket.resolved_at
    )


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "slug", "name_en", "name_ar", "default_priority")


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ("id", "name_en", "name_ar", "color")


class CannedReplySerializer(serializers.ModelSerializer):
    """Bilingual pairs exposed as-is; story 06 picks the language client-side."""

    category = serializers.SlugRelatedField(slug_field="slug", read_only=True)

    class Meta:
        model = CannedReply
        fields = (
            "id", "shortcut", "title_en", "title_ar", "body_en", "body_ar", "category",
        )


class TicketListSerializer(serializers.ModelSerializer):
    """Exactly what a queue row in `Main.dc.html` renders, and nothing more.

    Related values come through `source=` rather than SerializerMethodField: a
    method field touching `obj.customer` still fires a query per row unless
    `select_related` covers it, whereas a source path makes the required
    `select_related` obvious to the next reader. This serializer must never
    reference `tags`, `watchers`, `messages` or `events`.
    """

    customer_name = serializers.CharField(source="customer.name", read_only=True)
    assignee_name = serializers.CharField(
        source="assignee.get_full_name", read_only=True, default=""
    )
    category_name = serializers.CharField(
        source="category.name_en", read_only=True, default=""
    )
    is_breached = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = (
            "id", "number", "subject", "priority", "status", "channel",
            "customer_name", "assignee_name", "category_name",
            "created_at", "sla_resolution_due_at", "is_breached",
        )

    def get_is_breached(self, obj) -> bool:
        return is_breached(obj, self.context.get("now"))


class TicketPersonSerializer(serializers.Serializer):
    """A person as the detail page shows them. Read-only projection."""

    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    full_name = serializers.SerializerMethodField()
    role = serializers.CharField(read_only=True)

    def get_full_name(self, obj) -> str:
        return obj.get_full_name() or obj.get_username()


class TicketDetailSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_company = serializers.CharField(source="customer.company", read_only=True)
    customer_tier = serializers.CharField(source="customer.tier", read_only=True)
    contact_name = serializers.CharField(source="contact.name", read_only=True, default="")
    assignee = TicketPersonSerializer(read_only=True)
    created_by = TicketPersonSerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    ai_suggested_category = CategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    department = serializers.SlugRelatedField(slug_field="code", read_only=True)
    branch = serializers.SlugRelatedField(slug_field="code", read_only=True)
    sla_policy_name = serializers.CharField(source="sla_policy.name", read_only=True, default="")
    watcher_count = serializers.SerializerMethodField()
    is_breached = serializers.SerializerMethodField()
    csat_score = serializers.IntegerField(source="csat.score", read_only=True, default=None)

    class Meta:
        model = Ticket
        fields = (
            "id", "number", "subject", "description",
            "customer", "customer_name", "customer_company", "customer_tier",
            "contact", "contact_name",
            "category", "tags", "priority", "status", "channel",
            "assignee", "created_by", "department", "branch",
            "assignment_reason", "escalation_level", "escalated_at",
            "first_response_at", "resolved_at", "closed_at",
            "sla_policy", "sla_policy_name",
            "sla_response_due_at", "sla_resolution_due_at",
            "sla_response_breached", "sla_resolution_breached",
            "ai_summary", "ai_suggested_category",
            "watcher_count", "csat_score", "is_breached",
            "created_at", "updated_at",
        )

    def get_watcher_count(self, obj) -> int:
        return obj.watchers.count()

    def get_is_breached(self, obj) -> bool:
        return is_breached(obj, self.context.get("now"))


class TicketWriteSerializer(serializers.ModelSerializer):
    """Create and update.

    `status` is deliberately absent: it is settable only through the transition
    endpoints, which validate the move, stamp the timestamps and write the
    Activity log entry. Allowing it here would let a PATCH bypass all three.
    """

    class Meta:
        model = Ticket
        fields = (
            "id", "number", "subject", "description", "customer", "contact",
            "category", "tags", "priority", "channel", "assignee", "watchers",
            "department", "branch", "ai_summary",
        )
        read_only_fields = ("id", "number")


class TicketMessageSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_role = serializers.CharField(source="author.role", read_only=True, default="")

    class Meta:
        model = TicketMessage
        fields = (
            "id", "ticket", "author", "author_name", "author_role",
            "body", "is_internal", "channel", "created_at",
        )
        read_only_fields = ("id", "ticket", "author", "created_at")

    def get_author_name(self, obj) -> str:
        if obj.author is None:
            return ""
        return obj.author.get_full_name() or obj.author.get_username()


class TicketEventSerializer(serializers.ModelSerializer):
    """Read-only. The Activity log is append-only."""

    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = TicketEvent
        fields = (
            "id", "ticket", "actor", "actor_name", "event_type",
            "field", "old_value", "new_value", "created_at",
        )
        read_only_fields = fields

    def get_actor_name(self, obj) -> str:
        if obj.actor is None:
            return ""
        return obj.actor.get_full_name() or obj.actor.get_username()


class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = (
            "id", "ticket", "message", "file", "filename", "size",
            "uploaded_by", "uploaded_by_name", "created_at",
        )
        # size, filename and uploaded_by are derived server-side from the upload;
        # a client-supplied value is never trusted.
        read_only_fields = (
            "id", "ticket", "filename", "size", "uploaded_by", "created_at",
        )

    def get_uploaded_by_name(self, obj) -> str:
        if obj.uploaded_by is None:
            return ""
        return obj.uploaded_by.get_full_name() or obj.uploaded_by.get_username()


class CSATRatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = CSATRating
        fields = ("id", "ticket", "score", "comment", "created_at")
        read_only_fields = ("id", "ticket", "created_at")


# ---------------------------------------------------------------------------
# Action request bodies. Small and explicit, so drf-spectacular types them
# instead of emitting `{}` — story 06 reads this schema to generate its client.
# ---------------------------------------------------------------------------


class AssignRequestSerializer(serializers.Serializer):
    assignee = serializers.IntegerField(
        required=False, allow_null=True,
        help_text="User id. Omit or send null to auto-assign the least-loaded available agent.",
    )
    reason = serializers.CharField(required=False, allow_blank=True, max_length=160)


class StatusRequestSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Status.choices)
    note = serializers.CharField(required=False, allow_blank=True)


class EscalateRequestSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=160)


class ResolveRequestSerializer(serializers.Serializer):
    resolution_note = serializers.CharField(required=False, allow_blank=True)
