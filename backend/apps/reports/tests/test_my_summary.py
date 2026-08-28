"""`reports/my-summary/` — the agent dashboard's figures.

The sixth backend addition story 07 needed. It exists because the other four
reports are manager-or-admin only, so the agent dashboard — whose audience is
agents — could not read any of them.

The tests that matter most here are the last two: **each count agrees with the
queue filter its dashboard tile links to**. A tile showing 7 that opens a list
of 5 is worse than no tile, and it is the kind of drift nothing else would
catch, because both halves look correct in isolation.
"""

from datetime import timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Department, User
from apps.customers.models import Customer
from apps.tickets.models import CSATRating, Status, Ticket

URL = "/api/v1/reports/my-summary/"


@pytest.fixture
def billing(db):
    return Department.objects.create(name_en="Billing", name_ar="الفوترة", code="billing")


@pytest.fixture
def agent(billing):
    return User.objects.create_user(
        username="ms-agent", password="x", role=User.Role.AGENT, department=billing
    )


@pytest.fixture
def other_agent(billing):
    return User.objects.create_user(
        username="ms-other", password="x", role=User.Role.AGENT, department=billing
    )


@pytest.fixture
def api(agent):
    client = APIClient()
    client.force_authenticate(agent)
    return client


@pytest.fixture
def customer(db):
    return Customer.objects.create(name="Acme", email="acme@test.dev")


def make(customer, billing, **kwargs):
    return Ticket.objects.create(
        customer=customer, subject="S", department=billing, **kwargs
    )


# ---------------------------------------------------------------------------
# Reachability — the whole reason this endpoint exists
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_an_agent_can_read_it(api):
    """The four manager reports return 403 here; that is what forced this view."""
    assert api.get(URL).status_code == 200


@pytest.mark.django_db
def test_an_agent_still_cannot_read_the_manager_reports(api):
    """Guards the boundary this addition must not have loosened."""
    assert api.get("/api/v1/reports/overview/").status_code == 403


@pytest.mark.django_db
def test_an_anonymous_caller_is_rejected(db):
    assert APIClient().get(URL).status_code == 401


# ---------------------------------------------------------------------------
# The numbers
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_counts_only_the_callers_own_work(api, agent, other_agent, customer, billing):
    make(customer, billing, assignee=agent, status=Status.OPEN)
    make(customer, billing, assignee=agent, status=Status.PENDING)
    make(customer, billing, assignee=other_agent, status=Status.OPEN)
    # Resolved work is not open work.
    make(customer, billing, assignee=agent, status=Status.RESOLVED)

    assert api.get(URL).data["my_open"] == 2


@pytest.mark.django_db
def test_unassigned_in_department_is_deliberately_not_scoped_to_the_caller(
    api, agent, customer, billing
):
    """The tile is about work **nobody** owns — filtering it to `mine` would
    always return zero, which would look like a working tile showing good news."""
    make(customer, billing, assignee=None, status=Status.NEW)
    make(customer, billing, assignee=None, status=Status.OPEN)
    make(customer, billing, assignee=agent, status=Status.OPEN)

    assert api.get(URL).data["unassigned_in_department"] == 2


@pytest.mark.django_db
def test_breaching_within_the_hour_excludes_the_already_breached(
    api, agent, customer, billing
):
    now = timezone.now()

    soon = make(customer, billing, assignee=agent, status=Status.OPEN)
    soon.sla_resolution_due_at = now + timedelta(minutes=40)
    soon.save()

    already = make(customer, billing, assignee=agent, status=Status.OPEN)
    already.sla_resolution_due_at = now - timedelta(minutes=10)
    already.save()

    data = api.get(URL).data

    # Two separate tiles, two disjoint sets — one ticket is never in both.
    assert data["breaching_within_hour"] == 1
    assert data["already_breached"] == 1


@pytest.mark.django_db
def test_resolved_by_me_today_starts_at_LOCAL_midnight(api, agent, customer, billing):
    """"Today" is the agent's working day, not the UTC day.

    TIME_ZONE is Asia/Riyadh (UTC+3), so a UTC boundary starts "today" three
    hours late and drops everything resolved between 00:00 and 03:00 local.
    The dashboard tile links to `?resolved_after=<browser local midnight>`, so
    a UTC boundary here would also make the tile disagree with the queue it
    opens.

    Timestamps are anchored to local midnight rather than to `now`, because
    `now - 10 minutes` lands in *yesterday* whenever the suite happens to run
    within ten minutes of midnight — which is how this bug was found.
    """
    local_midnight = timezone.localtime(timezone.now()).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    just_after_midnight = make(customer, billing, assignee=agent, status=Status.RESOLVED)
    just_after_midnight.resolved_at = local_midnight + timedelta(minutes=1)
    just_after_midnight.save()

    just_before_midnight = make(customer, billing, assignee=agent, status=Status.RESOLVED)
    just_before_midnight.resolved_at = local_midnight - timedelta(minutes=1)
    just_before_midnight.save()

    # One minute either side of the boundary: a UTC-midnight implementation
    # counts neither, since both fall before 03:00 local.
    assert api.get(URL).data["resolved_by_me_today"] == 1


