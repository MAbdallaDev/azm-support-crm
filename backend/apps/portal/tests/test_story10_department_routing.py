"""Story 10's demo-script rehearsal found a portal ticket that no agent could
ever see: `scope_tickets` matches an agent's queue on department, assignee or
watcher, and a portal-submitted ticket had none of the three. This is the
regression test for the fix — every portal ticket lands in *some* agent's
queue, not nobody's.
"""

import io

import pytest
from django.core.management import call_command
from django.db import transaction
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.accounts.scoping import scope_tickets
from apps.tickets.models import Ticket


@pytest.fixture(scope="module")
def seeded(django_db_setup, django_db_blocker):
    with django_db_blocker.unblock(), transaction.atomic():
        call_command("seed_demo", stdout=io.StringIO(), stderr=io.StringIO())
        yield
        transaction.set_rollback(True)


@pytest.mark.django_db
def test_a_portal_ticket_is_visible_to_at_least_one_agent(seeded, django_db_blocker):
    with django_db_blocker.unblock():
        customer_user = User.objects.get(username="customer@demo")
        client = APIClient()
        client.force_authenticate(customer_user)

        response = client.post(
            "/api/v1/portal/tickets/",
            {"subject": "Nobody can see this, right?", "description": "x"},
            format="json",
        )
        assert response.status_code == 201
        ticket = Ticket.objects.get(number=response.data["number"])

        assert ticket.department_id is not None, (
            "a ticket with no department matches no agent's or manager's "
            "scope_tickets filter — it would be visible to an admin only"
        )

        visible_to_someone = any(
            scope_tickets(Ticket.objects.filter(pk=ticket.pk), agent).exists()
            for agent in User.objects.filter(role__in=[User.Role.AGENT, User.Role.MANAGER])
        )
        assert visible_to_someone, "the new ticket must appear in at least one non-admin queue"
