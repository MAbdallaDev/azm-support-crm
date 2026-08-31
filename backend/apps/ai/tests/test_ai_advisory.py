"""The AI is advisory. This test is what makes that a property rather than a claim.

Every endpoint is called against a full snapshot of the ticket row, and only the
one permitted advisory column may differ afterwards. "An agent always approves"
is a product rule from the brief; without this test it would be a comment.
"""

from datetime import timedelta

import pytest
from django.forms.models import model_to_dict
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Department, User
from apps.ai.services import get_backend
from apps.ai.services.mock import MockAIBackend
from apps.customers.models import Customer
from apps.tickets.models import Category, Status, Ticket, TicketMessage


@pytest.fixture
def department(db):
    return Department.objects.create(name_en="Support", name_ar="دعم", code="ai-support")


@pytest.fixture
def categories(db):
    return {
        "billing-invoice": Category.objects.create(
            name_en="Invoices", name_ar="فواتير", slug="billing-invoice"
        ),
        "technical-fault": Category.objects.create(
            name_en="Technical", name_ar="عطل", slug="technical-fault"
        ),
    }


@pytest.fixture
def english_customer(db):
    return Customer.objects.create(
        name="Gulf Trading", email="ops@gulf.test", preferred_language="en"
    )


@pytest.fixture
def arabic_customer(db):
    return Customer.objects.create(
        name="Najd Logistics", email="ops@najd.test", preferred_language="ar"
    )


@pytest.fixture
def agent(department):
    user = User.objects.create_user(
        username="ai-agent", password="x", role=User.Role.AGENT, department=department
    )
    client = APIClient()
    client.force_authenticate(user)
    return client


def make_ticket(customer, department, categories, subject="Invoice INV-2291 is wrong"):
    return Ticket.objects.create(
        customer=customer,
        subject=subject,
        description="The totals do not match the usage report in the portal.",
        department=department,
        category=categories["billing-invoice"],
    )


def snapshot(ticket):
    ticket.refresh_from_db()
    return model_to_dict(ticket)


# ---------------------------------------------------------------------------
# The advisory boundary
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_summarize_writes_only_ai_summary(agent, english_customer, department, categories):
    ticket = make_ticket(english_customer, department, categories)
    before = snapshot(ticket)

    response = agent.post("/api/v1/ai/summarize/", {"ticket": ticket.pk}, format="json")
    assert response.status_code == 200

    after = snapshot(ticket)
    changed = {k for k in before if before[k] != after[k]} - {"updated_at"}
    assert changed == {"ai_summary"}, f"AI touched more than its own column: {changed}"
    assert after["ai_summary"]


@pytest.mark.django_db
def test_categorize_writes_only_the_suggestion_not_the_category(
    agent, english_customer, department, categories
):
    """Applying the category would be the AI making the decision."""
    ticket = make_ticket(
        english_customer, department, categories, subject="Portal returns a 500 error"
    )
    before = snapshot(ticket)

    response = agent.post("/api/v1/ai/categorize/", {"ticket": ticket.pk}, format="json")
    assert response.status_code == 200

    after = snapshot(ticket)
    changed = {k for k in before if before[k] != after[k]} - {"updated_at"}
    assert changed == {"ai_suggested_category"}, changed
    assert after["category"] == before["category"], "the real category must not move"


@pytest.mark.django_db
def test_suggest_reply_persists_nothing_at_all(agent, english_customer, department, categories):
    ticket = make_ticket(english_customer, department, categories)
    before = snapshot(ticket)
    messages_before = TicketMessage.objects.count()

    response = agent.post(
        "/api/v1/ai/suggest-reply/", {"ticket": ticket.pk}, format="json"
    )
    assert response.status_code == 200
    assert response.data["suggested_reply"]

    after = snapshot(ticket)
    assert {k for k in before if before[k] != after[k]} - {"updated_at"} == set()
    assert TicketMessage.objects.count() == messages_before


@pytest.mark.django_db
@pytest.mark.parametrize("endpoint", ["summarize", "suggest-reply", "categorize"])
def test_no_ai_endpoint_ever_creates_a_message(
    agent, english_customer, department, categories, endpoint
):
    """The agent sends the reply, through story 04's messages endpoint."""
    ticket = make_ticket(english_customer, department, categories)
    before = TicketMessage.objects.count()
    agent.post(f"/api/v1/ai/{endpoint}/", {"ticket": ticket.pk}, format="json")
    assert TicketMessage.objects.count() == before


