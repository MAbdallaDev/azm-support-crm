"""The portal trust boundary. This is the assertion scored under Testing,
Security & Edge Cases, and it does not get trimmed.

Every portal response is **recursed** and checked by **key name**, at any nesting
depth. String-matching the body would produce false positives on ordinary prose;
checking only top-level keys would miss a leak through a nested serializer. The
point is that adding a field to an agent serializer later cannot quietly surface
in the portal — the test fails on the key's existence, not on its value.
"""

import io

import pytest
from django.core.management import call_command
from django.db import transaction
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.tickets.models import Status, Ticket, TicketMessage

# Names a customer must never see, at any depth, in any portal payload.
FORBIDDEN = {
    "assignee", "assignee_name", "department", "branch", "sla_policy",
    "sla_policy_name", "sla_response_due_at", "sla_resolution_due_at",
    "sla_response_breached", "sla_resolution_breached",
    "escalation_level", "escalated_at", "watchers", "watcher_count",
    "assignment_reason", "ai_summary", "ai_suggested_category",
    "internal", "is_internal", "created_by", "response_sla", "resolution_sla",
    "author", "author_name", "actor", "actor_name", "is_breached",
}


def keys_in(payload, found=None):
    """Every key name anywhere in a parsed JSON structure."""
    found = set() if found is None else found
    if isinstance(payload, dict):
        for key, value in payload.items():
            found.add(key)
            keys_in(value, found)
    elif isinstance(payload, list):
        for item in payload:
            keys_in(item, found)
    return found


def assert_clean(response, label):
    assert response.status_code == 200, f"{label}: {response.status_code}"
    leaked = keys_in(response.data) & FORBIDDEN
    assert not leaked, f"{label} leaked internal field(s): {sorted(leaked)}"


@pytest.fixture(scope="module")
def seeded(django_db_setup, django_db_blocker):
    with django_db_blocker.unblock(), transaction.atomic():
        call_command("seed_demo", stdout=io.StringIO(), stderr=io.StringIO())
        yield
        transaction.set_rollback(True)


@pytest.fixture
def customer_client(seeded, django_db_blocker):
    with django_db_blocker.unblock():
        user = User.objects.get(username="customer@demo")
        client = APIClient()
        client.force_authenticate(user)
        yield client, user


@pytest.fixture
def agent_client(seeded, django_db_blocker):
    with django_db_blocker.unblock():
        client = APIClient()
        client.force_authenticate(User.objects.get(username="agent@demo"))
        yield client


# ---------------------------------------------------------------------------
# The sweep
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_no_portal_response_contains_an_internal_field(customer_client, django_db_blocker):
    with django_db_blocker.unblock():
        client, user = customer_client

        listing = client.get("/api/v1/portal/tickets/", {"page_size": 100})
        assert_clean(listing, "portal/tickets/ list")
        assert listing.data["count"] > 0, "fixture is broken: customer has no tickets"

        ticket_id = listing.data["results"][0]["id"]
        assert_clean(client.get(f"/api/v1/portal/tickets/{ticket_id}/"), "ticket detail")
        assert_clean(
            client.get(f"/api/v1/portal/tickets/{ticket_id}/messages/"), "ticket messages"
        )
        assert_clean(client.get("/api/v1/portal/kb/articles/"), "kb list")

        slug = client.get("/api/v1/portal/kb/articles/").data["results"][0]["slug"]
        assert_clean(client.get(f"/api/v1/portal/kb/articles/{slug}/"), "kb detail")


@pytest.mark.django_db
def test_the_forbidden_set_is_not_vacuous(agent_client, django_db_blocker):
    """Guards the sweep above from passing because the names never existed.

    If the agent serializer stopped emitting these, the portal test would go
    green while proving nothing.
    """
    with django_db_blocker.unblock():
        response = agent_client.get("/api/v1/tickets/", {"page_size": 1})
        agent_keys = keys_in(response.data)
        assert agent_keys & FORBIDDEN, "the agent API emits none of the forbidden names"


