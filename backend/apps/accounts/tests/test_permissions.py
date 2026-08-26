"""The model layer — `ir.model.access`, in Odoo terms.

Each class is exercised directly against a stub request for all four roles,
allowed and denied, plus the anonymous case. No HTTP, no viewset: story 04
re-asserts the same matrix over real routes once they exist.
"""

import pytest

from apps.accounts.permissions import (
    IsAdmin,
    IsAgent,
    IsAgentOrAbove,
    IsCustomer,
    IsManager,
    IsOwnerOrAgentOrAbove,
)
from apps.accounts.models import User

ROLES = ["admin", "manager", "agent", "customer"]


class StubRequest:
    def __init__(self, user):
        self.user = user


class StubUser:
    is_authenticated = True

    def __init__(self, role, customer_id=None):
        self.role = role
        self.customer_id = customer_id


class Anonymous:
    is_authenticated = False
    role = None


def request_for(role, customer_id=None):
    return StubRequest(StubUser(role, customer_id))


@pytest.mark.parametrize(
    "permission_class,allowed",
    [
        (IsAdmin, {"admin"}),
        (IsManager, {"manager"}),
        (IsAgent, {"agent"}),
        (IsCustomer, {"customer"}),
        (IsAgentOrAbove, {"admin", "manager", "agent"}),
        (IsOwnerOrAgentOrAbove, {"admin", "manager", "agent", "customer"}),
    ],
)
def test_role_matrix(permission_class, allowed):
    permission = permission_class()
    for role in ROLES:
        granted = permission.has_permission(request_for(role), view=None)
        assert granted is (role in allowed), f"{permission_class.__name__} / {role}"


@pytest.mark.parametrize(
    "permission_class",
    [IsAdmin, IsManager, IsAgent, IsCustomer, IsAgentOrAbove, IsOwnerOrAgentOrAbove],
)
def test_anonymous_is_denied_never_raises(permission_class):
    """An unauthenticated request must be a clean denial, not a 500."""
    assert permission_class().has_permission(StubRequest(Anonymous()), view=None) is False
    assert permission_class().has_permission(StubRequest(None), view=None) is False


@pytest.mark.parametrize(
    "permission_class",
    [IsAdmin, IsManager, IsAgent, IsCustomer, IsAgentOrAbove, IsOwnerOrAgentOrAbove],
)
def test_role_less_user_is_denied(permission_class):
    """A User row with no role — possible via createsuperuser before story 02's
    default applies, or a future migration — must not fall through to allowed.
    """
    assert permission_class().has_permission(request_for(None), view=None) is False


class StubTicket:
    def __init__(self, customer_id):
        self.customer_id = customer_id


class StubMessage:
    customer_id = None

    def __init__(self, customer_id):
        self.ticket = StubTicket(customer_id)


class StubOrphan:
    """No customer to compare against — a shape the check must refuse."""

    customer_id = None
    ticket = None


@pytest.mark.parametrize("obj_factory", [StubTicket, StubMessage])
def test_owner_object_permission_matches_on_customer(obj_factory):
    permission = IsOwnerOrAgentOrAbove()
    own = obj_factory(7)

    assert permission.has_object_permission(
        request_for("customer", customer_id=7), None, own
    ) is True
    assert permission.has_object_permission(
        request_for("customer", customer_id=8), None, own
    ) is False


def test_owner_object_permission_allows_all_staff():
    permission = IsOwnerOrAgentOrAbove()
    ticket = StubTicket(7)
    for role in ("admin", "manager", "agent"):
        assert permission.has_object_permission(request_for(role), None, ticket) is True


def test_owner_object_permission_fails_closed():
    """A customer with no linked Customer, and an object with no owner, are both
    refused. Failing open on either would defeat the class entirely.
    """
    permission = IsOwnerOrAgentOrAbove()
    assert permission.has_object_permission(
        request_for("customer", customer_id=None), None, StubTicket(7)
    ) is False
    assert permission.has_object_permission(
        request_for("customer", customer_id=7), None, StubOrphan()
    ) is False


def test_role_constants_match_the_model():
    """Guards against the permission module drifting from User.Role."""
    assert set(ROLES) == set(User.Role.values)
