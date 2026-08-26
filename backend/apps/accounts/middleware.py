"""Carries the acting user from the request into the audit signal handlers.

Django's `post_save` signal receives the instance but not the request, so the
actor has to travel out of band. A `threading.local` is the standard way.

**The `finally` is the whole point.** Server threads are pooled and reused: a
worker that finishes a request without clearing the slot hands the previous
user's identity to whatever request lands on that thread next, and every audit
row it writes names the wrong person. That failure is silent, intermittent, and
only appears under concurrency — exactly the kind that survives to production.
"""

import threading

_state = threading.local()


def get_current_actor():
    """The user for the request being handled on this thread, or None.

    None is a legitimate answer, not an error: management commands, migrations,
    the shell and the test suite all write rows with no request behind them.
    """
    return getattr(_state, "actor", None)


def set_current_actor(user):
    _state.actor = user


class CurrentActorMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        # `request.user` is lazy; touching `.is_authenticated` resolves it, which
        # is what we want here — but store None rather than an AnonymousUser so
        # the FK assignment in the signal handler stays simple.
        set_current_actor(user if user is not None and user.is_authenticated else None)
        try:
            return self.get_response(request)
        finally:
            set_current_actor(None)
