"""SLA logic — computed on create, derived on read.

**There is no scheduler, and that is the design rather than a shortcut.** Due
timestamps are written once, when a ticket is created or its priority changes.
Breach and escalation-threshold state are derived on read by comparing those
stored timestamps against the current time.

The alternative — a Celery beat job sweeping tickets and flipping boolean
columns — needs a worker, a broker, and a retry policy, and it introduces a
window in which the database disagrees with reality. Deriving on read cannot
drift, needs no infrastructure, and stories 03 and 04 were already built against
it. Do not "improve" this into a scheduled task.

**Elapsed time is plain wall-clock.** Business-hours calendars, per-branch
working weeks and public holidays are explicitly Phase 2 — a customer raising a
ticket at 23:00 Thursday is measured from 23:00 Thursday. This is stated so it
reads as a known limitation rather than an oversight.

This module owns the breach expression for the whole codebase. `filters.py` and
`serializers.py` both import from here; a third copy is how a queue tab and a
row badge start disagreeing.
"""

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from apps.tickets.models import SLAPolicy, Status

RESPONSE = "response"
RESOLUTION = "resolution"

STATE_OK = "ok"
STATE_APPROACHING = "approaching"
STATE_BREACHED = "breached"


# ---------------------------------------------------------------------------
# The breach expression — one definition, two call sites
# ---------------------------------------------------------------------------


def breached_q(now=None) -> Q:
    """Tickets past a deadline they have not met.

    Derived from the stored due timestamps, not the `sla_response_breached` /
    `sla_resolution_breached` columns: those are denormalised copies nothing
    keeps current, so filtering on them would silently return zero rows.

    A resolved ticket is excluded by construction — `resolved_at__isnull=True`.
    Without that the *Breaching* queue tab fills up with closed work, which is
    the single easiest mistake to make here.
    """
    now = now or timezone.now()
    return Q(sla_response_due_at__lt=now, first_response_at__isnull=True) | Q(
        sla_resolution_due_at__lt=now, resolved_at__isnull=True
    )


def is_breached(ticket, now=None) -> bool:
    """The same rule as `breached_q`, applied to one in-memory row."""
    now = now or timezone.now()
    if (
        ticket.sla_response_due_at
        and ticket.sla_response_due_at < now
        and not ticket.first_response_at
    ):
        return True
    return bool(
        ticket.sla_resolution_due_at
        and ticket.sla_resolution_due_at < now
        and not ticket.resolved_at
    )


# ---------------------------------------------------------------------------
# Policy selection and due dates
# ---------------------------------------------------------------------------


def select_policy(ticket):
    """Exact `(customer_tier, priority)` match, else a priority-only fallback.

    The exact match is unambiguous because `SLAPolicy` carries a unique
    constraint on that pair. The fallback orders by `resolution_minutes`
    descending — the most *generous* policy for that priority — because
    inventing a tighter deadline than any configured policy would manufacture
    breaches that no one agreed to.
    """
    tier = getattr(ticket.customer, "tier", None) if ticket.customer_id else None

    if tier:
        exact = SLAPolicy.objects.filter(
            customer_tier=tier, priority=ticket.priority, is_active=True
        ).first()
        if exact is not None:
            return exact

    return (
        SLAPolicy.objects.filter(priority=ticket.priority, is_active=True)
        .order_by("-resolution_minutes")
        .first()
    )


