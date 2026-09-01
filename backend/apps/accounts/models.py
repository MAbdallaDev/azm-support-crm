"""Accounts — users, org structure, and the audit trail.

Odoo mental map: `res.users` → `User`, Odoo groups → the `role` field,
`res.branch`-style org units → `Department` / `Branch`.
"""

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class Department(models.Model):
    """A support department. Tickets route to one; agents belong to one."""

    name_en = models.CharField(max_length=120)
    name_ar = models.CharField(max_length=120)
    code = models.SlugField(max_length=32, unique=True)

    class Meta:
        ordering = ["code"]

    def __str__(self) -> str:
        return self.name_en


class Branch(models.Model):
    """A physical branch. Shown on the customer card in the agent workspace."""

    name_en = models.CharField(max_length=120)
    name_ar = models.CharField(max_length=120)
    code = models.SlugField(max_length=32, unique=True)

    class Meta:
        ordering = ["code"]
        verbose_name_plural = "branches"

    def __str__(self) -> str:
        return self.name_en


class User(AbstractUser):
    """Roles here are the equivalent of Odoo groups.

    Story 03 turns `role` into DRF permission classes plus get_queryset() scoping —
    the two layers Odoo splits between ir.model.access and record rules.
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "Administrator"
        MANAGER = "manager", "Manager"
        AGENT = "agent", "Agent"
        CUSTOMER = "customer", "Customer"

    class Language(models.TextChoices):
        EN = "en", "English"
        AR = "ar", "العربية"

    role = models.CharField(
        max_length=16, choices=Role.choices, default=Role.AGENT, db_index=True
    )
    phone = models.CharField(max_length=32, blank=True)
    department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.SET_NULL, related_name="members"
    )
    branch = models.ForeignKey(
        Branch, null=True, blank=True, on_delete=models.SET_NULL, related_name="staff"
    )
    tier = models.PositiveSmallIntegerField(
        default=1, help_text="Support tier. The design shows 'Tier 2' on the user chip."
    )
    language = models.CharField(max_length=2, choices=Language.choices, default=Language.EN)
    is_available = models.BooleanField(
        default=True, help_text="Round-robin assignment skips unavailable agents."
    )
    last_assigned_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text=(
            "When this agent was last given a ticket. The rotation tiebreak in "
            "tickets.services.ticket_service.pick_next_agent orders on it, so two "
            "agents at equal load alternate instead of the lower id always winning."
        ),
    )
    # String reference: customers.Customer also points back at User, so the two apps
    # are mutually dependent. Django resolves the migration order itself.
    customer = models.ForeignKey(
        "customers.Customer",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="portal_users",
        help_text="Set only for role=customer — links a portal login to its Customer record.",
    )

    def __str__(self) -> str:
        return self.get_full_name() or self.username


class Notification(models.Model):
    """A per-recipient inbox item — distinct from AuditLog, which is a security
    trail read by admins. This is read by its own recipient and carries a
    read/unread state AuditLog has no reason to have.

    Three verbs: a ticket assigned to you, an escalation on a ticket you own
    or watch, and an SLA breach on a ticket assigned to you. The first two are
    written inline from the request that causes them (`ticket_service`'s
    `assign`/`escalate`). The breach verb cannot be — `sla_service` computes
    breach state lazily on every read, with no request that "causes" a breach
    to hang a notification off. It is written instead by the
    `check_sla_breaches` management command, a real scheduled sweep (the
    project's own Odoo `ir.cron` mapping) run periodically — not a lossy check
    bolted onto an unrelated write. `notify_sla_breach` is idempotent per
    ticket (one lifetime breach notification, not one per sweep), which is
    the deliberate simplification: a reopened ticket that breaches again does
    not notify a second time in this MVP.
    """

    class Verb(models.TextChoices):
        TICKET_ASSIGNED = "ticket_assigned", "Ticket assigned"
        TICKET_ESCALATED = "ticket_escalated", "Ticket escalated"
        TICKET_SLA_BREACHED = "ticket_sla_breached", "SLA breached"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    verb = models.CharField(max_length=32, choices=Verb.choices, db_index=True)
    ticket = models.ForeignKey(
        "tickets.Ticket", null=True, blank=True, on_delete=models.CASCADE, related_name="notifications"
    )
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.verb} -> {self.recipient_id}"


class AuditLog(models.Model):
    """Append-only. Story 03 writes these from post_save/post_delete signals."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_entries",
    )
    action = models.CharField(max_length=24, db_index=True)
    model_name = models.CharField(max_length=64, db_index=True)
    object_id = models.CharField(max_length=64, db_index=True)
    changes = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.action} {self.model_name}#{self.object_id}"