@pytest.mark.django_db
def test_csat_covers_the_callers_tickets_only(api, agent, other_agent, customer, billing):
    mine = make(customer, billing, assignee=agent, status=Status.RESOLVED)
    theirs = make(customer, billing, assignee=other_agent, status=Status.RESOLVED)
    CSATRating.objects.create(ticket=mine, score=5)
    CSATRating.objects.create(ticket=theirs, score=1)

    data = api.get(URL).data

    assert data["csat_average"] == 5.0
    assert data["csat_count"] == 1
    # Every score present including zeros — a bar chart with a missing category
    # renders as a gap the reader misreads as data.
    assert [bucket["score"] for bucket in data["csat_distribution"]] == [1, 2, 3, 4, 5]


@pytest.mark.django_db
def test_csat_average_is_null_rather_than_zero_when_unrated(api):
    """Zero is a real CSAT score and would render as a catastrophic rating."""
    assert api.get(URL).data["csat_average"] is None


# ---------------------------------------------------------------------------
# Tile / queue agreement — the assertions this file exists for
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_my_open_matches_the_queue_its_tile_links_to(api, agent, other_agent, customer, billing):
    for status_value in (Status.NEW, Status.OPEN, Status.PENDING, Status.ON_HOLD):
        make(customer, billing, assignee=agent, status=status_value)
    make(customer, billing, assignee=agent, status=Status.RESOLVED)
    make(customer, billing, assignee=other_agent, status=Status.OPEN)

    tile = api.get(URL).data["my_open"]
    queue = api.get(
        "/api/v1/tickets/",
        {
            "assignee": agent.pk,
            "status": ["new", "open", "pending", "on_hold", "escalated", "reopened"],
        },
    ).data["count"]

    assert tile == queue == 4


@pytest.mark.django_db
def test_breaching_tile_matches_the_queue_its_link_opens(api, agent, customer, billing):
    now = timezone.now()
    for minutes in (10, 30, 55):
        ticket = make(customer, billing, assignee=agent, status=Status.OPEN)
        ticket.sla_resolution_due_at = now + timedelta(minutes=minutes)
        ticket.save()
    # Outside the window, and already past it — neither tile nor queue counts these.
    outside = make(customer, billing, assignee=agent, status=Status.OPEN)
    outside.sla_resolution_due_at = now + timedelta(hours=6)
    outside.save()

    tile = api.get(URL).data["breaching_within_hour"]
    queue = api.get(
        "/api/v1/tickets/", {"assignee": agent.pk, "due_within_minutes": 60}
    ).data["count"]

    assert tile == queue == 3


@pytest.mark.django_db
def test_unassigned_tile_matches_its_department_code_queue(api, customer, billing):
    for _ in range(3):
        make(customer, billing, assignee=None, status=Status.OPEN)

    tile = api.get(URL).data["unassigned_in_department"]
    queue = api.get(
        "/api/v1/tickets/",
        {
            "unassigned": "true",
            "department_code": "billing",
            "status": ["new", "open", "pending", "on_hold", "escalated", "reopened"],
        },
    ).data["count"]

    assert tile == queue == 3


# ---------------------------------------------------------------------------
# The same bounded-query property the other four reports carry
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_query_count_does_not_grow_with_the_dataset(api, agent, customer, billing):
    """Aggregate-only, like every other report — no Python loop over tickets.

    With a handful of rows a loop returns the right answer, which is exactly
    why it would pass review and then fall over. Comparing 5 rows against 50
    tests the property rather than pinning a brittle magic number.
    """
    for _ in range(5):
        make(customer, billing, assignee=agent, status=Status.OPEN)
    api.get(URL)  # warm any lazily-loaded machinery

    with CaptureQueriesContext(connection) as small:
        api.get(URL)

    for _ in range(45):
        make(customer, billing, assignee=agent, status=Status.OPEN)

    with CaptureQueriesContext(connection) as large:
        api.get(URL)

    assert len(small) == len(large)
