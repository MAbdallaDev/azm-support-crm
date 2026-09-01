"""The portal home's category shortcut chips filter by real category,
mirroring the agent-side `KBArticleViewSet`'s own `?category=<slug>` filter
(`apps/kb/views.py`) rather than the free-text `q` search the chips used
before this fix.
"""

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.customers.models import Customer
from apps.kb.models import KBArticle, KBCategory


@pytest.fixture
def customer_client(db):
    customer = Customer.objects.create(name="Category Filter Co", email="ops@catfilter.test")
    user = User.objects.create_user(
        username="catfilter-customer", password="x", role=User.Role.CUSTOMER, customer=customer,
    )
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def billing(db):
    return KBCategory.objects.create(name_en="Billing & Invoices", name_ar="الفوترة", slug="billing")


@pytest.fixture
def technical(db):
    return KBCategory.objects.create(name_en="Technical Issues", name_ar="مشكلات تقنية", slug="technical")


def article(category, slug, published=True):
    return KBArticle.objects.create(
        title_en=f"Article {slug}",
        body_en="Body",
        slug=slug,
        category=category,
        status=KBArticle.Status.PUBLISHED if published else KBArticle.Status.DRAFT,
    )


@pytest.mark.django_db
def test_category_slug_filters_to_only_that_category(customer_client, billing, technical):
    article(billing, "billing-one")
    article(billing, "billing-two")
    article(technical, "technical-one")

    response = customer_client.get("/api/v1/portal/kb/articles/", {"category": "billing"})

    slugs = {row["slug"] for row in response.data["results"]}
    assert slugs == {"billing-one", "billing-two"}


@pytest.mark.django_db
def test_an_unknown_category_slug_returns_no_results_not_an_error(customer_client, billing):
    article(billing, "billing-one")

    response = customer_client.get("/api/v1/portal/kb/articles/", {"category": "does-not-exist"})

    assert response.status_code == 200
    assert response.data["results"] == []


@pytest.mark.django_db
def test_category_and_q_combine_rather_than_one_overriding_the_other(customer_client, billing, technical):
    article(billing, "billing-refund")
    KBArticle.objects.filter(slug="billing-refund").update(title_en="Refund policy")
    article(billing, "billing-vat")
    article(technical, "technical-refund")
    KBArticle.objects.filter(slug="technical-refund").update(title_en="Refund policy")

    response = customer_client.get(
        "/api/v1/portal/kb/articles/", {"category": "billing", "q": "Refund"}
    )

    slugs = {row["slug"] for row in response.data["results"]}
    assert slugs == {"billing-refund"}


@pytest.mark.django_db
def test_a_draft_in_the_requested_category_is_still_hidden_from_the_customer(customer_client, billing):
    article(billing, "billing-draft", published=False)
    article(billing, "billing-live")

    response = customer_client.get("/api/v1/portal/kb/articles/", {"category": "billing"})

    slugs = {row["slug"] for row in response.data["results"]}
    assert slugs == {"billing-live"}