def compute_due_dates(ticket, *, force: bool = False) -> bool:
    """Set `sla_policy` and the two due timestamps. True if anything changed.

    Computes **only** when the due timestamps are unset, or when `force` is
    passed because the priority changed.

    That guard is load-bearing, not defensive. `seed_demo` writes these columns
    itself to manufacture a deliberate breach spread — three already breached,
    three within 10% of target, two escalated — and then asserts it. Recomputing
    on every save would overwrite that spread with policy-derived values, the
    demo would quietly degrade to "everything is comfortable", and nothing
    anywhere would raise. `test_seed_still_intact.py` is the regression guard.
    """
    already_set = ticket.sla_response_due_at and ticket.sla_resolution_due_at
    if already_set and not force:
        return False

    policy = select_policy(ticket)
    if policy is None:
        return False

    started = ticket.created_at or timezone.now()
    ticket.sla_policy = policy
    ticket.sla_response_due_at = started + timedelta(
        minutes=policy.first_response_minutes
    )
    ticket.sla_resolution_due_at = started + timedelta(
        minutes=policy.resolution_minutes
    )
    ticket.save(
        update_fields=[
            "sla_policy",
            "sla_response_due_at",
            "sla_resolution_due_at",
            "updated_at",
        ]
    )
    return True


# ---------------------------------------------------------------------------
# Derived state, for the right-pane SLA block in the design
# ---------------------------------------------------------------------------


def sla_state(ticket, kind: str, now=None) -> dict:
    """One SLA clock's current state.

    Returns `state`, `seconds_remaining`, `target_minutes` and `policy_name`.

    `seconds_remaining` is **signed** — negative when overdue — so the client
    renders both "2h 14m left" and "Breached 14m" from one number instead of
    needing a separate boolean and magnitude.

    **The clock freezes.** The response clock stops at `first_response_at`, the
    resolution clock at `resolved_at`. So a ticket answered inside its target
    reads `ok` forever rather than decaying to `breached` the moment the target
    passes, and a ticket answered late reads `breached` permanently — which is
    the honest history the compliance report in `reports/` needs.

    Note the deliberate asymmetry with `breached_q`: this function reports what
    *happened* to a finished ticket, while the queue filter reports what needs
    attention *now* and therefore excludes resolved work entirely.
    """
    now = now or timezone.now()
    policy = ticket.sla_policy

    if kind == RESPONSE:
        due = ticket.sla_response_due_at
        stopped_at = ticket.first_response_at
        target_minutes = policy.first_response_minutes if policy else None
    elif kind == RESOLUTION:
        due = ticket.sla_resolution_due_at
        stopped_at = ticket.resolved_at or ticket.closed_at
        target_minutes = policy.resolution_minutes if policy else None
    else:
        raise ValueError(f"kind must be '{RESPONSE}' or '{RESOLUTION}', got {kind!r}")

    if due is None:
        return {
            "state": STATE_OK,
            "seconds_remaining": None,
            "target_minutes": target_minutes,
            "policy_name": policy.name if policy else "",
        }

    reference = stopped_at or now
    seconds_remaining = int((due - reference).total_seconds())

    if seconds_remaining < 0:
        state = STATE_BREACHED
    elif stopped_at is not None:
        # Met the target and the clock has stopped. Never "approaching" again.
        state = STATE_OK
    else:
        state = STATE_OK
        threshold = policy.escalate_at_percent if policy else 90
        started = ticket.created_at
        if target_minutes and started:
            elapsed = (now - started).total_seconds()
            if elapsed >= (threshold / 100) * target_minutes * 60:
                # The design's "escalates to Tier 3 at 90%".
                state = STATE_APPROACHING

    return {
        "state": state,
        "seconds_remaining": seconds_remaining,
        "target_minutes": target_minutes,
        "policy_name": policy.name if policy else "",
    }


def resolution_met(ticket) -> bool | None:
    """Did this ticket meet its resolution target? None when unknowable.

    Used by the SLA-compliance figure in `reports/`. Only a finished ticket has
    an answer; an open one is still in play, and counting it either way would
    bias the percentage.
    """
    if ticket.status not in (Status.RESOLVED, Status.CLOSED):
        return None
    if not ticket.sla_resolution_due_at:
        return None
    finished = ticket.resolved_at or ticket.closed_at
    if finished is None:
        return None
    return finished <= ticket.sla_resolution_due_at
