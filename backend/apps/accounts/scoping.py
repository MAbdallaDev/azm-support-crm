"""Scoping functions — the **record** layer of access control.

Odoo mental map: this module is record rules. `permissions.py` is
`ir.model.access`. Both are needed; either one alone leaks.

These are plain functions taking `(queryset, user)` rather than mixin methods,
for two reasons: they can be unit-tested without constructing a request, and
story 05's portal viewsets reuse them without inheriting an agent-facing base
class.

The matrix:

    admin     every row
    manager   their whole department
    agent     their department, plus anything assigned to or watched by them
    customer  only rows belonging to their own linked Customer

An unauthenticated or role-less user gets `.none()`, never the unfiltered
queryset. Every branch is closed; the function ends in `.none()` rather than
falling through to `qs`.
"""

from django.db.models import Q

from .models import User

Role = User.Role


def scope_tickets(qs, user):
    if not user or not user.is_authenticated:
        return qs.none()
    if user.role == Role.ADMIN:
        return qs
    if user.role == Role.MANAGER:
        return qs.filter(department=user.department) if user.department_id else qs.none()
    if user.role == Role.AGENT:
        # .distinct() is required, not defensive: joining watchers (M2M)
        # duplicates a row per watcher, and a ticket appearing twice in the
        # queue is a bug story 07 would have to chase.
        return qs.filter(
            Q(department=user.department) | Q(assignee=user) | Q(watchers=user)
        ).distinct()
    if user.role == Role.CUSTOMER:
        return qs.filter(customer=user.customer) if user.customer_id else qs.none()
    return qs.none()


def scope_customers(qs, user):
    """Staff are scoped by branch; a customer sees only their own record.

    Staff with no branch set see everything rather than nothing — an
    unconfigured agent should be inconvenienced, not locked out, and branch is
    an organisational convenience rather than a security boundary. Customers get
    no such latitude: no linked Customer means no rows.
    """
    if not user or not user.is_authenticated:
        return qs.none()
    if user.role == Role.ADMIN:
        return qs
    if user.role in (Role.MANAGER, Role.AGENT):
        return qs.filter(branch=user.branch) if user.branch_id else qs
    if user.role == Role.CUSTOMER:
        return qs.filter(pk=user.customer_id) if user.customer_id else qs.none()
    return qs.none()


def scope_ticket_messages(qs, user):
    """Messages on tickets the user can see — and for customers, public ones only.

    `TicketMessage.is_internal` is a trust boundary, not a display flag. The
    `.filter(is_internal=False)` below is the whole of that boundary on the read
    path; there is no second check further down the stack, which is why it has a
    dedicated regression test.
    """
    if not user or not user.is_authenticated:
        return qs.none()

    from apps.tickets.models import Ticket

    visible_tickets = scope_tickets(Ticket.objects.all(), user)
    qs = qs.filter(ticket__in=visible_tickets)
    if user.role == Role.CUSTOMER:
        qs = qs.filter(is_internal=False)
    return qs


def scope_kb_articles(qs, user):
    """Published articles are visible to everyone; drafts are not.

    A draft is visible to its author, to managers and to admins — an agent's
    half-written article is not their colleagues' reading material. Published
    articles are never scoped by department or branch: an article is either
    fit to publish or it is not.
    """
    if not user or not user.is_authenticated:
        return qs.none()
    if user.role in (Role.ADMIN, Role.MANAGER):
        return qs
    if user.role == Role.CUSTOMER:
        return qs.filter(status="published")
    return qs.filter(Q(status="published") | Q(author=user))


class ScopedQuerySetMixin:
    """Applies a scoping function inside `get_queryset()`.

    Story 04's viewsets set `scope_function` and inherit this rather than
    filtering in a list handler. The difference matters: `get_queryset()` also
    backs the detail, update and delete routes, so a record the caller cannot
    see is not merely hidden from the list — it does not exist for them at all.

    That is also why an out-of-scope detail request returns **404 rather than
    403**. A 403 confirms the record exists, which is itself a disclosure; the
    object was never in the queryset, so 404 is both safer and more truthful.
    """

    scope_function = None

    def get_queryset(self):
        qs = super().get_queryset()
        if self.scope_function is None:
            raise NotImplementedError(
                f"{type(self).__name__} inherits ScopedQuerySetMixin but sets no "
                "scope_function. An unscoped queryset on a scoped view leaks rows; "
                "set one explicitly, or do not use the mixin."
            )
        return type(self).scope_function(qs, self.request.user)
