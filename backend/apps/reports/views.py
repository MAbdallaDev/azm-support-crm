"""Manager reports — aggregation only, no models.

Odoo mental map: these are read-only `read_group` calls. Every figure is
computed by the database; there is **no Python-side loop over tickets
anywhere**.

That constraint matters more than it looks. With the 150 seeded tickets a loop
returns exactly the right answer, which is precisely why it would survive review
and then fall over on real data. `tests/test_report_queries.py` asserts the query
count is identical for a 20-ticket and a 150-ticket dataset — the same
property-based shape as story 04's queue test.

Durations are returned as integer seconds. `Avg(F("a") - F("b"))` gives a
timedelta from the database; the conversion happens once, here.
"""

from datetime import timedelta

from django.db.models import Avg, Count, F, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsAgentOrAbove, IsManager
from apps.accounts.scoping import scope_tickets
from apps.reports.serializers import (
    AgentsReportSerializer,
    CSATReportSerializer,
    MySummarySerializer,
    OverviewReportSerializer,
    VolumeReportSerializer,
)
from apps.tickets.models import CSATRating, Status, Ticket
from apps.tickets.services.sla_service import breached_q

# Allow-listed so the SQL stays bounded — an unvalidated ?days= is an
# open invitation to scan the whole table.
ALLOWED_RANGES = (7, 30, 90)
DEFAULT_RANGE = 30

OPEN_STATUSES = (
    Status.NEW, Status.OPEN, Status.PENDING,
    Status.ON_HOLD, Status.ESCALATED, Status.REOPENED,
)
DONE_STATUSES = (Status.RESOLVED, Status.CLOSED)

DAYS_PARAM = OpenApiParameter(
    "days", int, description=f"Reporting window. One of {ALLOWED_RANGES}. Default {DEFAULT_RANGE}."
)


def _seconds(value):
    """A timedelta from the database, as whole seconds. None stays None."""
    if value is None:
        return None
    if isinstance(value, timedelta):
        return int(value.total_seconds())
    # Some backends return a float of seconds rather than a timedelta.
    return int(value)


class ManagerReportView(APIView):
    """Shared base: manager-or-admin only, scope-respecting, `?days=` bounded.

    `IsManager` alone would lock administrators out of their own reports, which
    is why the check is role-in-set rather than role-equals.
    """

    permission_classes = [IsManager]

    def get_permissions(self):
        return [_ManagerOrAdmin()]

    def window(self, request):
        try:
            days = int(request.query_params.get("days", DEFAULT_RANGE))
        except (TypeError, ValueError):
            days = DEFAULT_RANGE
        if days not in ALLOWED_RANGES:
            days = DEFAULT_RANGE
        return days, timezone.now() - timedelta(days=days)

    def tickets(self, request, since):
        """Always starts from the caller's scope, never from Ticket.objects.

        A manager's report must show their department's numbers, not the whole
        company's — otherwise the report leaks exactly what story 03's scoping
        was built to contain.
        """
        return scope_tickets(Ticket.objects.all(), request.user).filter(
            created_at__gte=since
        )


class _ManagerOrAdmin(IsManager):
    message = "Manager or administrator role required."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return False
        return getattr(user, "role", None) in (User.Role.MANAGER, User.Role.ADMIN)


@extend_schema(
    tags=["reports"],
    summary="Headline KPI tiles",
    parameters=[DAYS_PARAM],
    responses={200: OverviewReportSerializer},
)
class OverviewReportView(ManagerReportView):
    def get(self, request):
        days, since = self.window(request)
        qs = self.tickets(request, since)
        now = timezone.now()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # One aggregate call for six metrics, using filter=Q(...) per metric
        # rather than six separate queries.
        agg = qs.aggregate(
            total=Count("id"),
            open=Count("id", filter=Q(status__in=OPEN_STATUSES)),
            resolved_today=Count("id", filter=Q(resolved_at__gte=today)),
            breached=Count("id", filter=breached_q(now)),
            avg_first_response=Avg(
                F("first_response_at") - F("created_at"),
                filter=Q(first_response_at__isnull=False),
            ),
            avg_resolution=Avg(
                F("resolved_at") - F("created_at"),
                filter=Q(resolved_at__isnull=False),
            ),
            met=Count(
                "id",
                filter=Q(status__in=DONE_STATUSES, resolved_at__isnull=False)
                & Q(resolved_at__lte=F("sla_resolution_due_at")),
            ),
            finished=Count(
                "id",
                filter=Q(
                    status__in=DONE_STATUSES,
                    resolved_at__isnull=False,
                    sla_resolution_due_at__isnull=False,
                ),
            ),
        )

        csat = CSATRating.objects.filter(ticket__in=qs).aggregate(avg=Avg("score"))

        finished = agg["finished"] or 0
        compliance = round(100 * agg["met"] / finished, 1) if finished else None

        return Response(
            {
                "days": days,
                "total": agg["total"],
                "open": agg["open"],
                "resolved_today": agg["resolved_today"],
                "breached": agg["breached"],
                "avg_first_response_seconds": _seconds(agg["avg_first_response"]),
                "avg_resolution_seconds": _seconds(agg["avg_resolution"]),
                "sla_compliance_percent": compliance,
                "csat_average": round(csat["avg"], 2) if csat["avg"] else None,
            }
        )


