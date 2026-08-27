"""Tickets — the core of the product.

Odoo mental map: `Ticket` is the record, and `TicketMessage` + `TicketEvent`
together are what `mail.thread` chatter gives you for free in Odoo — public
replies, internal notes, and the tracked-field trail.
"""

import random
import time

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import IntegrityError, models, transaction

# --------------------------------------------------------------------------
# Shared vocabularies. `docs/design/DesignSystem.dc.html` treats status,
# priority and channel as three separate badge families — every value below
# has a badge, so the seed must exercise all of them.
# --------------------------------------------------------------------------


class Priority(models.TextChoices):
    LOW = "low", "Low"
    NORMAL = "normal", "Normal"
    HIGH = "high", "High"
    URGENT = "urgent", "Urgent"


class Status(models.TextChoices):
    NEW = "new", "New"
    OPEN = "open", "Open"
    PENDING = "pending", "Pending"
    ON_HOLD = "on_hold", "On hold"
    ESCALATED = "escalated", "Escalated"
    RESOLVED = "resolved", "Resolved"
    CLOSED = "closed", "Closed"
    REOPENED = "reopened", "Reopened"


class Channel(models.TextChoices):
    WEB = "web", "Portal"
    EMAIL = "email", "Email"
    WHATSAPP = "whatsapp", "WhatsApp"
    SMS = "sms", "SMS"
    CHAT = "chat", "Live chat"


# --------------------------------------------------------------------------
# Lookups and policies
# --------------------------------------------------------------------------


class Category(models.Model):
    """Ticket category. `default_priority` pre-fills the form; it is not enforced."""

    name_en = models.CharField(max_length=120)
    name_ar = models.CharField(max_length=120)
    slug = models.SlugField(max_length=64, unique=True)
    default_priority = models.CharField(
        max_length=8, choices=Priority.choices, default=Priority.NORMAL
    )

    class Meta:
        ordering = ["slug"]
        verbose_name_plural = "categories"

    def __str__(self) -> str:
        return self.name_en


class Tag(models.Model):
    """Free-form label. `color` is consumed verbatim by the story 07 tag chips."""

    name_en = models.CharField(max_length=60)
    name_ar = models.CharField(max_length=60)
    color = models.CharField(max_length=7, default="#64748b")

    class Meta:
        ordering = ["name_en"]

    def __str__(self) -> str:
        return self.name_en


