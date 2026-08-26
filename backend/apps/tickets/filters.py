"""Queue filters — what the story 07 tabs and the filter bar send.

Odoo mental map: this is the search view's filter definitions, except the
client composes them as query-string parameters.
"""

import django_filters as filters
from django.db.models import Q
from django.utils import timezone

from apps.tickets.models import Channel, Priority, Status, Ticket


def breached_q(now=None) -> Q:
    """Tickets past an SLA deadline they have not met.

    Derived from the stored due timestamps, deliberately — **not** from the
    `sla_response_breached` / `sla_resolution_breached` boolean columns.
    Nothing writes those yet (story 05 owns SLA computation), so filtering on
    them returns zero rows and story 07's *Breaching* tab would render empty
    with no error to explain why.

    This matches story 05's computed-on-read design, and story 05 can lift this
    expression into `sla_service` unchanged. `serializers.is_breached` applies
    the same rule per row, so the filter and the field never disagree.
    """
    now = now or timezone.now()
    return Q(sla_response_due_at__lt=now, first_response_at__isnull=True) | Q(
        sla_resolution_due_at__lt=now, resolved_at__isnull=True
    )


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
