"""`seed_demo` is what makes stories 06–09 demonstrable, so its guarantees are
pinned here rather than eyeballed in the admin.
"""

import io

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone

from apps.customers.models import Customer
from apps.kb.models import KBArticle
from apps.tickets.models import Channel, Priority, Status, Ticket

User = get_user_model()

TRACKED = {"users": User, "customers": Customer, "tickets": Ticket, "articles": KBArticle}


def seed():
    call_command("seed_demo", stdout=io.StringIO(), stderr=io.StringIO())


def counts():
    return {name: model.objects.count() for name, model in TRACKED.items()}


@pytest.fixture
def seeded(db):
    seed()


@pytest.mark.django_db
def test_running_twice_leaves_counts_unchanged():
    """Timestamps move on every run — identity must not. Every object is keyed
    on a natural key, so the second run updates rather than appends.
    """
    seed()
    first = counts()
    seed()
    assert counts() == first


@pytest.mark.django_db
def test_every_badge_value_has_data_behind_it(seeded):
    """The design treats status, priority and channel as three separate badge
    families. A queue missing a value has a badge that can never be seen.
    """
    assert set(Ticket.objects.values_list("channel", flat=True)) == set(Channel.values)
    assert set(Ticket.objects.values_list("status", flat=True)) == set(Status.values)
    assert set(Ticket.objects.values_list("priority", flat=True)) == set(Priority.values)


@pytest.mark.django_db
def test_sla_spread_is_computed_against_run_time(seeded):
    now = timezone.now()
    breached = Ticket.objects.filter(sla_resolution_due_at__lt=now).count()
    assert breached >= 3, "no breached tickets — the Breaching queue tab would be empty"

    escalated = Ticket.objects.filter(status=Status.ESCALATED)
    assert escalated.count() >= 2
    assert all(t.escalation_level >= 1 and t.escalated_at for t in escalated)


@pytest.mark.django_db
def test_some_tickets_are_close_to_breach(seeded):
    now = timezone.now()
    near = [
        ticket
        for ticket in Ticket.objects.filter(
            sla_resolution_due_at__gt=now, sla_policy__isnull=False
        ).select_related("sla_policy")
        if (ticket.sla_resolution_due_at - now).total_seconds()
        < 0.10 * ticket.sla_policy.resolution_minutes * 60
    ]
    assert len(near) >= 3, "nothing within 10% of breach — the SLA bar never shows amber"


@pytest.mark.django_db
def test_knowledge_base_is_bilingual_but_not_uniformly_so(seeded):
    assert KBArticle.objects.exclude(body_ar="").count() >= 1
    assert KBArticle.objects.filter(body_ar="").count() >= 1, (
        "every article is fully translated — story 08's completeness indicator "
        "has no case to show"
    )
    assert KBArticle.objects.count() >= 8
    assert KBArticle.objects.values("category").distinct().count() >= 3


@pytest.mark.django_db
def test_four_role_logins_exist_and_the_password_works(seeded):
    from apps.tickets.demo_content import DEMO_PASSWORD

    for username, role in [
        ("admin@demo", "admin"),
        ("manager@demo", "manager"),
        ("agent@demo", "agent"),
        ("customer@demo", "customer"),
    ]:
        user = User.objects.get(username=username)
        assert user.role == role
        assert user.check_password(DEMO_PASSWORD)

    assert User.objects.get(username="customer@demo").customer is not None
    assert User.objects.filter(role="agent").count() >= 5


@pytest.mark.django_db
def test_customers_span_every_tier_with_contacts_and_notes(seeded):
    assert Customer.objects.count() >= 8
    assert set(Customer.objects.values_list("tier", flat=True)) == {
        "standard", "premium", "enterprise",
    }
    assert all(c.contacts.filter(is_primary=True).exists() for c in Customer.objects.all())
    assert all(c.notes.exists() for c in Customer.objects.all())


@pytest.mark.django_db
def test_threads_mix_public_replies_and_internal_notes(seeded):
    from apps.tickets.models import TicketEvent, TicketMessage

    assert TicketMessage.objects.filter(is_internal=True).exists()
    assert TicketMessage.objects.filter(is_internal=False).exists()
    assert TicketEvent.objects.filter(event_type="created").count() == Ticket.objects.count()
    assert not Ticket.objects.filter(messages__isnull=True).exists()


@pytest.mark.django_db
def test_unassigned_queue_tab_has_rows(seeded):
    assert Ticket.objects.filter(assignee__isnull=True).count() >= 10


@pytest.mark.django_db
def test_flush_clears_and_reseeds(seeded, settings):
    # pytest-django runs with DEBUG=False; --flush deliberately refuses that, so
    # the test opts back in explicitly rather than the guard being weakened.
    settings.DEBUG = True
    before = counts()
    call_command("seed_demo", "--flush", stdout=io.StringIO(), stderr=io.StringIO())
    assert counts() == before


@pytest.mark.django_db
def test_flush_refuses_when_debug_is_off(seeded, settings):
    from django.core.management.base import CommandError

    settings.DEBUG = False
    with pytest.raises(CommandError, match="DEBUG=False"):
        call_command("seed_demo", "--flush", stdout=io.StringIO(), stderr=io.StringIO())
    assert Ticket.objects.count() == 150
