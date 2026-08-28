"""Queue filters — what the story 07 tabs and the filter bar send.

Odoo mental map: this is the search view's filter definitions, except the
client composes them as query-string parameters.
"""

from datetime import timedelta

import django_filters as filters
from django.db.models import Q
from django.utils import timezone

from apps.tickets.models import Channel, Priority, Status, Ticket
from apps.tickets.services import ticket_service
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

    # Story 07's "resolved by me today" dashboard tile. Mirrors the
    # created_after/created_before pair exactly rather than inventing a
    # different shape for the same idea.
    resolved_after = filters.DateTimeFilter(field_name="resolved_at", lookup_expr="gte")
    resolved_before = filters.DateTimeFilter(field_name="resolved_at", lookup_expr="lte")

    due_within_minutes = filters.NumberFilter(method="filter_due_within")

    # Filters by department **code**, alongside the pk-based `department` in
    # Meta.fields rather than replacing it — story 04's tests use the pk form.
    #
    # It exists because `MeSerializer.department` is a SlugRelatedField and
    # returns a code string, so the frontend holds no id to filter with. Codes
    # also make a shared queue link readable: ?department_code=billing rather
    # than ?department=3.
    department_code = filters.CharFilter(field_name="department__code")

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

    def filter_due_within(self, queryset, name, value):
        """Unresolved tickets whose resolution deadline falls in the next N minutes.

        Distinct from `breached=true`, which means *already* past the deadline.
        Story 07's second dashboard tile is "breaching within the hour" — work
        that can still be saved — and a tile that opened the already-breached
        queue would be telling the agent about a different set of tickets than
        the number it displays.

        The window is `[now, now + N]`, so a ticket that has already slipped
        past its deadline is **not** included: it belongs to `breached`, and
        counting it in both would double-report the same ticket across two
        tiles. "Unresolved" is `OPEN_STATUSES` from `ticket_service`, not a
        locally re-derived list.
        """
        if value is None:
            return queryset
        now = timezone.now()
        return queryset.filter(
            status__in=ticket_service.OPEN_STATUSES,
            resolved_at__isnull=True,
            sla_resolution_due_at__gte=now,
            sla_resolution_due_at__lte=now + timedelta(minutes=float(value)),
        )