@extend_schema(
    tags=["reports"],
    summary="Ticket volume by status, priority, channel and day",
    parameters=[DAYS_PARAM],
    responses={200: VolumeReportSerializer},
)
class VolumeReportView(ManagerReportView):
    def get(self, request):
        days, since = self.window(request)
        qs = self.tickets(request, since)

        def group(field):
            # One query per grouping — four in total, regardless of row count.
            return [
                {"key": str(row[field]), "count": row["count"]}
                for row in qs.values(field).annotate(count=Count("id")).order_by(field)
            ]

        by_day = [
            {"key": row["day"].isoformat(), "count": row["count"]}
            for row in qs.annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        ]

        return Response(
            {
                "days": days,
                "by_status": group("status"),
                "by_priority": group("priority"),
                "by_channel": group("channel"),
                "by_day": by_day,
            }
        )


@extend_schema(
    tags=["reports"],
    summary="Per-agent performance",
    parameters=[DAYS_PARAM],
    responses={200: AgentsReportSerializer},
)
class AgentsReportView(ManagerReportView):
    def get(self, request):
        days, since = self.window(request)
        visible = self.tickets(request, since)

        # A single annotated query over agents. `filter=Q(...)` restricts each
        # aggregate to the visible, in-window tickets rather than joining twice.
        in_window = Q(assigned_tickets__in=visible)

        rows = (
            User.objects.filter(role=User.Role.AGENT)
            .select_related("department")
            .annotate(
                assigned=Count("assigned_tickets", filter=in_window, distinct=True),
                resolved=Count(
                    "assigned_tickets",
                    filter=in_window & Q(assigned_tickets__status__in=DONE_STATUSES),
                    distinct=True,
                ),
                avg_first_response=Avg(
                    F("assigned_tickets__first_response_at")
                    - F("assigned_tickets__created_at"),
                    filter=in_window & Q(assigned_tickets__first_response_at__isnull=False),
                ),
                met=Count(
                    "assigned_tickets",
                    filter=in_window
                    & Q(assigned_tickets__status__in=DONE_STATUSES)
                    & Q(assigned_tickets__resolved_at__isnull=False)
                    & Q(
                        assigned_tickets__resolved_at__lte=F(
                            "assigned_tickets__sla_resolution_due_at"
                        )
                    ),
                    distinct=True,
                ),
                finished=Count(
                    "assigned_tickets",
                    filter=in_window
                    & Q(
                        assigned_tickets__status__in=DONE_STATUSES,
                        assigned_tickets__resolved_at__isnull=False,
                        assigned_tickets__sla_resolution_due_at__isnull=False,
                    ),
                    distinct=True,
                ),
                csat_average=Avg("assigned_tickets__csat__score", filter=in_window),
            )
            .order_by("-resolved", "username")
        )

        agents = [
            {
                "id": row.id,
                "username": row.username,
                "full_name": row.get_full_name() or row.username,
                "department": row.department.name_en if row.department_id else "",
                "assigned": row.assigned,
                "resolved": row.resolved,
                "avg_first_response_seconds": _seconds(row.avg_first_response),
                "sla_compliance_percent": (
                    round(100 * row.met / row.finished, 1) if row.finished else None
                ),
                "csat_average": (
                    round(row.csat_average, 2) if row.csat_average else None
                ),
            }
            for row in rows
        ]
        return Response({"days": days, "agents": agents})


