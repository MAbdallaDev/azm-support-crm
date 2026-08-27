"""Customers — the company, its people, and internal notes about it.

Odoo mental map: `res.partner` split into `Customer` (the company/account) and
`Contact` (the people), with `CustomerNote` standing in for chatter notes.
"""

from django.conf import settings
from django.db import models


class Customer(models.Model):
    """An account. Tickets belong to one; the customer card in the workspace renders it."""

    class Tier(models.TextChoices):
        STANDARD = "standard", "Standard"
        PREMIUM = "premium", "Premium"
        ENTERPRISE = "enterprise", "Enterprise"

    class Language(models.TextChoices):
        EN = "en", "English"
        AR = "ar", "العربية"

    name = models.CharField(max_length=160)
    company = models.CharField(max_length=160, blank=True)
    email = models.EmailField()
    phone = models.CharField(max_length=32, blank=True)
    whatsapp = models.CharField(max_length=32, blank=True)
    tier = models.CharField(
        max_length=12, choices=Tier.choices, default=Tier.STANDARD, db_index=True
    )
    branch = models.ForeignKey(
        "accounts.Branch", null=True, blank=True, on_delete=models.SET_NULL, related_name="customers"
    )
    preferred_language = models.CharField(
        max_length=2, choices=Language.choices, default=Language.EN
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="customers_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.company or self.name


class Contact(models.Model):
    """A person at a customer. One is flagged primary; the ticket form defaults to it."""

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="contacts")
    name = models.CharField(max_length=160)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    position = models.CharField(max_length=120, blank=True)
    is_primary = models.BooleanField(default=False)

    class Meta:
        ordering = ["-is_primary", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.customer})"


class CustomerNote(models.Model):
    """Internal-only. Never exposed through the portal serializers in story 05."""

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="notes")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="customer_notes",
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Note on {self.customer} — {self.body[:40]}"