class SLAPolicy(models.Model):
    """One policy per (customer tier, priority) pair — the design names them 'Enterprise-P1'.

    The unique constraint is what makes policy selection in story 05 unambiguous:
    a lookup on the pair returns exactly one row or none.
    """

    name = models.CharField(max_length=64, unique=True)
    customer_tier = models.CharField(max_length=12, choices=[
        ("standard", "Standard"),
        ("premium", "Premium"),
        ("enterprise", "Enterprise"),
    ])
    priority = models.CharField(max_length=8, choices=Priority.choices)
    first_response_minutes = models.PositiveIntegerField()
    resolution_minutes = models.PositiveIntegerField()
    escalate_at_percent = models.PositiveSmallIntegerField(
        default=90, help_text="The design's 'escalates to Tier 3 at 90%'."
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["customer_tier", "priority"]
        verbose_name_plural = "SLA policies"
        constraints = [
            models.UniqueConstraint(
                fields=["customer_tier", "priority"], name="uniq_sla_tier_priority"
            )
        ]

    def __str__(self) -> str:
        return self.name


class CannedReply(models.Model):
    """The composer's quick-reply chips. `shortcut` is what the agent types."""

    title_en = models.CharField(max_length=120)
    title_ar = models.CharField(max_length=120)
    body_en = models.TextField()
    body_ar = models.TextField()
    shortcut = models.SlugField(max_length=32, unique=True)
    category = models.ForeignKey(
        Category, null=True, blank=True, on_delete=models.SET_NULL, related_name="canned_replies"
    )

    class Meta:
        ordering = ["shortcut"]
        verbose_name_plural = "canned replies"

    def __str__(self) -> str:
        return self.title_en


# --------------------------------------------------------------------------
# Ticket numbering
#
# The intake suggested `select_for_update` or a database sequence. Neither is
# used, deliberately:
#
#   * A counter row to lock would need an eighteenth model, and the intake says
#     "exactly these models, no more".
#   * Locking the last Ticket row instead is gap-prone — under READ COMMITTED
#     two transactions can disagree about which row is "last" while an insert
#     is in flight.
#   * A Postgres sequence breaks the SQLite fallback story 01 built and verified.
#
# What actually guarantees "never reused" is `unique=True` on `number`: the
# database enforces it regardless of isolation level or engine. The retry loop
# below only handles the collision that constraint surfaces.
# --------------------------------------------------------------------------

NUMBER_PREFIX = "TK-"
NUMBER_WIDTH = 4
# Sized against contention, not against "a couple of retries should do it". Each
# collision round lets exactly one writer through, so N concurrent creates can
# cost a loser up to N-1 attempts. 25 covers the 50-create / 16-thread test with
# a wide margin once the backoff below is applied; a real deployment behind a
# handful of gunicorn workers never gets close.
MAX_NUMBER_ATTEMPTS = 25

# A dedicated instance rather than the `random` module, so seeding the global RNG
# anywhere else in the process (seed_demo does exactly that) cannot make every
# worker back off by the same amount.
_JITTER = random.Random()


def next_ticket_number(offset: int = 0) -> str:
    """The next free number, optionally `offset` slots further along.

    `offset` is 0 on a first attempt, so a quiet system numbers strictly
    TK-0001, TK-0002, TK-0003 with no gaps. It only widens on retry — see the
    backoff in `Ticket.save()` for why.
    """
    last = Ticket.objects.order_by("-id").values_list("number", flat=True).first()
    seq = int(last.removeprefix(NUMBER_PREFIX)) + 1 if last else 1
    return f"{NUMBER_PREFIX}{seq + offset:0{NUMBER_WIDTH}d}"


class Ticket(models.Model):
    number = models.CharField(max_length=16, unique=True, editable=False, db_index=True)
    subject = models.CharField(max_length=240)
    description = models.TextField(blank=True)

    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="tickets")
    contact = models.ForeignKey("customers.Contact", null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets")
    category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets")
    tags = models.ManyToManyField(Tag, blank=True, related_name="tickets")

    priority = models.CharField(max_length=8, choices=Priority.choices, default=Priority.NORMAL, db_index=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.NEW, db_index=True)
    channel = models.CharField(max_length=10, choices=Channel.choices, default=Channel.WEB, db_index=True)

    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_tickets")
    watchers = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="watched_tickets")
    department = models.ForeignKey("accounts.Department", null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets")
    branch = models.ForeignKey("accounts.Branch", null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets")

    # Human-readable provenance. The design renders this verbatim:
    # "Owner · auto-assigned by rule R-12". Story 05's round-robin writes it.
    assignment_reason = models.CharField(max_length=160, blank=True)
    escalation_level = models.PositiveSmallIntegerField(default=0)
    escalated_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets_created")
    first_response_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    # Written by story 05's sla_service. Stored, never computed here.
    sla_policy = models.ForeignKey(SLAPolicy, null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets")
    sla_response_due_at = models.DateTimeField(null=True, blank=True)
    sla_resolution_due_at = models.DateTimeField(null=True, blank=True)
    sla_response_breached = models.BooleanField(default=False)
    sla_resolution_breached = models.BooleanField(default=False)

    # Advisory only. Story 05's AI endpoints write these; nothing else reads them
    # to make a decision. The agent always approves.
    ai_summary = models.TextField(blank=True)
    ai_suggested_category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.SET_NULL, related_name="ai_suggested_for")

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "priority"]),
            models.Index(fields=["assignee", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.number} — {self.subject}"

    def save(self, *args, **kwargs):
        if self.number:
            return super().save(*args, **kwargs)

        last_error: IntegrityError | None = None
        for attempt in range(MAX_NUMBER_ATTEMPTS):
            # Attempt 0 always takes the next number exactly. Later attempts
            # pick at random from a widening window, which is what breaks the
            # lockstep described below: fifty losers competing for one slot all
            # fail, fifty losers spread over fifty slots almost all succeed.
            # The cost is an occasional gap in the sequence under heavy load —
            # the requirement is that a number is never *reused*, not that the
            # run is unbroken, and a PostgreSQL sequence would leave gaps too.
            offset = 0 if attempt == 0 else _JITTER.randrange(0, 2 * attempt)
            self.number = next_ticket_number(offset)
            try:
                with transaction.atomic():
                    return super().save(*args, **kwargs)
            except IntegrityError as exc:
                # Only a genuine number collision is retryable. Any other
                # constraint failure (a bad FK, say) must surface immediately
                # instead of being retried twenty-four more times and then
                # re-raised.
                if not Ticket.objects.filter(number=self.number).exists():
                    raise
                last_error = exc
                # Django marks the pk as set on a failed INSERT under some
                # backends; clear it so the retry is another INSERT, not an
                # UPDATE of a row that does not exist.
                self.pk = None
                # Jittered backoff, and it is load-bearing rather than defensive.
                # PostgreSQL blocks a second writer on the unique index until the
                # first commits, so every loser wakes at the same instant, re-reads
                # the same MAX(number) and computes the same next value — one
                # winner per round, and the attempt budget is spent on lockstep
                # rather than on real progress. Staggering the wake-ups lets the
                # losers pick up each other's committed rows instead.
                # Found by the 50-thread test on PostgreSQL; SQLite serialises
                # writes and never reproduced it.
                time.sleep(_JITTER.uniform(0, 0.004 * (attempt + 1)))
        raise last_error


class TicketMessage(models.Model):
    """A reply or an internal note.

    `is_internal` is a trust boundary, not a display flag: story 05's portal
    serializers filter on it, so it is indexed and never nullable.
    """

    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="messages")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="ticket_messages",
    )
    body = models.TextField()
    is_internal = models.BooleanField(default=False, db_index=True)
    channel = models.CharField(max_length=10, choices=Channel.choices, default=Channel.WEB)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        kind = "note" if self.is_internal else "reply"
        return f"{self.ticket.number} {kind}: {self.body[:40]}"


class TicketEvent(models.Model):
    """Powers the Activity log tab. Append-only, written by story 04's viewset actions."""

    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="events")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="ticket_events",
    )
    event_type = models.CharField(max_length=32, db_index=True)
    field = models.CharField(max_length=64, blank=True)
    old_value = models.CharField(max_length=160, blank=True)
    new_value = models.CharField(max_length=160, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.ticket_id} {self.event_type}"


class Attachment(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="attachments")
    message = models.ForeignKey(
        TicketMessage, null=True, blank=True, on_delete=models.CASCADE, related_name="attachments"
    )
    file = models.FileField(upload_to="attachments/%Y/%m/")
    filename = models.CharField(max_length=255)
    size = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="attachments_uploaded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.filename


class CSATRating(models.Model):
    """One rating per ticket. Story 09 charts the distribution."""

    ticket = models.OneToOneField(Ticket, on_delete=models.CASCADE, related_name="csat")
    score = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "CSAT rating"

    def __str__(self) -> str:
        return f"{self.ticket.number}: {self.score}/5"
