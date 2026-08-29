"""Login, refresh, me — and the regression guard for the API-wide lockdown."""

import pytest
from django.urls import reverse
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import AuditLog, Branch, Department, User
from apps.tickets.demo_content import DEMO_PASSWORD

LOGIN_URL = "/api/v1/auth/login/"
REFRESH_URL = "/api/v1/auth/refresh/"
ME_URL = "/api/v1/auth/me/"


@pytest.fixture
def admin_user(db):
    department = Department.objects.create(name_en="General", name_ar="عام", code="general")
    branch = Branch.objects.create(name_en="Riyadh", name_ar="الرياض", code="riyadh")
    user = User.objects.create_user(
        username="admin@demo",
        email="admin@demo.local",
        password=DEMO_PASSWORD,
        role=User.Role.ADMIN,
        department=department,
        branch=branch,
        tier=3,
        language="en",
        first_name="Mostafa",
        last_name="Abdallah",
    )
    return user


def _login(client, username=None):
    """Access token for a demo login — the pattern every test in this file
    already uses inline; factored out once it starts repeating.
    """
    return client.post(
        LOGIN_URL,
        {"username": username or "admin@demo", "password": DEMO_PASSWORD},
        content_type="application/json",
    ).json()["access"]


@pytest.mark.django_db
def test_login_with_username_returns_tokens_and_profile(client, admin_user):
    response = client.post(
        LOGIN_URL,
        {"username": "admin@demo", "password": DEMO_PASSWORD},
        content_type="application/json",
    )
    assert response.status_code == 200
    body = response.json()
    assert body["access"] and body["refresh"]
    assert body["user"]["role"] == "admin"
    assert body["user"]["full_name"] == "Mostafa Abdallah"
    assert body["user"]["department"] == "general"
    assert body["user"]["branch"] == "riyadh"


@pytest.mark.django_db
def test_login_with_email_also_works(client, admin_user):
    """The deliberate deviation from the intake: the intake says "email +
    password", but seed_demo and the README document the username `admin@demo`.
    Accepting either keeps the documented credentials working.
    """
    response = client.post(
        LOGIN_URL,
        {"username": "admin@demo.local", "password": DEMO_PASSWORD},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["user"]["username"] == "admin@demo"


@pytest.mark.django_db
def test_access_token_carries_a_role_claim(client, admin_user):
    response = client.post(
        LOGIN_URL,
        {"username": "admin@demo", "password": DEMO_PASSWORD},
        content_type="application/json",
    )
    token = AccessToken(response.json()["access"])
    assert token["role"] == "admin"
    assert token["name"] == "Mostafa Abdallah"


@pytest.mark.django_db
def test_refresh_exchanges_a_refresh_token(client, admin_user):
    refresh = client.post(
        LOGIN_URL,
        {"username": "admin@demo", "password": DEMO_PASSWORD},
        content_type="application/json",
    ).json()["refresh"]

    response = client.post(
        REFRESH_URL, {"refresh": refresh}, content_type="application/json"
    )
    assert response.status_code == 200
    assert response.json()["access"]


@pytest.mark.django_db
def test_wrong_password_is_401_and_audited_without_the_password(client, admin_user):
    response = client.post(
        LOGIN_URL,
        {"username": "admin@demo", "password": "not-the-password"},
        content_type="application/json",
    )
    assert response.status_code == 401

    entry = AuditLog.objects.get(action="login_failed")
    assert entry.actor is None
    assert entry.changes == {"identifier": "admin@demo"}
    assert "not-the-password" not in str(entry.changes)


@pytest.mark.django_db
def test_successful_login_is_audited(client, admin_user):
    client.post(
        LOGIN_URL,
        {"username": "admin@demo", "password": DEMO_PASSWORD},
        content_type="application/json",
    )
    entry = AuditLog.objects.get(action="login")
    assert entry.actor == admin_user


@pytest.mark.django_db
def test_me_requires_a_token(client, admin_user):
    assert client.get(ME_URL).status_code == 401


@pytest.mark.django_db
def test_me_returns_the_callers_profile(client, admin_user):
    access = client.post(
        LOGIN_URL,
        {"username": "admin@demo", "password": DEMO_PASSWORD},
        content_type="application/json",
    ).json()["access"]

    response = client.get(ME_URL, headers={"Authorization": f"Bearer {access}"})
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "admin"
    assert body["department"] == "general"
    assert body["branch"] == "riyadh"
    assert body["tier"] == 3
    assert body["language"] == "en"
    assert "password" not in body


@pytest.mark.django_db
@pytest.mark.parametrize("path", ["/api/v1/health/", "/api/v1/schema/", "/api/v1/docs/"])
def test_public_endpoints_survived_the_lockdown(client, path):
    """DEFAULT_PERMISSION_CLASSES = IsAuthenticated applies to drf-spectacular's
    views too. Without SERVE_PERMISSIONS these become 401 — a regression that is
    invisible until a reviewer opens the link.
    """
    assert client.get(path).status_code == 200


@pytest.mark.django_db
def test_patch_me_updates_phone_and_language_only(client, admin_user):
    access = _login(client)
    response = client.patch(
        ME_URL,
        {"phone": "+966500000000", "language": "ar", "role": "customer"},
        content_type="application/json",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["phone"] == "+966500000000"
    assert body["language"] == "ar"
    # role is not in MeUpdateSerializer's fields at all, so a role in the
    # payload is silently ignored rather than accepted or rejected — the
    # same "field the client never saw" reasoning story 05's portal used.
    assert body["role"] == "admin"

    admin_user.refresh_from_db()
    assert admin_user.phone == "+966500000000"


@pytest.mark.django_db
def test_change_password_requires_the_current_one(client, admin_user):
    access = _login(client)
    wrong = client.post(
        "/api/v1/auth/change-password/",
        {"current_password": "not-it", "new_password": "SomethingNew123"},
        content_type="application/json",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert wrong.status_code == 400

    right = client.post(
        "/api/v1/auth/change-password/",
        {"current_password": DEMO_PASSWORD, "new_password": "SomethingNew123"},
        content_type="application/json",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert right.status_code == 200

    admin_user.refresh_from_db()
    assert admin_user.check_password("SomethingNew123")
    # The old password no longer authenticates.
    stale_login = client.post(
        LOGIN_URL,
        {"username": "admin@demo", "password": DEMO_PASSWORD},
        content_type="application/json",
    )
    assert stale_login.status_code == 401


@pytest.mark.django_db
def test_change_password_never_appears_in_the_audit_log(client, admin_user):
    access = _login(client)
    client.post(
        "/api/v1/auth/change-password/",
        {"current_password": DEMO_PASSWORD, "new_password": "SomethingNew123"},
        content_type="application/json",
        headers={"Authorization": f"Bearer {access}"},
    )
    entry = AuditLog.objects.filter(model_name="accounts.User", object_id=str(admin_user.pk)).latest(
        "created_at"
    )
    assert "password" not in entry.changes
