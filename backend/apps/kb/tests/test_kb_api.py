"""Knowledge base API — including search against real Arabic.

The Arabic strings here are literal, not transliterated. An `icontains` against a
`TextField` behaves differently per database collation, and "the code compiles"
is not evidence that a non-ASCII substring match works. Both engines run this.
"""

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Department, User
from apps.customers.models import Customer
from apps.kb.models import KBArticle, KBCategory

ARTICLES = "/api/v1/kb/articles/"


@pytest.fixture
def category(db):
    return KBCategory.objects.create(name_en="Billing", name_ar="الفوترة", slug="kb-billing")


@pytest.fixture
def articles(category, article_author):
    published = KBArticle.objects.create(
        slug="arabic-invoice",
        title_en="Setting up an Arabic invoice template",
        title_ar="إعداد قالب فاتورة باللغة العربية",
        body_en="Arabic invoices are a separate template, not a translation toggle.",
        body_ar="الفاتورة العربية قالب مستقل، وليست مجرد خيار ترجمة للقالب الإنجليزي.",
        category=category,
        status="published",
    )
    english_only = KBArticle.objects.create(
        slug="sms-delays",
        title_en="Why SMS notifications arrive late",
        title_ar="",
        body_en="The delay is added by the mobile operator's own queue.",
        body_ar="",
        category=category,
        status="published",
    )
    draft = KBArticle.objects.create(
        slug="unfinished",
        title_en="Draft about refunds",
        body_en="Not ready yet.",
        category=category,
        status="draft",
        # Story 08 narrows draft visibility to the author, managers and
        # admins. An authorless draft would be invisible to every fixture
        # user below, which would make every "can see" assertion vacuous.
        author=article_author,
    )
    return {"published": published, "english_only": english_only, "draft": draft}


@pytest.fixture
def department(db):
    return Department.objects.create(name_en="Support", name_ar="دعم", code="kb-support")


@pytest.fixture
def article_author(department):
    """The draft's own author — a distinct user from `agent` below, so
    "author sees it" and "a second agent does not" are genuinely two people."""
    return User.objects.create_user(
        username="kb-author", password="x", role=User.Role.AGENT, department=department
    )


@pytest.fixture
def agent(department):
    user = User.objects.create_user(
        username="kb-agent", password="x", role=User.Role.AGENT, department=department
    )
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def manager(department):
    user = User.objects.create_user(
        username="kb-manager", password="x", role=User.Role.MANAGER, department=department
    )
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def portal_user(db):
    customer = Customer.objects.create(name="Acme", email="ops@acme.test")
    user = User.objects.create_user(
        username="kb-customer", password="x", role=User.Role.CUSTOMER, customer=customer
    )
    client = APIClient()
    client.force_authenticate(user)
    return client


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_arabic_search_matches_an_arabic_title(agent, articles):
    response = agent.get(ARTICLES, {"q": "فاتورة"})
    assert response.status_code == 200
    slugs = [row["slug"] for row in response.data["results"]]
    assert slugs == ["arabic-invoice"]


@pytest.mark.django_db
def test_arabic_search_matches_an_arabic_body(agent, articles):
    """A phrase that appears only in `body_ar`, nowhere in the titles."""
    response = agent.get(ARTICLES, {"q": "خيار ترجمة"})
    assert [row["slug"] for row in response.data["results"]] == ["arabic-invoice"]


@pytest.mark.django_db
def test_english_search_still_works(agent, articles):
    response = agent.get(ARTICLES, {"q": "operator"})
    assert [row["slug"] for row in response.data["results"]] == ["sms-delays"]


@pytest.mark.django_db
def test_search_with_no_match_is_an_empty_list_not_an_error(agent, articles):
    response = agent.get(ARTICLES, {"q": "لا يوجد هذا النص إطلاقًا"})
    assert response.status_code == 200
    assert response.data["count"] == 0


# ---------------------------------------------------------------------------
# Draft visibility
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_a_second_agent_does_not_see_another_agents_draft(agent, articles):
    """Tightened from story 05: a draft used to be visible to any staff
    member. An agent's half-written article is not their colleagues' reading
    material — only its author, managers and admins may see it."""
    slugs = {row["slug"] for row in agent.get(ARTICLES).data["results"]}
    assert "unfinished" not in slugs


