"""Reports: correct numbers, respected scope, and a constant query count.

The query-count assertion is the load-bearing one. With 150 tickets a
Python-side loop returns exactly the right answer — which is precisely why it
would survive review and then fall over on real data. Comparing 20 rows against
150 tests the property that matters rather than a magic number.
"""

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Branch, Department, User
from apps.customers.models import Customer
from apps.tickets.models import CSATRating, SLAPolicy, Status, Ticket

ENDPOINTS = ["overview", "volume", "agents", "csat"]


@pytest.fixture
def org(db):
    department = Department.objects.create(name_en="Billing", name_ar="فوترة", code="rep-billing")
    other = Department.objects.create(name_en="Technical", name_ar="فني", code="rep-tech")
    branch = Branch.objects.create(name_en="Riyadh", name_ar="الرياض", code="rep-riyadh")
    SLAPolicy.objects.create(
        name="Rep-Normal", customer_tier="standard", priority="normal",
        first_response_minutes=60, resolution_minutes=480,
    )
    return {"department": department, "other": other, "branch": branch}


@pytest.fixture
def manager(org):
    return User.objects.create_user(
        username="rep-manager", password="x", role=User.Role.MANAGER,
        department=org["department"], branch=org["branch"],
    )


@pytest.fixture
def admin(org):
    return User.objects.create_user(
        username="rep-admin", password="x", role=User.Role.ADMIN, branch=org["branch"]
    )


@pytest.fixture
def customer(db):
    return Customer.objects.create(name="Acme", email="ops@acme.test", tier="standard")


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def build(count, customer, department, agent=None, resolved=0, rated=0):
    now = timezone.now()
    made = []
    for i in range(count):
        ticket = Ticket.objects.create(
            customer=customer, subject=f"Report ticket {i}",
            department=department, assignee=agent,
            sla_resolution_due_at=now + timezone.timedelta(hours=8),
        )
        Ticket.objects.filter(pk=ticket.pk).update(
            first_response_at=now,
            **(
                {"resolved_at": now, "status": Status.RESOLVED}
                if i < resolved
                else {}
            ),
        )
        ticket.refresh_from_db()
        made.append(ticket)
    for ticket in made[:rated]:
        CSATRating.objects.create(ticket=ticket, score=5)
    return made


# ---------------------------------------------------------------------------
# Access
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_manager_and_admin_may_read_reports(manager, admin, endpoint):
    """Admins must not be locked out of their own reports."""
    assert client_for(manager).get(f"/api/v1/reports/{endpoint}/").status_code == 200
    assert client_for(admin).get(f"/api/v1/reports/{endpoint}/").status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_agents_and_customers_are_refused(org, customer, endpoint):
    agent = User.objects.create_user(
        username="rep-agent", password="x", role=User.Role.AGENT, department=org["department"]
    )
    portal = User.objects.create_user(
        username="rep-portal", password="x", role=User.Role.CUSTOMER, customer=customer
    )
    assert client_for(agent).get(f"/api/v1/reports/{endpoint}/").status_code == 403
    assert client_for(portal).get(f"/api/v1/reports/{endpoint}/").status_code == 403


@pytest.mark.django_db
def test_anonymous_is_401(org):
    assert APIClient().get("/api/v1/reports/overview/").status_code == 401


# ---------------------------------------------------------------------------
# Scope
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_a_managers_report_covers_only_their_department(manager, org, customer):
    """Otherwise the report leaks exactly what story 03's scoping contains."""
    build(4, customer, org["department"])
    build(7, customer, org["other"])

    data = client_for(manager).get("/api/v1/reports/overview/").data
    assert data["total"] == 4


@pytest.mark.django_db
def test_an_admin_sees_everything(admin, org, customer):
    build(4, customer, org["department"])
    build(7, customer, org["other"])
    assert client_for(admin).get("/api/v1/reports/overview/").data["total"] == 11


