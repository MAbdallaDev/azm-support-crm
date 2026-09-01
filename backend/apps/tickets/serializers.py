"""Ticket serializers, split by weight.

The queue is ~150 rows; the detail page is one. A single fat serializer would
make every queue row pay for the detail page's nested customer, tags and SLA
block. `get_serializer_class()` picks per action.
"""

from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.tickets.services import ticket_service
from apps.tickets.services.sla_service import (
    RESOLUTION,
    RESPONSE,
    is_breached,
    sla_state,
)
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


class SLAStateSerializer(serializers.Serializer):
    """The shape of one SLA clock. Declared for the schema, never used to write.

    `seconds_remaining` is signed and nullable: negative when overdue, null when
    the ticket has no policy and therefore no deadline to be measured against.
    """

    state = serializers.ChoiceField(choices=["ok", "approaching", "breached"])
    seconds_remaining = serializers.IntegerField(allow_null=True)
    target_minutes = serializers.IntegerField(allow_null=True)
    policy_name = serializers.CharField(allow_blank=True)


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
    resolution_sla = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = (
            "id", "number", "subject", "priority", "status", "channel",
            "customer_name", "assignee_name", "category_name",
            "created_at", "sla_resolution_due_at", "is_breached",
            "resolution_sla",
        )

    def get_is_breached(self, obj) -> bool:
        return is_breached(obj, self.context.get("now"))

    @extend_schema_field(SLAStateSerializer)
    def get_resolution_sla(self, obj) -> dict:
        """The same clock the detail pane shows, on every queue row.

        Story 07's rows render a live countdown that turns red on breach.
        Without this field the queue would need a *second* SLA component
        deriving colour from `sla_resolution_due_at` and `is_breached` on its
        own — and the queue's colour and the detail pane's colour would drift
        the first time either rule changed.

        **Not an N+1.** `sla_state` reads only `ticket.sla_policy`, and the list
        queryset already `select_related("sla_policy")`. Story 04's
        `test_queue_performance.py` asserts the query count is identical for 5
        and 50 rows — that test, not this comment, is the proof.
        """
        return sla_state(obj, RESOLUTION, self.context.get("now"))


class LiveChatListSerializer(serializers.ModelSerializer):
    """One row of the agent Live Chat inbox — a messaging-app-style list, not a
    ticket queue row. Deliberately carries none of `TicketListSerializer`'s
    priority/SLA/category fields; the live-chat screen has no case-management
    chrome by design.

    `last_message` / `last_message_at` / `awaiting_reply` all read from
    `prefetched_messages`, an `attribute name set by the view's
    `Prefetch(..., to_attr="prefetched_messages")` — never `obj.messages`
    directly, which would be an extra query per row.
    """

    customer_name = serializers.CharField(source="customer.name", read_only=True)
    last_message = serializers.SerializerMethodField()
    last_message_at = serializers.SerializerMethodField()
    awaiting_reply = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = (
            "id", "number", "customer_name", "last_message", "last_message_at",
            "awaiting_reply", "created_at",
        )

    def _last_message(self, obj):
        messages = getattr(obj, "prefetched_messages", None) or []
        return messages[0] if messages else None

    def get_last_message(self, obj) -> str:
        message = self._last_message(obj)
        return message.body if message else ""

    def get_last_message_at(self, obj):
        message = self._last_message(obj)
        return message.created_at if message else obj.created_at

    def get_awaiting_reply(self, obj) -> bool:
        """The customer sent the most recent message — a stand-in for "unread"
        since there is no per-agent read-state model. A message from staff (or
        no messages yet) means nothing is waiting on this agent right now.
        """
        message = self._last_message(obj)
        return bool(message and message.author_id and getattr(message.author, "role", None) == "customer")


def build_message_snippet(body, query, context=40):
    """A short, plain-text excerpt of `body` centred on `query`, or `None`.

    Character-based rather than word-based on purpose: it works the same for
    Arabic and English, and needs no tokenizer. The caller highlights the
    match client-side by splitting on `query` — this returns plain text, not
    HTML, so there's nothing here that needs escaping.
    """
    index = body.lower().find(query.lower())
    if index == -1:
        return None
    start = max(0, index - context)
    end = min(len(body), index + len(query) + context)
    snippet = body[start:end].strip()
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(body) else ""
    return f"{prefix}{snippet}{suffix}"


class TicketSearchResultSerializer(TicketListSerializer):
    """`TicketListSerializer` plus one field, used only for a `q` search.

    `TicketListSerializer` documents that it must never reference `messages`
    — the queue renders up to a full page of rows and that field is exactly
    the N+1 story 04's `test_queue_performance.py` guards against. This
    subclass is the deliberate exception: `TicketViewSet.get_serializer_class`
    only selects it when the request actually carries `q`, so the extra
    per-row message lookup only ever runs against a search result set, never
    the plain queue.
    """

    matched_snippet = serializers.SerializerMethodField()

    class Meta(TicketListSerializer.Meta):
        fields = TicketListSerializer.Meta.fields + ("matched_snippet",)

    def get_matched_snippet(self, obj) -> str | None:
        request = self.context.get("request")
        query = request.query_params.get("q") if request else None
        if not query:
            return None

        ql = query.lower()
        # Already visible elsewhere on the row — no snippet needed to explain it.
        if (
            ql in obj.subject.lower()
            or ql in obj.number.lower()
            or (obj.customer and ql in obj.customer.name.lower())
            or (obj.customer and obj.customer.company and ql in obj.customer.company.lower())
        ):
            return None

        message = obj.messages.filter(body__icontains=query).order_by("created_at").first()
        if not message:
            return None
        return build_message_snippet(message.body, query)


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
    response_sla = serializers.SerializerMethodField()
    resolution_sla = serializers.SerializerMethodField()
    allowed_transitions = serializers.SerializerMethodField()
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
            "response_sla", "resolution_sla", "allowed_transitions",
            "created_at", "updated_at",
        )

    def get_watcher_count(self, obj) -> int:
        return obj.watchers.count()

    def get_is_breached(self, obj) -> bool:
        return is_breached(obj, self.context.get("now"))

    @extend_schema_field(SLAStateSerializer)
    def get_response_sla(self, obj) -> dict:
        """Feeds the first progress bar in the design's right-pane SLA block."""
        return sla_state(obj, RESPONSE, self.context.get("now"))

    @extend_schema_field(SLAStateSerializer)
    def get_resolution_sla(self, obj) -> dict:
        return sla_state(obj, RESOLUTION, self.context.get("now"))

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_allowed_transitions(self, obj) -> list[str]:
        """The status values a caller may move this ticket to, right now.

        Served **with the ticket** rather than from a static endpoint, because
        the answer depends on `obj.status`: it cannot go stale relative to the
        row it describes, and story 07's status dropdown needs no second
        request to populate itself.

        The point is that `ALLOWED_TRANSITIONS` stays single-sourced in
        `ticket_service`. The alternative is the frontend transcribing the map
        — a second copy that drifts silently, offering a move the API then
        refuses with a 400 the user cannot act on.
        """
        return sorted(ticket_service.ALLOWED_TRANSITIONS.get(obj.status, set()))


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