@extend_schema(
    tags=["reports"],
    summary="CSAT distribution and average",
    parameters=[DAYS_PARAM],
    responses={200: CSATReportSerializer},
)
class CSATReportView(ManagerReportView):
    def get(self, request):
        days, since = self.window(request)
        qs = self.tickets(request, since)
        ratings = CSATRating.objects.filter(ticket__in=qs)

        buckets = {
            row["score"]: row["count"]
            for row in ratings.values("score").annotate(count=Count("id"))
        }
        summary = ratings.aggregate(average=Avg("score"), count=Count("id"))

        return Response(
            {
                "days": days,
                "average": round(summary["average"], 2) if summary["average"] else None,
                "count": summary["count"],
                # Every score present, including zeros — a bar chart with a
                # missing category renders as a gap the reader misreads as data.
                "distribution": [
                    {"score": score, "count": buckets.get(score, 0)}
                    for score in range(1, 6)
                ],
            }
        )


@extend_schema(
    tags=["reports"],
    summary="The signed-in agent's own dashboard figures",
    description=(
        "Agent-reachable, unlike the four manager reports. Every count is "
        "scoped to the caller and has a matching queue filter, so a dashboard "
        "tile and the queue its link opens report the same set of tickets."
    ),
    responses={200: MySummarySerializer},
)
class MySummaryView(APIView):
    """Story 07's agent dashboard, in one request.

    **Why this exists rather than reusing `reports/overview/`:** that view is
    `IsManager`-gated (manager or admin), so an agent — the dashboard's actual
    audience — gets a 403. Loosening it instead would expose department-wide
    figures to every agent, which is precisely what story 03's scoping was
    built to prevent.

    Four of these numbers could be had from four `tickets/?...&page_size=1`
    count queries. **`csat_average` could not** — `csat_score` appears on the
    detail serializer only, never on the list, so there is no filter that
    produces it. One request instead of five, and the honest home for a figure
    no queue filter can express.

    Aggregate-only, like the other reports: no Python-side loop over tickets,
    and a bounded number of queries regardless of dataset size.
    """

    permission_classes = [IsAgentOrAbove]

    def get(self, request):
        user = request.user
        now = timezone.now()
        # **Local** midnight, not UTC midnight. TIME_ZONE is Asia/Riyadh, so
        # `now.replace(hour=0)` starts "today" three hours late and silently
        # drops everything an agent resolved between 00:00 and 03:00 their
        # time. The dashboard's own link uses the browser's local midnight, so
        # a UTC boundary here also makes the tile disagree with the queue it
        # opens — the one thing these figures must never do.
        today = timezone.localtime(now).replace(hour=0, minute=0, second=0, microsecond=0)
        within_hour = now + timedelta(hours=1)

        # Starts from the caller's scope, never Ticket.objects — an agent's
        # "unassigned in my department" must not count rows they cannot open.
        scoped = scope_tickets(Ticket.objects.all(), user)

        # One aggregate call for six counts. filter=Q(...) per metric is what
        # keeps this a single query rather than one round trip per tile.
        mine = Q(assignee=user)
        open_now = Q(status__in=OPEN_STATUSES)

        counts = scoped.aggregate(
            my_open=Count("id", filter=mine & open_now),
            awaiting_first_reply=Count(
                "id", filter=mine & open_now & Q(first_response_at__isnull=True)
            ),
            breaching_within_hour=Count(
                "id",
                filter=mine
                & open_now
                & Q(
                    resolved_at__isnull=True,
                    sla_resolution_due_at__gte=now,
                    sla_resolution_due_at__lte=within_hour,
                ),
            ),
            # Deliberately NOT `& mine`: the point of the tile is work nobody
            # owns yet, in the caller's department.
            unassigned_in_department=Count(
                "id",
                filter=open_now
                & Q(assignee__isnull=True)
                & Q(department=user.department_id),
            ),
            resolved_by_me_today=Count(
                "id", filter=mine & Q(resolved_at__gte=today)
            ),
            already_breached=Count("id", filter=mine & breached_q(now)),
        )

        ratings = CSATRating.objects.filter(ticket__in=scoped.filter(assignee=user))
        csat = ratings.aggregate(average=Avg("score"), count=Count("id"))
        buckets = {
            row["score"]: row["count"]
            for row in ratings.values("score").annotate(count=Count("id"))
        }

        return Response(
            {
                **counts,
                "csat_average": round(csat["average"], 2) if csat["average"] else None,
                "csat_count": csat["count"],
                # Every score present, including zeros — see CSATReportView.
                "csat_distribution": [
                    {"score": score, "count": buckets.get(score, 0)}
                    for score in range(1, 6)
                ],
            }
        )
