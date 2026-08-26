"""The record layer — record rules, in Odoo terms. The heart of this story.

Seeded against `seed_demo` rather than hand-built fixtures on purpose: the
cross-customer isolation assertion needs two real customers with separate portal
logins, and the agent duplicate-row assertion needs tickets that genuinely have
watchers. Both exist in the demo data already.
"""

import io

import pytest
from django.core.management import call_command
from django.db import transaction

from apps.accounts.models import User
from apps.accounts.scoping import (
    scope_customers,
    scope_kb_articles,
    scope_tickets,
    scope_ticket_messages,
)
from apps.customers.models import Customer
from apps.kb.models import KBArticle
from apps.tickets.models import Ticket, TicketMessage


@pytest.fixture(scope="module")
def seeded(django_db_setup, django_db_blocker):
    """Seeded once for the module — seed_demo takes several seconds and every
    test here reads the same immutable dataset.
    """
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


@pytest.fixture
def all_tickets(seeded, django_db_blocker):
    with django_db_blocker.unblock():
        yield Ticket.objects.all()


# ---------------------------------------------------------------------------
# Tickets
# ---------------------------------------------------------------------------


def test_admin_sees_every_ticket(users, all_tickets, django_db_blocker):
    with django_db_blocker.unblock():
        assert scope_tickets(all_tickets, users["admin"]).count() == Ticket.objects.count()


def test_manager_sees_only_their_department(users, all_tickets, django_db_blocker):
    with django_db_blocker.unblock():
        manager = users["manager"]
        scoped = scope_tickets(all_tickets, manager)
        assert scoped.count() > 0
        assert scoped.count() < Ticket.objects.count()
        assert set(scoped.values_list("department_id", flat=True)) == {manager.department_id}


def test_agent_sees_department_plus_assigned_and_watched(users, all_tickets, django_db_blocker):
    with django_db_blocker.unblock():
        agent = users["agent"]
        scoped = scope_tickets(all_tickets, agent)

        expected = set(
            Ticket.objects.filter(department=agent.department).values_list("id", flat=True)
        ) | set(
            Ticket.objects.filter(assignee=agent).values_list("id", flat=True)
        ) | set(
            Ticket.objects.filter(watchers=agent).values_list("id", flat=True)
        )
        assert set(scoped.values_list("id", flat=True)) == expected
        assert scoped.count() < Ticket.objects.count()


def test_agent_scope_returns_no_duplicate_rows(users, all_tickets, django_db_blocker):
    """Joining watchers (M2M) duplicates a row per watcher without .distinct().
    A ticket appearing twice in the queue is a bug story 07 would have to chase.
    """
    with django_db_blocker.unblock():
        ids = list(scope_tickets(all_tickets, users["agent"]).values_list("id", flat=True))
        assert len(ids) == len(set(ids))


def test_customer_sees_only_their_own_customers_tickets(users, all_tickets, django_db_blocker):
    with django_db_blocker.unblock():
        customer_user = users["customer"]
        scoped = scope_tickets(all_tickets, customer_user)
        assert scoped.count() > 0
        assert set(scoped.values_list("customer_id", flat=True)) == {customer_user.customer_id}


def test_cross_customer_isolation(users, all_tickets, django_db_blocker):
    """`customer@demo` must see zero tickets belonging to any other customer.

    seed_demo gives every customer its own `portal-<domain>@demo` login, so this
    is a real two-tenant check rather than a self-consistency one.
    """
    with django_db_blocker.unblock():
        customer_user = users["customer"]
        scoped_ids = set(scope_tickets(all_tickets, customer_user).values_list("id", flat=True))

        other_ids = set(
            Ticket.objects.exclude(customer_id=customer_user.customer_id).values_list(
                "id", flat=True
            )
        )
        assert other_ids, "fixture is broken: no other customers' tickets exist"
        assert scoped_ids & other_ids == set()

        # And from the other side: another customer's portal user sees none of
        # customer@demo's tickets either.
        other_portal = (
            User.objects.filter(role=User.Role.CUSTOMER, customer__isnull=False)
            .exclude(pk=customer_user.pk)
            .exclude(customer_id=customer_user.customer_id)
            .first()
        )
        assert other_portal is not None
        theirs = set(scope_tickets(all_tickets, other_portal).values_list("id", flat=True))
        assert theirs & scoped_ids == set()


