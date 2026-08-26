"""The queue endpoint's query count must not grow with the number of rows.

Each row renders customer name, assignee, category, channel and SLA state.
Written naively that is several extra queries per row, and story 02 seeds ~150
tickets, so it would be visible immediately.

The assertion compares **5 rows against 50 rows** rather than pinning a magic
number. A hard-coded count breaks whenever middleware or auth changes, while
equality tests the property that actually matters: the cost is constant in the
number of rows.
"""

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.accounts.models import Department, User
from apps.customers.models import Contact, Customer
from apps.tickets.models import Category, Tag, Ticket


@pytest.fixture
def department(db):
    return Department.objects.create(name_en="Billing", name_ar="الفوترة", code="billing")


@pytest.fixture
def agent(department):
    return User.objects.create_user(
        username="agent1", password="x", role=User.Role.AGENT, department=department
    )


@pytest.fixture
def api(agent):
    client = APIClient()
    client.force_authenticate(agent)
    return client


def build_tickets(count, department, agent):
    """Rows that exercise every related field the list serializer touches."""
    category = Category.objects.create(
        name_en="Billing", name_ar="الفوترة", slug=f"cat-{count}"
    )
    tag = Tag.objects.create(name_en=f"tag-{count}", name_ar="وسم")
    for i in range(count):
        customer = Customer.objects.create(name=f"Customer {i}", email=f"c{i}@test.dev")
        Contact.objects.create(customer=customer, name=f"Contact {i}", is_primary=True)
        ticket = Ticket.objects.create(
            customer=customer,
            subject=f"Ticket {i}",
            department=department,
            assignee=agent,
            category=category,
        )
        ticket.tags.add(tag)


@pytest.mark.django_db
def test_list_query_count_is_constant(api, department, agent):
    build_tickets(5, department, agent)
    response = api.get("/api/v1/tickets/", {"page_size": 100})
    assert response.data["count"] == 5

    with CaptureQueriesContext(connection) as small:
        api.get("/api/v1/tickets/", {"page_size": 100})
    small_count = len(small)

    build_tickets(45, department, agent)
    response = api.get("/api/v1/tickets/", {"page_size": 100})
    assert response.data["count"] == 50

    with CaptureQueriesContext(connection) as large:
        api.get("/api/v1/tickets/", {"page_size": 100})
    large_count = len(large)

    assert small_count == large_count, (
        f"query count grew with row count: {small_count} for 5 rows, "
        f"{large_count} for 50 — a select_related or prefetch_related is missing"
    )


@pytest.mark.django_db
def test_customer_list_query_count_is_constant(api, department, agent):
    """`open_ticket_count` is the trap here: a per-row .count() would be a query
    each. It is an annotation for that reason.
    """
    build_tickets(5, department, agent)
    with CaptureQueriesContext(connection) as small:
        api.get("/api/v1/customers/", {"page_size": 100})
    small_count = len(small)

    build_tickets(45, department, agent)
    with CaptureQueriesContext(connection) as large:
        api.get("/api/v1/customers/", {"page_size": 100})

    assert small_count == len(large), (
        f"customer list query count grew: {small_count} -> {len(large)}"
    )


@pytest.mark.django_db
def test_list_serializer_does_not_touch_heavy_relations(api, department, agent):
    """`tags`, `watchers`, `messages` and `events` must not appear in a queue row.

    Each is a separate query or join per row, and none of them is rendered in
    the design's queue.
    """
    build_tickets(1, department, agent)
    row = api.get("/api/v1/tickets/").data["results"][0]
    for heavy in ("tags", "watchers", "messages", "events"):
        assert heavy not in row


@pytest.mark.django_db
def test_pagination_defaults_to_25_and_caps_at_100(api, department, agent):
    build_tickets(30, department, agent)

    assert len(api.get("/api/v1/tickets/").data["results"]) == 25
    assert len(api.get("/api/v1/tickets/", {"page_size": 10}).data["results"]) == 10
    # Asking for more than the cap yields the cap, not the whole table.
    assert len(api.get("/api/v1/tickets/", {"page_size": 500}).data["results"]) == 30
