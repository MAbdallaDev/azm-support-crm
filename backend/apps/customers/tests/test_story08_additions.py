"""The customer-app additions story 08's frontend could not be built without.

1. `customers/<id>/attachments/` — every file across a customer's tickets,
   scoped through `scope_tickets`, not just `scope_customers`.
2. `last_activity` on the customer list — annotated, so the list's query
   count does not grow with the number of rows.
3. `branches/` (and `departments/`) — read-only reference lists the customer
   filter's branch dropdown has nowhere else to read from.
"""

from datetime import timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Branch, Department, User
from apps.customers.models import Customer
from apps.tickets.models import Attachment, Ticket

URL = "/api/v1/customers/"


@pytest.fixture
def billing(db):
    return Department.objects.create(name_en="Billing", name_ar="الفوترة", code="s8-billing")


@pytest.fixture
def technical(db):
    return Department.objects.create(name_en="Technical", name_ar="التقني", code="s8-technical")


@pytest.fixture
def branch(db):
    return Branch.objects.create(name_en="Riyadh", name_ar="الرياض", code="s8-riyadh")


@pytest.fixture
def agent(billing, branch):
    return User.objects.create_user(
        username="s8-agent", password="x", role=User.Role.AGENT,
        department=billing, branch=branch,
    )


@pytest.fixture
def api(agent):
    client = APIClient()
    client.force_authenticate(agent)
    return client


@pytest.fixture
def customer(branch):
    return Customer.objects.create(name="Omari Contracting", email="k@omari.test", branch=branch)


def make_ticket(customer, department, **kwargs):
    return Ticket.objects.create(customer=customer, subject="S", department=department, **kwargs)


# ---------------------------------------------------------------------------
# 1 — customer attachments, scoped through scope_tickets
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_lists_every_attachment_across_the_customers_tickets(api, customer, billing):
    first = make_ticket(customer, billing)
    second = make_ticket(customer, billing)
    Attachment.objects.create(ticket=first, filename="invoice.pdf", size=100)
    Attachment.objects.create(ticket=second, filename="log.csv", size=200)

    response = api.get(f"{URL}{customer.pk}/attachments/")

    assert response.status_code == 200
    names = {row["filename"] for row in response.data}
    assert names == {"invoice.pdf", "log.csv"}


@pytest.mark.django_db
def test_names_the_source_ticket_on_every_attachment(api, customer, billing):
    ticket = make_ticket(customer, billing)
    Attachment.objects.create(ticket=ticket, filename="invoice.pdf", size=100)

    row = api.get(f"{URL}{customer.pk}/attachments/").data[0]

    assert row["ticket"] == ticket.pk
    assert row["ticket_number"] == ticket.number


@pytest.mark.django_db
def test_excludes_attachments_on_tickets_outside_the_callers_department(
    api, customer, billing, technical
):
    """The critical scoping test: `ScopedQuerySetMixin` on this viewset scopes
    the customer row, not the tickets hanging off it. An agent in Billing who
    can open this customer must still not reach a Technical-department
    ticket's attachments through it.
    """
    mine = make_ticket(customer, billing)
    theirs = make_ticket(customer, technical)
    Attachment.objects.create(ticket=mine, filename="mine.pdf", size=1)
    Attachment.objects.create(ticket=theirs, filename="theirs.pdf", size=1)

    names = {row["filename"] for row in api.get(f"{URL}{customer.pk}/attachments/").data}

    assert names == {"mine.pdf"}
    assert "theirs.pdf" not in names


@pytest.mark.django_db
def test_orders_newest_first(api, customer, billing):
    now = timezone.now()
    older = make_ticket(customer, billing)
    newer = make_ticket(customer, billing)
    Attachment.objects.create(ticket=older, filename="older.pdf", size=1)
    Attachment.objects.create(ticket=newer, filename="newer.pdf", size=1)
    Attachment.objects.filter(filename="older.pdf").update(created_at=now - timedelta(days=1))

    filenames = [row["filename"] for row in api.get(f"{URL}{customer.pk}/attachments/").data]

    assert filenames == ["newer.pdf", "older.pdf"]


# ---------------------------------------------------------------------------
# 2 — last_activity, without growing the query count
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_last_activity_is_the_customers_most_recently_updated_ticket(api, customer, billing):
    now = timezone.now()
    old = make_ticket(customer, billing)
    Ticket.objects.filter(pk=old.pk).update(updated_at=now - timedelta(days=5))
    recent = make_ticket(customer, billing)
    Ticket.objects.filter(pk=recent.pk).update(updated_at=now)

    row = next(r for r in api.get(URL).data["results"] if r["id"] == customer.pk)

    assert row["last_activity"] is not None
    # Within a second: comparing exact microseconds across a DB round trip is
    # the kind of assertion that flakes for reasons that have nothing to do
    # with correctness.
    from django.utils.dateparse import parse_datetime

    assert abs((parse_datetime(row["last_activity"]) - now).total_seconds()) < 2


@pytest.mark.django_db
def test_last_activity_is_null_for_a_customer_with_no_tickets(api, branch):
    lonely = Customer.objects.create(name="No Tickets Yet", email="none@test.dev", branch=branch)

    row = next(r for r in api.get(URL).data["results"] if r["id"] == lonely.pk)

    assert row["last_activity"] is None


@pytest.mark.django_db
def test_list_query_count_is_constant(api, branch, billing):
    """Same shape as story 04's queue test: 5 rows against 50, not a pinned
    magic number. A `SerializerMethodField` computing `last_activity` per row
    would show up here as a query count that grows with the page.
    """
    def build(n):
        for i in range(n):
            c = Customer.objects.create(name=f"Cust {i}", email=f"c{i}@test.dev", branch=branch)
            make_ticket(c, billing)

    build(5)
    api.get(URL, {"page_size": 100})
    with CaptureQueriesContext(connection) as small:
        api.get(URL, {"page_size": 100})
    small_count = len(small)

    build(45)
    with CaptureQueriesContext(connection) as large:
        response = api.get(URL, {"page_size": 100})
    assert response.data["count"] >= 50

    assert len(large) == small_count


# ---------------------------------------------------------------------------
# 3 — branches / departments reference endpoints
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_branches_endpoint_lists_every_branch_unpaginated(api, branch):
    response = api.get("/api/v1/branches/")

    assert response.status_code == 200
    # Unpaginated: a bare list, not a {results: [...]} envelope.
    assert isinstance(response.data, list)
    codes = {row["code"] for row in response.data}
    assert "s8-riyadh" in codes


@pytest.mark.django_db
def test_departments_endpoint_lists_every_department_unpaginated(api, billing):
    response = api.get("/api/v1/departments/")

    assert response.status_code == 200
    assert isinstance(response.data, list)
    codes = {row["code"] for row in response.data}
    assert "s8-billing" in codes


@pytest.mark.django_db
def test_the_customer_filter_can_actually_use_a_branch_from_that_list(api, branch, customer):
    listed = api.get("/api/v1/branches/").data
    assert any(row["code"] == branch.code for row in listed)

    filtered = api.get(URL, {"branch": branch.pk}).data["results"]
    assert any(row["id"] == customer.pk for row in filtered)