@pytest.mark.django_db
def test_the_authoring_agent_sees_their_own_draft(article_author, articles):
    client = APIClient()
    client.force_authenticate(article_author)
    slugs = {row["slug"] for row in client.get(ARTICLES).data["results"]}
    assert "unfinished" in slugs


@pytest.mark.django_db
def test_a_manager_sees_every_draft(manager, articles):
    slugs = {row["slug"] for row in manager.get(ARTICLES).data["results"]}
    assert "unfinished" in slugs


@pytest.mark.django_db
def test_a_second_agent_requesting_the_draft_by_slug_gets_404(agent, articles):
    """Scoped in get_queryset(), so the row does not exist for them at all —
    the same 404-not-403 shape story 03 established for out-of-scope tickets."""
    assert agent.get(f"{ARTICLES}unfinished/").status_code == 404


@pytest.mark.django_db
def test_customers_do_not_see_drafts(portal_user, articles):
    slugs = {row["slug"] for row in portal_user.get(ARTICLES).data["results"]}
    assert "unfinished" not in slugs
    assert "arabic-invoice" in slugs


@pytest.mark.django_db
def test_a_customer_requesting_a_draft_by_slug_gets_404(portal_user, articles):
    """Scoped in get_queryset(), so the row does not exist for them at all."""
    assert portal_user.get(f"{ARTICLES}unfinished/").status_code == 404


@pytest.mark.django_db
def test_customers_cannot_write(portal_user, articles, category):
    assert portal_user.post(
        ARTICLES,
        {"slug": "sneaky", "title_en": "Nope", "body_en": "x", "category": category.pk},
        format="json",
    ).status_code == 403
    assert portal_user.patch(
        f"{ARTICLES}arabic-invoice/", {"title_en": "Edited"}, format="json"
    ).status_code == 403


# ---------------------------------------------------------------------------
# Counters
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_retrieve_increments_view_count_once(agent, articles):
    article = articles["published"]
    assert article.view_count == 0

    first = agent.get(f"{ARTICLES}{article.slug}/")
    assert first.status_code == 200
    assert first.data["view_count"] == 1

    agent.get(f"{ARTICLES}{article.slug}/")
    article.refresh_from_db()
    assert article.view_count == 2


@pytest.mark.django_db
def test_list_does_not_increment_view_count(agent, articles):
    agent.get(ARTICLES)
    articles["published"].refresh_from_db()
    assert articles["published"].view_count == 0


@pytest.mark.django_db
def test_helpful_increments(agent, articles):
    article = articles["published"]
    response = agent.post(f"{ARTICLES}{article.slug}/helpful/")
    assert response.status_code == 200
    assert response.data["helpful_count"] == 1


# ---------------------------------------------------------------------------
# Shape
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_has_arabic_flags_a_half_translated_article(agent, articles):
    """Story 08's completeness indicator needs this to be representable."""
    rows = {row["slug"]: row for row in agent.get(ARTICLES).data["results"]}
    assert rows["arabic-invoice"]["has_arabic"] is True
    assert rows["sms-delays"]["has_arabic"] is False


@pytest.mark.django_db
def test_list_omits_bodies(agent, articles):
    """Ten full articles is a large payload; the browse list renders titles."""
    row = agent.get(ARTICLES).data["results"][0]
    assert "body_en" not in row
    assert "body_ar" not in row


@pytest.mark.django_db
def test_categories_carry_an_article_count(agent, articles):
    row = agent.get("/api/v1/kb/categories/").data[0]
    assert row["article_count"] == 3


@pytest.mark.django_db
def test_agent_can_create_and_becomes_the_author(agent, category):
    response = agent.post(
        ARTICLES,
        {
            "slug": "new-article", "title_en": "New", "body_en": "Body",
            "category": category.pk, "status": "draft",
        },
        format="json",
    )
    assert response.status_code == 201
    assert KBArticle.objects.get(slug="new-article").author.username == "kb-agent"
