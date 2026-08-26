"""Permission classes — the **model** layer of access control.

Odoo mental map: this module is `ir.model.access`. It answers "may this role
touch this kind of record at all?" and nothing more. The row-level question —
"*which* of those records?" — is Odoo's record rules, and lives in
`apps/accounts/scoping.py`.

Having only this layer is the classic mistake. An agent correctly denied the
ability to delete customers can still list every customer in the database unless
`get_queryset()` filters too.

Every class here returns False for an anonymous or role-less user rather than
raising, so an unauthenticated request is a clean 401/403 and never a 500.
"""

from rest_framework.permissions import BasePermission

from .models import User

Role = User.Role
AGENT_OR_ABOVE = {Role.AGENT, Role.MANAGER, Role.ADMIN}


def _role(request) -> str | None:
    user = getattr(request, "user", None)
    if user is None or not user.is_authenticated:
        return None
    return getattr(user, "role", None)


class IsAdmin(BasePermission):
    """Administrators only — user management, org structure, the audit log."""

    message = "Administrator role required."

    def has_permission(self, request, view):
        return _role(request) == Role.ADMIN


class IsManager(BasePermission):
    message = "Manager role required."

    def has_permission(self, request, view):
        return _role(request) == Role.MANAGER


class IsAgent(BasePermission):
    message = "Agent role required."

    def has_permission(self, request, view):
        return _role(request) == Role.AGENT


class IsCustomer(BasePermission):
    """Portal callers. Story 05's portal viewsets pair this with scoping."""

    message = "Customer role required."

    def has_permission(self, request, view):
        return _role(request) == Role.CUSTOMER


class IsAgentOrAbove(BasePermission):
    """Staff. The default for every agent-facing endpoint in story 04."""

    message = "Agent, manager or administrator role required."

    def has_permission(self, request, view):
        return _role(request) in AGENT_OR_ABOVE


class IsOwnerOrAgentOrAbove(BasePermission):
    """Staff, or the customer whose `Customer` owns the object.

    The object check resolves `obj.customer` for a Ticket and `obj.ticket.customer`
    for a TicketMessage. It is a second line of defence only: scoping should have
    removed the object from the queryset long before this runs, which is why an
    out-of-scope detail route returns 404 rather than 403.
    """

    message = "You do not have access to this record."

    def has_permission(self, request, view):
        role = _role(request)
        return role in AGENT_OR_ABOVE or role == Role.CUSTOMER

    def has_object_permission(self, request, view, obj):
        role = _role(request)
        if role in AGENT_OR_ABOVE:
            return True
        if role != Role.CUSTOMER:
            return False

        customer_id = getattr(request.user, "customer_id", None)
        if customer_id is None:
            return False

        owner_id = getattr(obj, "customer_id", None)
        if owner_id is None:
            ticket = getattr(obj, "ticket", None)
            owner_id = getattr(ticket, "customer_id", None)
        if owner_id is None:
            # An object with no customer to compare against is not the caller's
            # by default. Failing open here would be the whole point of the class.
            return False
        return owner_id == customer_id
