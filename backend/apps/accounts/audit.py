"""Automatic audit trail.

Odoo mental map: this is `mail.thread`'s tracked-field logging, except it is
opt-in per model and writes to one flat `AuditLog` table rather than to each
record's chatter.

Four models are audited: Ticket, Customer, KBArticle and User. Every create,
update and delete leaves one row naming the actor, the model, the object and
the fields that actually changed.

Two things here are security rather than bookkeeping:

* **`REDACTED_FIELDS` keeps password material out of `changes` entirely** — not
  masked, not hashed, absent. An audit trail that records password hashes is a
  credential store with extra steps, and it is read by more people than the user
  table is.
* **Only changed fields are recorded.** Dumping the whole row on every save
  would put a customer's email and phone into the log on an unrelated status
  change, and make the log itself a data-protection liability.

Two categories of field are excluded from the diff entirely: `REDACTED_FIELDS`
for the reason above, and `auto_now` timestamps because Django rewrites them on
every save — a diff containing only `updated_at` is not a change, and letting
those through would mean every no-op save wrote a row.
"""

from contextlib import contextmanager

from django.apps import apps as django_apps
from django.db.models.signals import post_delete, post_save, pre_save

from .middleware import get_current_actor

# Label -> the fields worth tracking is "all of them minus the redacted set",
# so the models are listed and the fields are derived.
AUDITED_MODELS = (
    "tickets.Ticket",
    "customers.Customer",
    "kb.KBArticle",
    "accounts.User",
)

# Never serialised into `changes`, for any model. `password` is the important
# one; `last_login` is excluded because UPDATE_LAST_LOGIN writes it on every
# single login and would bury real changes under noise.
REDACTED_FIELDS = {"password", "last_login"}

_disabled = False


@contextmanager
def audit_disabled():
    """Suppress audit writes for the duration of the block.

    Used by `seed_demo`: seeding ~150 tickets plus their messages, events and
    customers would otherwise write thousands of rows attributed to nobody, and
    add a SELECT per save for the pre_save snapshot. Demo data is not an audit
    event.
    """
    global _disabled
    previous = _disabled
    _disabled = True
    try:
        yield
    finally:
        _disabled = previous


def is_disabled() -> bool:
    return _disabled


def _audit_log_model():
    return django_apps.get_model("accounts", "AuditLog")


def _serialisable(value):
    """Coerce a field value into something JSONField will accept."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    return str(value)


def _tracked_fields(instance):
    for field in instance._meta.concrete_fields:
        if field.name in REDACTED_FIELDS or field.attname in REDACTED_FIELDS:
            continue
        # `auto_now` fields (updated_at) are rewritten by Django on every single
        # save, so including them would put a diff in every audit row, make a
        # no-op save look like a change, and bury the real edit. The AuditLog row
        # carries its own created_at, so nothing is lost.
        if getattr(field, "auto_now", False):
            continue
        yield field


def _write(actor, action, instance, changes):
    AuditLog = _audit_log_model()
    AuditLog.objects.create(
        actor=actor,
        action=action,
        model_name=instance._meta.label,
        object_id=str(instance.pk),
        changes=changes,
    )


# ---------------------------------------------------------------------------
# Signal handlers
# ---------------------------------------------------------------------------


def audit_pre_save(sender, instance, raw=False, **kwargs):
    """Stash the current database values so post_save can diff against them.

    One extra SELECT per update. That is the price of "changed fields only", and
    it is paid on writes rather than reads — acceptable for this application's
    shape, and skipped entirely during seeding.
    """
    if _disabled or raw or instance.pk is None:
        instance._audit_snapshot = None
        return
    try:
        previous = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        instance._audit_snapshot = None
        return
    instance._audit_snapshot = {
        field.attname: getattr(previous, field.attname) for field in _tracked_fields(previous)
    }


def audit_post_save(sender, instance, created, raw=False, **kwargs):
    if _disabled or raw:
        return

    snapshot = getattr(instance, "_audit_snapshot", None)
    if created or snapshot is None:
        changes = {
            field.attname: {"from": None, "to": _serialisable(getattr(instance, field.attname))}
            for field in _tracked_fields(instance)
        }
        action = "created"
    else:
        changes = {}
        for field in _tracked_fields(instance):
            old = snapshot.get(field.attname)
            new = getattr(instance, field.attname)
            if old != new:
                changes[field.attname] = {
                    "from": _serialisable(old),
                    "to": _serialisable(new),
                }
        action = "updated"
        if not changes:
            # A save that changed nothing is not an audit event. Writing a row
            # here would make the log grow on every no-op save and drown the
            # real entries.
            return

    instance._audit_snapshot = None
    _write(get_current_actor(), action, instance, changes)


def audit_post_delete(sender, instance, **kwargs):
    if _disabled:
        return
    _write(
        get_current_actor(),
        "deleted",
        instance,
        {"__str__": _serialisable(str(instance))},
    )


# ---------------------------------------------------------------------------
# Auth events — called from the login view, which is the only place that knows
# whether a credential check succeeded.
# ---------------------------------------------------------------------------


def audit_login_success(user_id, identifier):
    if _disabled or user_id is None:
        return
    AuditLog = _audit_log_model()
    User = django_apps.get_model("accounts", "User")
    AuditLog.objects.create(
        actor=User.objects.filter(pk=user_id).first(),
        action="login",
        model_name="accounts.User",
        object_id=str(user_id),
        changes={"identifier": _serialisable(identifier)},
    )


def audit_password_changed(user):
    """A self-service password change is audited explicitly, the same way
    login is — the generic post_save diff cannot do it. `password` is excluded
    from `_tracked_fields` entirely (that is what keeps a hash out of `changes`
    on every other save too), so a save that changes *only* the password
    produces an empty diff and `audit_post_save` skips it as a no-op. Story 03's
    "password changes ... are audited" therefore needs its own call, exactly
    like `audit_login_success` needs one for the same structural reason.
    """
    if _disabled:
        return
    AuditLog = _audit_log_model()
    AuditLog.objects.create(
        actor=user,
        action="password_changed",
        model_name=user._meta.label,
        object_id=str(user.pk),
        changes={},
    )


def audit_login_failure(identifier):
    """Records the attempted identifier and nothing else.

    The submitted password is never touched, not even to record its length —
    a failed login is very often a correct password against the wrong account.
    """
    if _disabled:
        return
    AuditLog = _audit_log_model()
    AuditLog.objects.create(
        actor=None,
        action="login_failed",
        model_name="accounts.User",
        object_id="",
        changes={"identifier": _serialisable(identifier)},
    )


# ---------------------------------------------------------------------------
# Wiring
# ---------------------------------------------------------------------------


def connect():
    """Called from AccountsConfig.ready(), never at module import time.

    Import time runs before the app registry is populated, so `get_model` would
    raise. `ready()` is the first point at which every model exists.
    """
    for label in AUDITED_MODELS:
        model = django_apps.get_model(label)
        uid = f"audit_{label}"
        pre_save.connect(audit_pre_save, sender=model, dispatch_uid=f"{uid}_pre_save")
        post_save.connect(audit_post_save, sender=model, dispatch_uid=f"{uid}_post_save")
        post_delete.connect(
            audit_post_delete, sender=model, dispatch_uid=f"{uid}_post_delete"
        )


__all__ = [
    "AUDITED_MODELS",
    "REDACTED_FIELDS",
    "audit_disabled",
    "audit_login_failure",
    "audit_login_success",
    "connect",
    "is_disabled",
]
