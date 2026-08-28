"""The five ticket-app additions story 07's frontend could not be built without.

Each exists because a criterion in the story cannot be met from the API as
story 05 froze it. They are small, and they are tested here so a reviewer can
see the whole of the backend growth a frontend story caused, in one file.

  1. `allowed_transitions` on the detail serializer — so the status dropdown
     reads the state machine instead of transcribing it.
  2. `resolution_sla` on the list serializer — so a queue row and the detail
     pane derive their countdown from the same call.
  3. `due_within_minutes` — "breaching within the hour", which `breached=true`
     (already breached) cannot express.
  4. `resolved_after` / `resolved_before` — "resolved by me today".
  5. `department_code` — because `MeSerializer.department` is a code string,
     so the client holds no primary key to filter with.
"""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Department, User
from apps.customers.models import Customer
from apps.tickets.models import SLAPolicy, Status, Ticket
from apps.tickets.services import ticket_service


@pytest.fixture
def billing(db):
    return Department.objects.create(name_en="Billing", name_ar="الفوترة", code="billing")


@pytest.fixture
def technical(db):
    return Department.objects.create(name_en="Technical", name_ar="التقني", code="technical")


@pytest.fixture
def agent(billing):
    return User.objects.create_user(
        username="s7-agent", password="x", role=User.Role.AGENT, department=billing
    )


@pytest.fixture
def admin(db):
    """Admin, so scoping never hides a row a filter assertion is counting."""
    return User.objects.create_user(username="s7-admin", password="x", role=User.Role.ADMIN)


@pytest.fixture
def api(admin):
    client = APIClient()
    client.force_authenticate(admin)
    return client


@pytest.fixture
def customer(db):
    return Customer.objects.create(name="Omari Contracting", email="k@omari.test")


def make_ticket(customer, **kwargs):
    return Ticket.objects.create(customer=customer, subject="Subject", **kwargs)


# ---------------------------------------------------------------------------
# 1 — allowed_transitions
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_new_ticket_offers_exactly_open_and_escalated(api, customer):
    ticket = make_ticket(customer, status=Status.NEW)

    response = api.get(f"/api/v1/tickets/{ticket.pk}/")

    assert response.status_code == 200
    assert response.data["allowed_transitions"] == ["escalated", "open"]


@pytest.mark.django_db
def test_allowed_transitions_tracks_the_service_map_for_every_status(api, customer):
    """The field cannot silently diverge from `ALLOWED_TRANSITIONS`.

    Asserting against the map itself rather than eight hard-coded lists is the
    point: a change to the state machine updates both sides at once, and a
    change to the *serializer* alone fails here.
    """
    for status_value, expected in ticket_service.ALLOWED_TRANSITIONS.items():
        ticket = make_ticket(customer, status=status_value)

        response = api.get(f"/api/v1/tickets/{ticket.pk}/")

        assert response.data["allowed_transitions"] == sorted(expected), status_value


@pytest.mark.django_db
def test_a_transition_the_field_omits_is_actually_refused(api, customer):
    """Guards against the field being right and the API disagreeing anyway.

    Without this, `allowed_transitions` could return a plausible-looking list
    that the transition endpoint does not honour, and the dropdown would offer
    a move that 400s.
    """
    ticket = make_ticket(customer, status=Status.NEW)
    offered = api.get(f"/api/v1/tickets/{ticket.pk}/").data["allowed_transitions"]
    assert Status.CLOSED not in offered

    response = api.post(
        f"/api/v1/tickets/{ticket.pk}/status/", {"status": Status.CLOSED}, format="json"
    )

    assert response.status_code == 400
    # The message names both states, which is what the client surfaces.
    assert "new" in str(response.data["status"]) and "closed" in str(response.data["status"])


# ---------------------------------------------------------------------------
# 2 — resolution_sla on the queue row
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_queue_rows_carry_the_same_sla_shape_the_detail_pane_uses(api, customer):
    policy = SLAPolicy.objects.create(
        name="Test-P2", priority="normal", first_response_minutes=30,
        resolution_minutes=480, escalate_at_percent=90,
    )
    ticket = make_ticket(customer)
    ticket.sla_policy = policy
    ticket.sla_response_due_at = timezone.now() + timedelta(minutes=25)
    ticket.sla_resolution_due_at = timezone.now() + timedelta(hours=4)
    ticket.save()

    row = next(
        r for r in api.get("/api/v1/tickets/").data["results"] if r["id"] == ticket.pk
    )
    detail = api.get(f"/api/v1/tickets/{ticket.pk}/").data

    # The four keys SlaBar consumes, and the same values on both routes — this
    # is what lets one component render a queue row and a detail pane.
    assert set(row["resolution_sla"]) == {
        "state", "seconds_remaining", "target_minutes", "policy_name",
    }
    assert row["resolution_sla"]["state"] == detail["resolution_sla"]["state"]
    assert row["resolution_sla"]["target_minutes"] == 480
    assert row["resolution_sla"]["policy_name"] == "Test-P2"


