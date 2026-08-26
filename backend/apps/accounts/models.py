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
        default=True, help_text="Round-robin assignment in story 05 skips unavailable agents."
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