# ---------------------------------------------------------------------------
# Determinism and input-dependence — both, at once
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_summaries_are_stable_for_the_same_ticket(english_customer, department, categories):
    ticket = make_ticket(english_customer, department, categories)
    backend = MockAIBackend()
    assert backend.summarize(ticket) == backend.summarize(ticket)


@pytest.mark.django_db
def test_summaries_differ_between_tickets(english_customer, department, categories):
    """A constant string would make story 07's AI panel impossible to evaluate —
    broken wiring would be indistinguishable from working wiring.
    """
    first = make_ticket(english_customer, department, categories, subject="Invoice is wrong")
    second = make_ticket(
        english_customer, department, categories, subject="Portal throws a 500 error"
    )
    backend = MockAIBackend()
    assert backend.summarize(first) != backend.summarize(second)


@pytest.mark.django_db
def test_summary_names_the_real_subject_and_customer(
    english_customer, department, categories
):
    ticket = make_ticket(english_customer, department, categories)
    summary = MockAIBackend().summarize(ticket)
    assert "Gulf Trading" in summary
    assert "Invoice INV-2291 is wrong" in summary


@pytest.mark.django_db
def test_an_arabic_preferring_customer_gets_an_arabic_draft(
    agent, arabic_customer, department, categories
):
    """This is what makes the feature legible in the demo."""
    ticket = make_ticket(arabic_customer, department, categories)
    response = agent.post(
        "/api/v1/ai/suggest-reply/", {"ticket": ticket.pk}, format="json"
    )
    draft = response.data["suggested_reply"]
    assert response.data["language"] == "ar"
    assert any("؀" <= ch <= "ۿ" for ch in draft), draft


@pytest.mark.django_db
def test_an_english_customer_gets_an_english_draft(
    agent, english_customer, department, categories
):
    ticket = make_ticket(english_customer, department, categories)
    draft = agent.post(
        "/api/v1/ai/suggest-reply/", {"ticket": ticket.pk}, format="json"
    ).data["suggested_reply"]
    assert not any("؀" <= ch <= "ۿ" for ch in draft)


@pytest.mark.django_db
def test_categorize_is_input_dependent(english_customer, department, categories):
    backend = MockAIBackend()
    billing = backend.categorize("Invoice INV-2291 is wrong", "vat missing")
    technical = backend.categorize("Portal throws a 500 error", "crash on open")

    assert billing["category_slug"] == "billing-invoice"
    assert technical["category_slug"] == "technical-fault"
    assert 0 < billing["confidence"] <= 1
    assert billing["rationale"]


# ---------------------------------------------------------------------------
# Suggested solutions — a GET, unlike its three siblings: nothing to write,
# nothing to guard against mutating on the *current* ticket, but the same
# scoping and the same "empty is a legitimate answer" discipline apply.
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_suggest_solutions_ranks_same_category_above_keyword_only_match(
    agent, english_customer, department, categories
):
    ticket = make_ticket(english_customer, department, categories, subject="Invoice total is wrong")

    same_category_older = Ticket.objects.create(
        customer=english_customer,
        subject="Unrelated wording entirely",
        department=department,
        category=categories["billing-invoice"],
        status=Status.RESOLVED,
        resolved_at=timezone.now() - timedelta(days=10),
    )
    keyword_only = Ticket.objects.create(
        customer=english_customer,
        subject="Invoice total looks off",
        department=department,
        category=categories["technical-fault"],
        status=Status.RESOLVED,
        resolved_at=timezone.now() - timedelta(days=1),
    )

    response = agent.get("/api/v1/ai/suggested-solutions/", {"ticket": ticket.pk})
    assert response.status_code == 200
    ids = [s["ticket_id"] for s in response.data["solutions"]]
    assert ids.index(same_category_older.pk) < ids.index(keyword_only.pk)


@pytest.mark.django_db
def test_suggest_solutions_excludes_the_ticket_itself(agent, english_customer, department, categories):
    ticket = make_ticket(english_customer, department, categories)
    ticket.status = Status.RESOLVED
    ticket.resolved_at = timezone.now()
    ticket.save()

    response = agent.get("/api/v1/ai/suggested-solutions/", {"ticket": ticket.pk})
    assert ticket.pk not in [s["ticket_id"] for s in response.data["solutions"]]


