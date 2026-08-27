"""The endpoint-level role matrix that story 03 deliberately deferred.

Story 03 tested the scoping functions directly at queryset level, because it
shipped no scoped endpoints. This story ships them, so the same matrix is
re-asserted over the real routes — where a viewset that forgot the mixin, or set
`scope_function` bare instead of via `staticmethod`, would show up.

Seeded via `seed_demo` so the cross-role counts are against realistic data
rather than a fixture built to make the assertions pass.
"""

import io

import pytest
from django.core.management import call_command
from django.db import transaction
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.tickets.models import Ticket

TICKETS_URL = "/api/v1/tickets/"


@pytest.fixture(scope="module")
def seeded(django_db_setup, django_db_blocker):
    with django_db_blocker.unblock(), transaction.atomic():
        call_command("seed_demo", stdout=io.StringIO(), stderr=io.StringIO())
        yield
        # Rolled back at teardown rather than committed. Without this the seeded
        # departments and branches outlive the module and every later test file
        # that creates its own `billing` department collides on the unique code —
        # a failure that depends on file ordering and is miserable to diagnose.
        transaction.set_rollback(True)


@pytest.fixture
def users(seeded, django_db_blocker):
    with django_db_blocker.unblock():
        yield {
            "admin": User.objects.get(username="admin@demo"),
            "manager": User.objects.get(username="manager@demo"),
            "agent": User.objects.get(username="agent@demo"),
            "customer": User.objects.get(username="customer@demo"),
        }


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def all_ids(client, url=TICKETS_URL):
    """Every id across every page, so counts are not truncated by pagination."""
    ids, page = [], 1
    while True:
        response = client.get(url, {"page": page, "page_size": 100})
        assert response.status_code == 200, response.data
        ids += [row["id"] for row in response.data["results"]]
        if not response.data.get("next"):
            return ids
        page += 1


@pytest.mark.django_db
def test_anonymous_gets_401(seeded):
    assert APIClient().get(TICKETS_URL).status_code == 401


@pytest.mark.django_db
def test_customer_gets_403_on_agent_routes(users, django_db_blocker):
    """These are agent routes. The customer portal is story 05, and until then a
    customer must be refused rather than shown an empty list — an empty list
    reads as "you have no tickets", which is a different and false statement.
    """
    with django_db_blocker.unblock():
        client = client_for(users["customer"])
        for url in (TICKETS_URL, "/api/v1/customers/", "/api/v1/categories/"):
            assert client.get(url).status_code == 403, url


@pytest.mark.django_db
def test_admin_sees_every_ticket(users, django_db_blocker):
    with django_db_blocker.unblock():
        assert len(all_ids(client_for(users["admin"]))) == Ticket.objects.count()


@pytest.mark.django_db
def test_manager_sees_only_their_department(users, django_db_blocker):
    with django_db_blocker.unblock():
        manager = users["manager"]
        ids = all_ids(client_for(manager))
        assert 0 < len(ids) < Ticket.objects.count()
        assert set(
            Ticket.objects.filter(id__in=ids).values_list("department_id", flat=True)
        ) == {manager.department_id}


@pytest.mark.django_db
def test_agent_sees_department_plus_assigned_and_watched(users, django_db_blocker):
    with django_db_blocker.unblock():
        agent = users["agent"]
        ids = all_ids(client_for(agent))

        expected = (
            set(Ticket.objects.filter(department=agent.department).values_list("id", flat=True))
            | set(Ticket.objects.filter(assignee=agent).values_list("id", flat=True))
            | set(Ticket.objects.filter(watchers=agent).values_list("id", flat=True))
        )
        assert set(ids) == expected


@pytest.mark.django_db
def test_agent_queue_has_no_duplicate_rows(users, django_db_blocker):
    """Joining watchers (M2M) duplicates a row per watcher without .distinct().
    Over HTTP this would also corrupt the pagination count.
    """
    with django_db_blocker.unblock():
        ids = all_ids(client_for(users["agent"]))
        assert len(ids) == len(set(ids))


@pytest.mark.django_db
def test_out_of_scope_detail_is_404_not_403(users, django_db_blocker):
    """A 403 would confirm the record exists, which is itself a disclosure. The
    object was never in the queryset, so 404 is both safer and more truthful.
    """
    with django_db_blocker.unblock():
        agent = users["agent"]
        visible = set(all_ids(client_for(agent)))
        hidden = Ticket.objects.exclude(id__in=visible).first()
        assert hidden is not None, "fixture is broken: agent can see every ticket"

        response = client_for(agent).get(f"{TICKETS_URL}{hidden.pk}/")
        assert response.status_code == 404


@pytest.mark.django_db
def test_out_of_scope_write_actions_are_also_404(users, django_db_blocker):
    """Scoping in get_queryset() covers every detail route, not just retrieve —
    that is the whole reason it is not done in a list handler.
    """
    with django_db_blocker.unblock():
        agent = users["agent"]
        visible = set(all_ids(client_for(agent)))
        hidden = Ticket.objects.exclude(id__in=visible).first()
        client = client_for(agent)

        for method, url, payload in (
            ("patch", f"{TICKETS_URL}{hidden.pk}/", {"priority": "urgent"}),
            ("post", f"{TICKETS_URL}{hidden.pk}/status/", {"status": "open"}),
            ("post", f"{TICKETS_URL}{hidden.pk}/assign/", {}),
            ("post", f"{TICKETS_URL}{hidden.pk}/escalate/", {}),
            ("get", f"{TICKETS_URL}{hidden.pk}/messages/", None),
            ("get", f"{TICKETS_URL}{hidden.pk}/events/", None),
        ):
            call = getattr(client, method)
            response = call(url, payload, format="json") if payload is not None else call(url)
            assert response.status_code == 404, f"{method.upper()} {url}"


@pytest.mark.django_db
def test_customers_are_scoped_by_branch_for_agents(users, django_db_blocker):
    with django_db_blocker.unblock():
        agent = users["agent"]
        response = client_for(agent).get("/api/v1/customers/", {"page_size": 100})
        assert response.status_code == 200
        from apps.customers.models import Customer

        ids = [row["id"] for row in response.data["results"]]
        assert set(Customer.objects.filter(id__in=ids).values_list("branch_id", flat=True)) == {
            agent.branch_id
        }


@pytest.mark.django_db
def test_filters_return_real_rows_against_seeded_data(users, django_db_blocker):
    with django_db_blocker.unblock():
        client = client_for(users["admin"])
        assert client.get(TICKETS_URL, {"breached": "true"}).data["count"] >= 3
        assert client.get(TICKETS_URL, {"status": "escalated"}).data["count"] >= 2
        assert client.get(TICKETS_URL, {"escalated": "true"}).data["count"] >= 2
        # q matches subject, number and customer name.
        assert client.get(TICKETS_URL, {"q": "TK-00"}).data["count"] > 0
        assert client.get(TICKETS_URL, {"q": "invoice"}).data["count"] > 0
        assert client.get(TICKETS_URL, {"q": "Najd"}).data["count"] > 0
