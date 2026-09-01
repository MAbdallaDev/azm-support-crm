"""`q` also matches message body text, not just subject/number/customer.

Added alongside the header search dropdown, which reuses this same filter —
a query like an Arabic word from a reply's body previously came back empty
even though the ticket genuinely contained it.
"""

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.customers.models import Customer
from apps.tickets.models import Ticket, TicketMessage


@pytest.fixture
def admin(db):
    return User.objects.create_user(username="msgsearch-admin", password="x", role=User.Role.ADMIN)


@pytest.fixture
def api(admin):
    client = APIClient()
    client.force_authenticate(admin)
    return client


@pytest.fixture
def customer(db):
    return Customer.objects.create(name="Omari Contracting", email="k@omari.test")


def search(api, value):
    return {r["id"] for r in api.get("/api/v1/tickets/", {"q": value}).data["results"]}


def search_rows(api, value):
    return api.get("/api/v1/tickets/", {"q": value}).data["results"]


@pytest.mark.django_db
def test_q_matches_a_word_that_only_appears_in_a_message_body(api, customer):
    match = Ticket.objects.create(customer=customer, subject="Unrelated subject")
    TicketMessage.objects.create(ticket=match, body="تم تنفيذ التعديل على حسابك.")
    other = Ticket.objects.create(customer=customer, subject="Also unrelated")
    TicketMessage.objects.create(ticket=other, body="Nothing matching here.")

    assert search(api, "تنفيذ") == {match.pk}


@pytest.mark.django_db
def test_a_ticket_with_two_matching_messages_is_not_duplicated(api, customer):
    ticket = Ticket.objects.create(customer=customer, subject="Unrelated subject")
    TicketMessage.objects.create(ticket=ticket, body="invoice attached")
    TicketMessage.objects.create(ticket=ticket, body="invoice re-sent")

    results = api.get("/api/v1/tickets/", {"q": "invoice"}).data["results"]

    assert [r["id"] for r in results] == [ticket.pk]


@pytest.mark.django_db
def test_message_body_search_is_additive_to_subject_and_customer_matches(api, customer):
    by_subject = Ticket.objects.create(customer=customer, subject="Invoice question")
    by_body = Ticket.objects.create(customer=customer, subject="Something else")
    TicketMessage.objects.create(ticket=by_body, body="about the invoice total")

    assert search(api, "invoice") == {by_subject.pk, by_body.pk}


# ---------------------------------------------------------------------------
# matched_snippet — why a body-only match is in the results at all
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_a_body_only_match_carries_a_snippet_of_the_matching_message(api, customer):
    ticket = Ticket.objects.create(customer=customer, subject="Unrelated subject")
    TicketMessage.objects.create(
        ticket=ticket, body="Please invoice the March usage separately from the base plan."
    )

    rows = search_rows(api, "invoice")

    assert len(rows) == 1
    assert "invoice" in rows[0]["matched_snippet"].lower()


@pytest.mark.django_db
def test_a_subject_match_carries_no_snippet(api, customer):
    """The subject already shows why it matched — no snippet needed."""
    Ticket.objects.create(customer=customer, subject="Invoice question")

    rows = search_rows(api, "invoice")

    assert rows[0]["matched_snippet"] is None


@pytest.mark.django_db
def test_a_customer_name_match_carries_no_snippet(api, customer):
    Ticket.objects.create(customer=customer, subject="Something else")

    rows = search_rows(api, "omari")

    assert rows[0]["matched_snippet"] is None


@pytest.mark.django_db
def test_matched_snippet_is_absent_without_a_search_query(api, customer):
    """The plain queue (no `q`) never carries the field's cost."""
    ticket = Ticket.objects.create(customer=customer, subject="Unrelated subject")
    TicketMessage.objects.create(ticket=ticket, body="invoice attached")

    rows = api.get("/api/v1/tickets/").data["results"]

    assert "matched_snippet" not in rows[0]