@pytest.mark.django_db
def test_suggest_solutions_is_empty_not_an_error_when_nothing_matches(
    agent, english_customer, department, categories
):
    ticket = Ticket.objects.create(
        customer=english_customer, subject="Xyzzy Plugh Quux", department=department,
    )
    response = agent.get("/api/v1/ai/suggested-solutions/", {"ticket": ticket.pk})
    assert response.status_code == 200
    assert response.data["solutions"] == []


@pytest.mark.django_db
def test_suggest_solutions_includes_the_resolution_message_when_one_exists(
    agent, english_customer, department, categories
):
    ticket = make_ticket(english_customer, department, categories, subject="Invoice total is wrong")
    solved = Ticket.objects.create(
        customer=english_customer,
        subject="Invoice total was wrong",
        department=department,
        category=categories["billing-invoice"],
        status=Status.RESOLVED,
        resolved_at=timezone.now(),
    )
    TicketMessage.objects.create(
        ticket=solved, body="Refunded the duplicate line item.", is_internal=False, channel="web",
    )
    TicketMessage.objects.create(
        ticket=solved, body="internal note, not the fix", is_internal=True, channel="web",
    )

    response = agent.get("/api/v1/ai/suggested-solutions/", {"ticket": ticket.pk})
    match = next(s for s in response.data["solutions"] if s["ticket_id"] == solved.pk)
    assert match["resolution"] == "Refunded the duplicate line item."


@pytest.mark.django_db
def test_suggest_solutions_writes_nothing(agent, english_customer, department, categories):
    ticket = make_ticket(english_customer, department, categories)
    before = snapshot(ticket)

    agent.get("/api/v1/ai/suggested-solutions/", {"ticket": ticket.pk})

    after = snapshot(ticket)
    assert before == after


@pytest.mark.django_db
def test_suggest_solutions_never_creates_a_message(agent, english_customer, department, categories):
    ticket = make_ticket(english_customer, department, categories)
    before = TicketMessage.objects.count()
    agent.get("/api/v1/ai/suggested-solutions/", {"ticket": ticket.pk})
    assert TicketMessage.objects.count() == before


# ---------------------------------------------------------------------------
# Access and configuration
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_a_ticket_outside_the_callers_scope_is_404(english_customer, categories):
    """Otherwise the AI endpoints are a read primitive around story 03's scoping."""
    elsewhere = Department.objects.create(name_en="Other", name_ar="آخر", code="ai-other")
    ticket = make_ticket(english_customer, elsewhere, categories)

    mine = Department.objects.create(name_en="Mine", name_ar="لي", code="ai-mine")
    user = User.objects.create_user(
        username="ai-outsider", password="x", role=User.Role.AGENT, department=mine
    )
    client = APIClient()
    client.force_authenticate(user)

    assert client.post(
        "/api/v1/ai/summarize/", {"ticket": ticket.pk}, format="json"
    ).status_code == 404
    assert client.get(
        "/api/v1/ai/suggested-solutions/", {"ticket": ticket.pk}
    ).status_code == 404


@pytest.mark.django_db
def test_customers_cannot_call_the_ai_endpoints(english_customer, department, categories):
    ticket = make_ticket(english_customer, department, categories)
    portal = User.objects.create_user(
        username="ai-portal", password="x", role=User.Role.CUSTOMER, customer=english_customer
    )
    client = APIClient()
    client.force_authenticate(portal)
    assert client.post(
        "/api/v1/ai/summarize/", {"ticket": ticket.pk}, format="json"
    ).status_code == 403
    assert client.get(
        "/api/v1/ai/suggested-solutions/", {"ticket": ticket.pk}
    ).status_code == 403


def test_the_default_backend_is_the_mock(settings):
    settings.AI_BACKEND = "mock"
    assert isinstance(get_backend(), MockAIBackend)


def test_an_unknown_backend_is_a_configuration_error(settings):
    from django.core.exceptions import ImproperlyConfigured

    settings.AI_BACKEND = "gpt-9"
    with pytest.raises(ImproperlyConfigured):
        get_backend()


def test_claude_without_a_key_refuses_to_construct(settings, monkeypatch):
    """A misconfiguration that boots and then 500s mid-demo is worse than one
    that refuses to start — the second is noticed by whoever caused it.
    """
    from django.core.exceptions import ImproperlyConfigured

    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    settings.AI_BACKEND = "claude"
    with pytest.raises(ImproperlyConfigured, match="ANTHROPIC_API_KEY"):
        get_backend()