def test_unauthenticated_and_roleless_users_see_nothing(all_tickets, django_db_blocker):
    class Anonymous:
        is_authenticated = False

    with django_db_blocker.unblock():
        assert scope_tickets(all_tickets, Anonymous()).count() == 0
        assert scope_tickets(all_tickets, None).count() == 0

        # An unsaved User already reports is_authenticated=True (it is a
        # read-only property), so this is a genuine "authenticated but no role"
        # case rather than a stub.
        roleless = User(username="nobody", role="")
        assert scope_tickets(all_tickets, roleless).count() == 0


def test_manager_without_a_department_sees_nothing(users, all_tickets, django_db_blocker):
    """Fails closed. A manager with no department is a misconfiguration, and the
    safe reading of it is "no rows", not "all rows".
    """
    with django_db_blocker.unblock():
        manager = users["manager"]
        manager.department = None
        assert scope_tickets(all_tickets, manager).count() == 0


# ---------------------------------------------------------------------------
# Messages — the internal-note trust boundary
# ---------------------------------------------------------------------------


def test_customer_never_sees_an_internal_note(users, django_db_blocker):
    """The regression the intake calls out by name.

    `TicketMessage.is_internal` is a trust boundary, not a display flag. There is
    no second check further down the stack.
    """
    with django_db_blocker.unblock():
        scoped = scope_ticket_messages(TicketMessage.objects.all(), users["customer"])
        assert scoped.count() > 0
        assert scoped.filter(is_internal=True).count() == 0


def test_agent_does_see_internal_notes_on_their_tickets(users, django_db_blocker):
    with django_db_blocker.unblock():
        scoped = scope_ticket_messages(TicketMessage.objects.all(), users["agent"])
        assert scoped.filter(is_internal=True).count() > 0


def test_internal_notes_exist_on_a_customers_own_tickets(users, django_db_blocker):
    """Guards the test above from passing vacuously.

    If the seed happened to put no internal notes on Najd Logistics tickets, the
    leak assertion would pass while proving nothing.
    """
    with django_db_blocker.unblock():
        customer_user = users["customer"]
        hidden = TicketMessage.objects.filter(
            ticket__customer_id=customer_user.customer_id, is_internal=True
        )
        assert hidden.count() > 0

        visible_ids = set(
            scope_ticket_messages(
                TicketMessage.objects.all(), customer_user
            ).values_list("id", flat=True)
        )
        assert visible_ids & set(hidden.values_list("id", flat=True)) == set()


def test_messages_on_other_customers_tickets_are_invisible(users, django_db_blocker):
    with django_db_blocker.unblock():
        customer_user = users["customer"]
        scoped = scope_ticket_messages(TicketMessage.objects.all(), customer_user)
        assert set(scoped.values_list("ticket__customer_id", flat=True)) == {
            customer_user.customer_id
        }


# ---------------------------------------------------------------------------
# Customers and KB
# ---------------------------------------------------------------------------


def test_customer_scope_matrix(users, django_db_blocker):
    with django_db_blocker.unblock():
        qs = Customer.objects.all()
        assert scope_customers(qs, users["admin"]).count() == Customer.objects.count()

        agent = users["agent"]
        scoped = scope_customers(qs, agent)
        assert set(scoped.values_list("branch_id", flat=True)) == {agent.branch_id}

        customer_user = users["customer"]
        own = scope_customers(qs, customer_user)
        assert list(own.values_list("id", flat=True)) == [customer_user.customer_id]


def test_kb_scope_hides_drafts_from_customers(users, django_db_blocker):
    with django_db_blocker.unblock():
        qs = KBArticle.objects.all()
        assert KBArticle.objects.filter(status="draft").exists(), "fixture has no drafts"
        assert scope_kb_articles(qs, users["customer"]).filter(status="draft").count() == 0
        assert scope_kb_articles(qs, users["agent"]).count() == KBArticle.objects.count()