@pytest.mark.django_db
def test_a_breached_row_reports_negative_seconds(api, customer):
    """The sign is the contract — it is what renders "Breached 14m"."""
    ticket = make_ticket(customer)
    ticket.sla_resolution_due_at = timezone.now() - timedelta(minutes=14)
    ticket.save()

    row = next(
        r for r in api.get("/api/v1/tickets/").data["results"] if r["id"] == ticket.pk
    )

    assert row["resolution_sla"]["state"] == "breached"
    assert row["resolution_sla"]["seconds_remaining"] < 0


# ---------------------------------------------------------------------------
# 3 — due_within_minutes
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_due_within_minutes_selects_only_the_about_to_breach(api, customer):
    now = timezone.now()

    soon = make_ticket(customer, status=Status.OPEN)
    soon.sla_resolution_due_at = now + timedelta(minutes=30)
    soon.save()

    later = make_ticket(customer, status=Status.OPEN)
    later.sla_resolution_due_at = now + timedelta(hours=5)
    later.save()

    already = make_ticket(customer, status=Status.OPEN)
    already.sla_resolution_due_at = now - timedelta(minutes=10)
    already.save()

    ids = {
        r["id"] for r in api.get("/api/v1/tickets/", {"due_within_minutes": 60}).data["results"]
    }

    assert soon.pk in ids
    assert later.pk not in ids
    # Already past the deadline belongs to `breached`, not here. Counting it in
    # both would double-report one ticket across two dashboard tiles.
    assert already.pk not in ids


@pytest.mark.django_db
def test_due_within_minutes_excludes_resolved_work(api, customer):
    """Otherwise the "breaching soon" tile fills with finished tickets."""
    now = timezone.now()
    resolved = make_ticket(customer, status=Status.RESOLVED)
    resolved.sla_resolution_due_at = now + timedelta(minutes=20)
    resolved.resolved_at = now
    resolved.save()

    ids = {
        r["id"] for r in api.get("/api/v1/tickets/", {"due_within_minutes": 60}).data["results"]
    }

    assert resolved.pk not in ids


# ---------------------------------------------------------------------------
# 4 — resolved_after / resolved_before
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_resolved_range_filters_mirror_the_created_pair(api, customer):
    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    today = make_ticket(customer, status=Status.RESOLVED)
    today.resolved_at = now - timedelta(minutes=5)
    today.save()

    yesterday = make_ticket(customer, status=Status.RESOLVED)
    yesterday.resolved_at = today_start - timedelta(hours=3)
    yesterday.save()

    never = make_ticket(customer, status=Status.OPEN)

    ids = {
        r["id"]
        for r in api.get(
            "/api/v1/tickets/", {"resolved_after": today_start.isoformat()}
        ).data["results"]
    }

    assert ids == {today.pk}
    assert yesterday.pk not in ids
    # An unresolved ticket has a null resolved_at and must not slip through a
    # range filter — the tile counts finished work.
    assert never.pk not in ids


# ---------------------------------------------------------------------------
# 5 — department_code
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_department_code_filters_by_code_not_primary_key(api, customer, billing, technical):
    mine = make_ticket(customer, department=billing)
    theirs = make_ticket(customer, department=technical)

    ids = {
        r["id"]
        for r in api.get("/api/v1/tickets/", {"department_code": "billing"}).data["results"]
    }

    assert ids == {mine.pk}
    assert theirs.pk not in ids


@pytest.mark.django_db
def test_the_primary_key_department_filter_still_works(api, customer, billing, technical):
    """Added alongside, not instead — story 04's tests use the pk form."""
    mine = make_ticket(customer, department=billing)
    make_ticket(customer, department=technical)

    ids = {
        r["id"]
        for r in api.get("/api/v1/tickets/", {"department": billing.pk}).data["results"]
    }

    assert ids == {mine.pk}
