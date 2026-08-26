"""Django admin is the product's entire back-office, so a broken `list_display`
or `list_filter` is a broken feature, not a broken debug tool.

One loop over `admin.site._registry` covers every registered model — including
any added by a later story — and catches a bad column reference the moment it
lands.
"""

import pytest
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.urls import reverse

User = get_user_model()

REGISTERED = sorted(
    admin.site._registry, key=lambda m: (m._meta.app_label, m._meta.model_name)
)


@pytest.fixture
def admin_client(db, client):
    user = User.objects.create_superuser(
        username="smoke@demo", email="smoke@demo.local", password="smoke-pass-1234"
    )
    client.force_login(user)
    return client


def test_every_domain_model_is_registered():
    """The intake lists eighteen models (its prose says seventeen — it miscounts);
    all of them must reach the admin.
    """
    labels = {f"{m._meta.app_label}.{m._meta.object_name}" for m in REGISTERED}
    expected = {
        "accounts.User", "accounts.Department", "accounts.Branch", "accounts.AuditLog",
        "customers.Customer", "customers.Contact", "customers.CustomerNote",
        "tickets.Category", "tickets.Tag", "tickets.Ticket", "tickets.TicketMessage",
        "tickets.TicketEvent", "tickets.Attachment", "tickets.CannedReply",
        "tickets.SLAPolicy", "tickets.CSATRating",
        "kb.KBCategory", "kb.KBArticle",
    }
    assert expected <= labels


@pytest.mark.parametrize(
    "model", REGISTERED, ids=lambda m: f"{m._meta.app_label}.{m._meta.model_name}"
)
@pytest.mark.django_db
def test_admin_changelist_renders(admin_client, model):
    url = reverse(f"admin:{model._meta.app_label}_{model._meta.model_name}_changelist")
    assert admin_client.get(url).status_code == 200


@pytest.mark.parametrize(
    "model", REGISTERED, ids=lambda m: f"{m._meta.app_label}.{m._meta.model_name}"
)
@pytest.mark.django_db
def test_admin_search_and_filters_are_wired(admin_client, model):
    """Hitting the changelist with a search term exercises `search_fields`, which
    a plain GET does not.
    """
    url = reverse(f"admin:{model._meta.app_label}_{model._meta.model_name}_changelist")
    assert admin_client.get(url, {"q": "riyadh"}).status_code == 200


@pytest.mark.django_db
def test_audit_log_cannot_be_added_or_edited(admin_client):
    """An audit trail that can be edited is not an audit trail."""
    from apps.accounts.models import AuditLog

    model_admin = admin.site._registry[AuditLog]
    request = admin_client.request(PATH_INFO="/admin/").wsgi_request
    assert model_admin.has_add_permission(request) is False
    assert model_admin.has_change_permission(request) is False

    assert admin_client.get(reverse("admin:accounts_auditlog_add")).status_code in (302, 403)


@pytest.mark.django_db
def test_ticket_changelist_does_not_issue_a_query_per_row(admin_client, django_assert_max_num_queries):
    """`list_select_related` plus a prefetch on tags is what keeps this bounded.
    Without them a 25-row page costs well over a hundred queries.
    """
    from apps.customers.models import Customer
    from apps.tickets.models import Ticket

    customer = Customer.objects.create(name="Acme", email="ops@acme.test")
    for i in range(25):
        Ticket.objects.create(customer=customer, subject=f"Ticket {i}")

    url = reverse("admin:tickets_ticket_changelist")
    with django_assert_max_num_queries(25):
        assert admin_client.get(url).status_code == 200