# ---------------------------------------------------------------------------
# The query-count property
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_query_count_is_independent_of_row_count(admin, org, customer, endpoint):
    agent = User.objects.create_user(
        username=f"qa-agent-{endpoint}", password="x", role=User.Role.AGENT,
        department=org["department"],
    )
    url = f"/api/v1/reports/{endpoint}/?days=90"
    client = client_for(admin)

    build(20, customer, org["department"], agent=agent, resolved=8, rated=5)
    client.get(url)  # warm any lazy imports
    with CaptureQueriesContext(connection) as small:
        assert client.get(url).status_code == 200
    small_count = len(small)

    build(130, customer, org["department"], agent=agent, resolved=50, rated=30)
    with CaptureQueriesContext(connection) as large:
        assert client.get(url).status_code == 200

    assert small_count == len(large), (
        f"reports/{endpoint}/ query count grew with the dataset: "
        f"{small_count} for 20 tickets, {len(large)} for 150 — "
        "something is looping in Python instead of aggregating."
    )


# ---------------------------------------------------------------------------
# Numbers
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_overview_numbers(admin, org, customer):
    build(10, customer, org["department"], resolved=4, rated=3)
    data = client_for(admin).get("/api/v1/reports/overview/").data

    assert data["total"] == 10
    assert data["open"] == 6
    assert data["resolved_today"] == 4
    assert data["avg_first_response_seconds"] is not None
    assert data["csat_average"] == 5.0
    assert data["sla_compliance_percent"] == 100.0


@pytest.mark.django_db
def test_volume_groups_and_day_buckets(admin, org, customer):
    build(5, customer, org["department"], resolved=2)
    data = client_for(admin).get("/api/v1/reports/volume/").data

    assert sum(row["count"] for row in data["by_status"]) == 5
    assert sum(row["count"] for row in data["by_priority"]) == 5
    assert sum(row["count"] for row in data["by_channel"]) == 5
    assert sum(row["count"] for row in data["by_day"]) == 5
    assert sum(row["count"] for row in data["by_day_channel"]) == 5
    assert all({"day", "channel", "count"} == set(row) for row in data["by_day_channel"])


@pytest.mark.django_db
def test_agents_report_rows(admin, org, customer):
    agent = User.objects.create_user(
        username="rep-worker", password="x", role=User.Role.AGENT,
        department=org["department"],
    )
    build(6, customer, org["department"], agent=agent, resolved=4, rated=2)

    rows = client_for(admin).get("/api/v1/reports/agents/").data["agents"]
    row = next(r for r in rows if r["username"] == "rep-worker")
    assert row["assigned"] == 6
    assert row["resolved"] == 4
    assert row["csat_average"] == 5.0
    assert row["sla_compliance_percent"] == 100.0


@pytest.mark.django_db
def test_csat_distribution_includes_empty_scores(admin, org, customer):
    """A bar chart with a missing category reads as data, not as zero."""
    tickets = build(3, customer, org["department"], resolved=3)
    for ticket, score in zip(tickets, [5, 4, 5]):
        CSATRating.objects.update_or_create(ticket=ticket, defaults={"score": score})

    data = client_for(admin).get("/api/v1/reports/csat/").data
    assert [row["score"] for row in data["distribution"]] == [1, 2, 3, 4, 5]
    assert data["count"] == 3
    assert data["average"] == pytest.approx(4.67, abs=0.01)


@pytest.mark.django_db
def test_days_parameter_is_allow_listed(admin, org, customer):
    """An unvalidated ?days= is an invitation to scan the whole table."""
    client = client_for(admin)
    assert client.get("/api/v1/reports/overview/?days=7").data["days"] == 7
    assert client.get("/api/v1/reports/overview/?days=90").data["days"] == 90
    assert client.get("/api/v1/reports/overview/?days=99999").data["days"] == 30
    assert client.get("/api/v1/reports/overview/?days=nonsense").data["days"] == 30


@pytest.mark.django_db
def test_empty_dataset_returns_nulls_not_errors(admin, org):
    data = client_for(admin).get("/api/v1/reports/overview/").data
    assert data["total"] == 0
    assert data["csat_average"] is None
    assert data["sla_compliance_percent"] is None
