"""Customer serializers. Split list / detail for the same reason tickets are."""

from django.db.models import Count, Q
from rest_framework import serializers

from apps.customers.models import Contact, Customer, CustomerNote

# Statuses that count as "still open" for the customer card's ticket counter.
OPEN_TICKET_STATUSES = ("new", "open", "pending", "on_hold", "escalated", "reopened")


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ("id", "customer", "name", "email", "phone", "position", "is_primary")


class CustomerNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = CustomerNote
        fields = ("id", "customer", "author", "author_name", "body", "created_at")
        read_only_fields = ("id", "customer", "author", "created_at")

    def get_author_name(self, obj) -> str:
        if obj.author is None:
            return ""
        return obj.author.get_full_name() or obj.author.get_username()


class CustomerListSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.name_en", read_only=True, default="")
    open_ticket_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Customer
        fields = (
            "id", "name", "company", "email", "phone", "tier",
            "branch", "branch_name", "preferred_language",
            "open_ticket_count", "created_at",
        )


class CustomerDetailSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.name_en", read_only=True, default="")
    contacts = ContactSerializer(many=True, read_only=True)
    open_ticket_count = serializers.SerializerMethodField()
    total_ticket_count = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = (
            "id", "name", "company", "email", "phone", "whatsapp", "tier",
            "branch", "branch_name", "preferred_language", "contacts",
            "open_ticket_count", "total_ticket_count",
            "created_by", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_by", "created_at", "updated_at")

    def get_open_ticket_count(self, obj) -> int:
        return obj.tickets.filter(status__in=OPEN_TICKET_STATUSES).count()

    def get_total_ticket_count(self, obj) -> int:
        return obj.tickets.count()


class CustomerWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = (
            "id", "name", "company", "email", "phone", "whatsapp",
            "tier", "branch", "preferred_language",
        )
        read_only_fields = ("id",)


def annotate_open_ticket_count(queryset):
    """Used by the list action so the counter costs one join, not one query per row."""
    return queryset.annotate(
        open_ticket_count=Count(
            "tickets", filter=Q(tickets__status__in=OPEN_TICKET_STATUSES)
        )
    )