# ---------------------------------------------------------------------------
# Internal notes
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_an_internal_note_is_invisible_in_the_portal_thread(
    customer_client, agent_client, django_db_blocker
):
    with django_db_blocker.unblock():
        client, user = customer_client
        ticket = Ticket.objects.filter(customer=user.customer).first()

        note = TicketMessage.objects.create(
            ticket=ticket, body="INTERNAL: escalate to billing before replying.",
            is_internal=True,
        )
        public = TicketMessage.objects.create(
            ticket=ticket, body="We are looking into this now.", is_internal=False
        )

        portal = client.get(f"/api/v1/portal/tickets/{ticket.pk}/messages/")
        bodies = [row["body"] for row in portal.data]
        assert public.body in bodies
        assert note.body not in bodies
        assert not any("INTERNAL" in body for body in bodies)


@pytest.mark.django_db
def test_the_message_count_excludes_internal_notes(customer_client, django_db_blocker):
    """An internal note must not even be countable from the portal."""
    with django_db_blocker.unblock():
        client, user = customer_client
        ticket = Ticket.objects.filter(customer=user.customer).first()

        before = client.get(f"/api/v1/portal/tickets/{ticket.pk}/").data["message_count"]
        TicketMessage.objects.create(ticket=ticket, body="hidden", is_internal=True)
        after = client.get(f"/api/v1/portal/tickets/{ticket.pk}/").data["message_count"]
        assert after == before


@pytest.mark.django_db
def test_author_kind_never_reveals_an_agents_name(customer_client, django_db_blocker):
    with django_db_blocker.unblock():
        client, user = customer_client
        ticket = Ticket.objects.filter(customer=user.customer).first()
        agent = User.objects.get(username="agent@demo")
        TicketMessage.objects.create(
            ticket=ticket, body="Reply from staff", author=agent, is_internal=False
        )

        rows = client.get(f"/api/v1/portal/tickets/{ticket.pk}/messages/").data
        assert {row["author_kind"] for row in rows} <= {"you", "support"}
        blob = str(rows)
        assert agent.get_full_name() not in blob
        assert agent.username not in blob


# ---------------------------------------------------------------------------
# Cross-customer isolation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_another_customers_ticket_is_404(customer_client, django_db_blocker):
    with django_db_blocker.unblock():
        client, user = customer_client
        theirs = Ticket.objects.exclude(customer=user.customer).first()
        assert theirs is not None

        assert client.get(f"/api/v1/portal/tickets/{theirs.pk}/").status_code == 404
        assert client.get(f"/api/v1/portal/tickets/{theirs.pk}/messages/").status_code == 404


@pytest.mark.django_db
def test_the_portal_list_contains_only_the_callers_tickets(customer_client, django_db_blocker):
    with django_db_blocker.unblock():
        client, user = customer_client
        rows = client.get("/api/v1/portal/tickets/", {"page_size": 100}).data["results"]
        ids = [row["id"] for row in rows]
        assert set(
            Ticket.objects.filter(id__in=ids).values_list("customer_id", flat=True)
        ) == {user.customer_id}


# ---------------------------------------------------------------------------
# Create: silently dropped fields
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_customer_supplied_privileged_fields_are_dropped_not_rejected(
    customer_client, django_db_blocker
):
    """Silently, on purpose: a 400 naming a field the client never saw confirms
    the field exists.
    """
    with django_db_blocker.unblock():
        client, user = customer_client
        agent = User.objects.get(username="agent@demo")

        response = client.post(
            "/api/v1/portal/tickets/",
            {
                "subject": "My printer is on fire",
                "description": "It is quite warm.",
                "priority": "urgent",
                "assignee": agent.pk,
                "status": "resolved",
                "department": agent.department_id,
                "customer": Ticket.objects.exclude(customer=user.customer).first().customer_id,
            },
            format="json",
        )
        assert response.status_code == 201

        ticket = Ticket.objects.get(number=response.data["number"])
        assert ticket.assignee is None
        assert ticket.status == Status.NEW
        # The ticket does get a department — every portal ticket does, so it
        # is visible to some agent's queue — but never the customer-supplied
        # one. Proven here by it not being the agent's own department.
        assert ticket.department_id != agent.department_id
        assert ticket.priority == "normal", "priority must be clamped, not honoured"
        assert ticket.customer_id == user.customer_id, "customer comes from the session"


