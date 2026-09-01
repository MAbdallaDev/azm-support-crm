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

from django.contrib.auth import get_user_model
from django.db import transaction
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.customers.models import Customer
from apps.kb.models import KBArticle
from apps.tickets.models import Attachment, CSATRating, Priority, Ticket, TicketMessage

User = get_user_model()

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
    # Raw enum keys, not `get_..._display()` text — the display text is
    # English-only regardless of the customer's language (Django's choice
    # labels are not translated here), which showed up as an orphaned English
    # word ("Open", "Email") under an Arabic-language portal session. The
    # frontend already has `status.*`/`channel.*` translations for exactly
    # these keys, the same ones the agent-facing TicketListSerializer exposes.
    channel = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    target_date = serializers.DateTimeField(source="sla_resolution_due_at", read_only=True)
    message_count = serializers.SerializerMethodField()
    csat = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = (
            "id", "number", "subject", "status", "category", "channel",
            "created_at", "target_date", "resolved_at", "message_count", "csat",
        )
        read_only_fields = fields

    def get_message_count(self, obj) -> int:
        """Public messages only — an internal note must not even be countable."""
        return obj.messages.filter(is_internal=False).count()

    @extend_schema_field({
        "type": "object",
        "nullable": True,
        "properties": {"score": {"type": "integer"}, "comment": {"type": "string"}},
    })
    def get_csat(self, obj):
        """Whether — and how — this ticket has already been rated.

        Without this the POST response is the only place a rating's score ever
        appears: reload the page and there is nothing left to read it from, so
        the read-only display cannot survive a refresh. `select_related("csat")`
        on the viewset's queryset is what keeps this from being a query per row.
        """
        rating = getattr(obj, "csat", None)
        return {"score": rating.score, "comment": rating.comment} if rating else None


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


class PortalAttachmentSerializer(serializers.ModelSerializer):
    """A file on the ticket — from creation (`message=None`) or a reply.

    `uploaded_by_kind` mirrors `PortalMessageSerializer.author_kind` exactly,
    for the same reason: which agent handled a file is not the customer's
    business, only whether it came from them or from support.
    """

    uploaded_by_kind = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = ("id", "message", "file", "filename", "size", "uploaded_by_kind", "created_at")
        read_only_fields = fields

    def get_uploaded_by_kind(self, obj) -> str:
        user = self.context.get("request").user if self.context.get("request") else None
        if user is not None and obj.uploaded_by_id == user.pk:
            return "you"
        if obj.uploaded_by_id and getattr(obj.uploaded_by, "role", None) == "customer":
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


class RegisterSerializer(serializers.Serializer):
    """Portal self-registration — the one unauthenticated write this story adds.

    Links to an existing `Customer` by email where one matches, otherwise
    creates one. Uniqueness is checked against `accounts.User`, not
    `customers.Customer`: a second registration attempt against an email that
    already holds a login must fail, and it fails with the same generic message
    regardless of whether the email is unknown or already registered — telling
    the two apart is exactly the account-enumeration oracle this guards against.
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    full_name = serializers.CharField(max_length=160)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)

    def validate(self, attrs):
        if User.objects.filter(email__iexact=attrs["email"]).exists():
            # Deliberately the same generic wording a validation failure would
            # use elsewhere — never "this email is already registered".
            raise serializers.ValidationError(
                {"detail": "Registration could not be completed with these details."}
            )
        return attrs

    @transaction.atomic
    def save(self):
        email = self.validated_data["email"]
        full_name = self.validated_data["full_name"].strip()
        phone = self.validated_data.get("phone", "")
        first_name, _, last_name = full_name.partition(" ")

        customer = Customer.objects.filter(email__iexact=email).first()
        if customer is None:
            customer = Customer.objects.create(name=full_name, email=email, phone=phone)

        user = User.objects.create_user(
            username=email,
            email=email,
            password=self.validated_data["password"],
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            role=User.Role.CUSTOMER,
            is_staff=False,
            is_superuser=False,
            customer=customer,
        )
        return user


class RegisterResponseSerializer(serializers.Serializer):
    """Matches `LoginResponse`'s shape — registering and being logged in are one action."""

    access = serializers.CharField()
    refresh = serializers.CharField()
    user = serializers.DictField()

    @staticmethod
    def build(user):
        # Reuses LoginSerializer.get_token rather than re-deriving the token's
        # claims — a second place that stamps "role" and "name" onto a token is
        # a second place for those two to drift apart from a real login's.
        from apps.accounts.serializers import LoginSerializer, MeSerializer

        refresh = LoginSerializer.get_token(user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": MeSerializer(user).data,
        }
