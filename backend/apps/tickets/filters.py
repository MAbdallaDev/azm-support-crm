"""Queue filters — what the story 07 tabs and the filter bar send.

Odoo mental map: this is the search view's filter definitions, except the
client composes them as query-string parameters.
"""

import django_filters as filters
from django.db.models import Q
from django.utils import timezone

from apps.tickets.models import Channel, Priority, Status, Ticket
# One definition of "breached", owned by sla_service. A local copy here is how
# the queue tab and the row badge start disagreeing.
from apps.tickets.services.sla_service import breached_q


class TicketFilterSet(filters.FilterSet):
    status = filters.MultipleChoiceFilter(choices=Status.choices)
    priority = filters.MultipleChoiceFilter(choices=Priority.choices)
    channel = filters.MultipleChoiceFilter(choices=Channel.choices)

    q = filters.CharFilter(method="filter_q", label="Subject, number or customer name")
    escalated = filters.BooleanFilter(method="filter_escalated")
    breached = filters.BooleanFilter(method="filter_breached")
    unassigned = filters.BooleanFilter(field_name="assignee", lookup_expr="isnull")

    created_after = filters.DateTimeFilter(field_name="created_at", lookup_expr="gte")
    created_before = filters.DateTimeFilter(field_name="created_at", lookup_expr="lte")

    class Meta:
        model = Ticket
        fields = [
            "status", "priority", "channel", "assignee", "category",
            "customer", "department", "branch", "tags",
        ]

    def filter_q(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(subject__icontains=value)
            | Q(number__icontains=value)
            | Q(customer__name__icontains=value)
            | Q(customer__company__icontains=value)
        )

    def filter_escalated(self, queryset, name, value):
        if value is None:
            return queryset
        condition = Q(status=Status.ESCALATED) | Q(escalation_level__gt=0)
        return queryset.filter(condition) if value else queryset.exclude(condition)

    def filter_breached(self, queryset, name, value):
        if value is None:
            return queryset
        condition = breached_q()
        return queryset.filter(condition) if value else queryset.exclude(condition)
