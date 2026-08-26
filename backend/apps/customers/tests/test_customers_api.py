"""Customers, contacts and notes over HTTP."""

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Branch, Department, User
from apps.customers.models import Contact, Customer, CustomerNote
from apps.tickets.models import Ticket

URL = "/api/v1/customers/"


@pytest.fixture
def branch(db):
    return Branch.objects.create(name_en="Riyadh", name_ar="الرياض", code="riyadh")


@pytest.fixture
def admin(db, branch):
    department = Department.objects.create(name_en="General", name_ar="عام", code="general")
    return User.objects.create_user(
        username="admin1", password="x", role=User.Role.ADMIN,
        department=department, branch=branch,
    )


@pytest.fixture
def api(admin):
    client = APIClient()
    client.force_authenticate(admin)
    return client


@pytest.fixture
def customers(branch):
    return [
        Customer.objects.create(
            name="Arabian Gulf", company="Gulf Trading", email="ops@gulf.test",
            phone="+966 11 111 1111", tier="enterprise", branch=branch,
        ),
        Customer.objects.create(
            name="Bayt Al-Noor", company="Noor Furnishing", email="info@noor.test",
            tier="standard", branch=branch,
        ),
        Customer.objects.create(
            name="Almaha Digital", company="Almaha", email="team@almaha.test",
            tier="premium", branch=branch,
        ),
    ]


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_list_and_retrieve(api, customers):
    response = api.get(URL)
    assert response.status_code == 200
    assert response.data["count"] == 3

    detail = api.get(f"{URL}{customers[0].pk}/")
    assert detail.status_code == 200
    assert detail.data["company"] == "Gulf Trading"
    assert "contacts" in detail.data


@pytest.mark.django_db
def test_create_sets_created_by_from_the_request(api, admin, branch):
    response = api.post(
        URL,
        {"name": "New Co", "email": "hello@new.test", "tier": "premium", "branch": branch.pk},
        format="json",
    )
    assert response.status_code == 201
    assert Customer.objects.get(name="New Co").created_by == admin


@pytest.mark.django_db
def test_update_and_partial_update(api, customers):
    customer = customers[0]
    assert api.patch(f"{URL}{customer.pk}/", {"tier": "premium"}, format="json").status_code == 200
    customer.refresh_from_db()
    assert customer.tier == "premium"


@pytest.mark.django_db
def test_delete_a_customer_with_no_tickets(api, customers):
    assert api.delete(f"{URL}{customers[0].pk}/").status_code == 204


@pytest.mark.django_db
def test_delete_a_customer_with_tickets_is_a_clean_400(api, customers):
    """`Ticket.customer` is PROTECT. Unhandled, ProtectedError is a 500 — but
    this is a client error, and the message should say what to do about it.
    """
    customer = customers[0]
    Ticket.objects.create(customer=customer, subject="Still open")

    response = api.delete(f"{URL}{customer.pk}/")
    assert response.status_code == 400
    assert "ticket" in str(response.data).lower()
    assert Customer.objects.filter(pk=customer.pk).exists()


# ---------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_tier_filter(api, customers):
    assert api.get(URL, {"tier": "enterprise"}).data["count"] == 1
    assert api.get(URL, {"tier": ["enterprise", "premium"]}).data["count"] == 2


@pytest.mark.django_db
def test_branch_filter(api, customers, branch):
    assert api.get(URL, {"branch": branch.pk}).data["count"] == 3


@pytest.mark.django_db
def test_q_filter_matches_name_company_email_and_phone(api, customers):
    assert api.get(URL, {"q": "Arabian"}).data["count"] == 1
    assert api.get(URL, {"q": "Noor Furnishing"}).data["count"] == 1
    assert api.get(URL, {"q": "team@almaha"}).data["count"] == 1
    assert api.get(URL, {"q": "111 1111"}).data["count"] == 1
    assert api.get(URL, {"q": "nothing-matches-this"}).data["count"] == 0


@pytest.mark.django_db
def test_open_ticket_count_is_annotated(api, customers):
    customer = customers[0]
    Ticket.objects.create(customer=customer, subject="Open one", status="open")
    Ticket.objects.create(customer=customer, subject="Closed one", status="closed")

    row = next(r for r in api.get(URL).data["results"] if r["id"] == customer.pk)
    assert row["open_ticket_count"] == 1


# ---------------------------------------------------------------------------
# Notes and contacts
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_notes_create_and_list(api, admin, customers):
    customer = customers[0]
    created = api.post(
        f"{URL}{customer.pk}/notes/",
        {"body": "Prefers a phone call before any billing change."},
        format="json",
    )
    assert created.status_code == 201
    assert created.data["author"] == admin.pk

    listed = api.get(f"{URL}{customer.pk}/notes/")
    assert listed.status_code == 200
    assert len(listed.data) == 1
    assert listed.data[0]["author_name"]


@pytest.mark.django_db
def test_note_author_cannot_be_forged(api, admin, customers):
    other = User.objects.create_user(username="someone", password="x")
    response = api.post(
        f"{URL}{customers[0].pk}/notes/",
        {"body": "Forged", "author": other.pk},
        format="json",
    )
    assert response.status_code == 201
    assert CustomerNote.objects.get().author == admin


@pytest.mark.django_db
def test_contacts_crud(api, customers):
    customer = customers[0]
    created = api.post(
        "/api/v1/contacts/",
        {"customer": customer.pk, "name": "Fatimah Al-Nasser",
         "position": "Finance Manager", "is_primary": True},
        format="json",
    )
    assert created.status_code == 201

    listed = api.get("/api/v1/contacts/", {"customer": customer.pk})
    assert listed.data["count"] == 1
    assert Contact.objects.get().is_primary is True


@pytest.mark.django_db
def test_contacts_are_scoped_through_their_customer(customers, branch):
    """A contact has no branch of its own, so it must never outlive the
    visibility of the customer it belongs to.
    """
    other_branch = Branch.objects.create(name_en="Jeddah", name_ar="جدة", code="jeddah")
    elsewhere = Customer.objects.create(
        name="Far Away", email="far@away.test", branch=other_branch
    )
    Contact.objects.create(customer=elsewhere, name="Invisible")
    Contact.objects.create(customer=customers[0], name="Visible")

    agent = User.objects.create_user(
        username="branch-agent", password="x", role=User.Role.AGENT, branch=branch
    )
    client = APIClient()
    client.force_authenticate(agent)

    names = {row["name"] for row in client.get("/api/v1/contacts/").data["results"]}
    assert names == {"Visible"}


@pytest.mark.django_db
def test_customer_role_is_refused(customers):
    portal_user = User.objects.create_user(
        username="portal1", password="x", role=User.Role.CUSTOMER, customer=customers[0]
    )
    client = APIClient()
    client.force_authenticate(portal_user)
    assert client.get(URL).status_code == 403