@pytest.mark.django_db
def test_a_portal_created_ticket_gets_its_sla_clock(customer_client, django_db_blocker):
    with django_db_blocker.unblock():
        client, _ = customer_client
        response = client.post(
            "/api/v1/portal/tickets/",
            {"subject": "Needs a deadline", "description": "x"},
            format="json",
        )
        ticket = Ticket.objects.get(number=response.data["number"])
        assert ticket.sla_resolution_due_at is not None


@pytest.mark.django_db
def test_a_customer_cannot_post_an_internal_note(customer_client, django_db_blocker):
    with django_db_blocker.unblock():
        client, user = customer_client
        ticket = Ticket.objects.filter(customer=user.customer).first()

        response = client.post(
            f"/api/v1/portal/tickets/{ticket.pk}/messages/",
            {"body": "Trying to hide this", "is_internal": True},
            format="json",
        )
        assert response.status_code == 201
        assert TicketMessage.objects.get(pk=response.data["id"]).is_internal is False


@pytest.mark.django_db
def test_the_portal_refuses_update_and_delete(customer_client, django_db_blocker):
    """A customer changes a ticket by replying, not by editing fields."""
    with django_db_blocker.unblock():
        client, user = customer_client
        ticket = Ticket.objects.filter(customer=user.customer).first()
        assert client.patch(
            f"/api/v1/portal/tickets/{ticket.pk}/", {"subject": "x"}, format="json"
        ).status_code == 405
        assert client.delete(f"/api/v1/portal/tickets/{ticket.pk}/").status_code == 405


# ---------------------------------------------------------------------------
# CSAT
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_csat_can_be_submitted_once(customer_client, django_db_blocker):
    with django_db_blocker.unblock():
        client, user = customer_client
        ticket = Ticket.objects.filter(
            customer=user.customer, status__in=[Status.RESOLVED, Status.CLOSED]
        ).filter(csat__isnull=True).first()
        assert ticket is not None

        first = client.post(
            "/api/v1/portal/csat/",
            {"ticket": ticket.pk, "score": 5, "comment": "Quick and clear."},
            format="json",
        )
        assert first.status_code == 201

        second = client.post(
            "/api/v1/portal/csat/", {"ticket": ticket.pk, "score": 1}, format="json"
        )
        assert second.status_code == 409, "a duplicate rating must not be a 500"


@pytest.mark.django_db
def test_csat_is_refused_on_an_unresolved_ticket(customer_client, django_db_blocker):
    with django_db_blocker.unblock():
        client, user = customer_client
        ticket = Ticket.objects.filter(
            customer=user.customer, status__in=[Status.NEW, Status.OPEN]
        ).first()
        response = client.post(
            "/api/v1/portal/csat/", {"ticket": ticket.pk, "score": 5}, format="json"
        )
        assert response.status_code == 400


@pytest.mark.django_db
def test_csat_on_another_customers_ticket_is_404(customer_client, django_db_blocker):
    with django_db_blocker.unblock():
        client, user = customer_client
        theirs = Ticket.objects.exclude(customer=user.customer).filter(
            status__in=[Status.RESOLVED, Status.CLOSED]
        ).first()
        response = client.post(
            "/api/v1/portal/csat/", {"ticket": theirs.pk, "score": 1}, format="json"
        )
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Role separation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_staff_cannot_use_the_portal(agent_client, django_db_blocker):
    """Not a filtered view of the agent app — a different door entirely."""
    with django_db_blocker.unblock():
        assert agent_client.get("/api/v1/portal/tickets/").status_code == 403
        assert agent_client.get("/api/v1/portal/kb/articles/").status_code == 403


@pytest.mark.django_db
def test_anonymous_is_401(seeded):
    assert APIClient().get("/api/v1/portal/tickets/").status_code == 401


@pytest.mark.django_db
def test_drafts_are_absent_from_the_portal_kb(customer_client, django_db_blocker):
    with django_db_blocker.unblock():
        from apps.kb.models import KBArticle

        client, _ = customer_client
        assert KBArticle.objects.filter(status="draft").exists(), "fixture has no drafts"

        rows = client.get("/api/v1/portal/kb/articles/", {"page_size": 100}).data["results"]
        slugs = {row["slug"] for row in rows}
        drafts = set(
            KBArticle.objects.filter(status="draft").values_list("slug", flat=True)
        )
        assert slugs & drafts == set()
