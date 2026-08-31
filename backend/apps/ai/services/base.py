"""The AI seam.

No Anthropic API key exists for this project, so the AI features are mocked.
**The point is that the seam is real**: `MockAIBackend` and `ClaudeAIBackend`
implement the same ABC, and swapping them is one environment variable. Nothing
above this module knows which backend is live.

Odoo mental map: this is the abstract-service pattern — a base class defining the
contract with swappable implementations selected by configuration, the way a
payment acquirer is chosen.

**Every method here is advisory.** Nothing an AI backend returns is applied
automatically: `summarize` and `categorize` write to two dedicated advisory
columns, `suggest_reply` persists nothing at all. An agent always approves before
anything reaches a customer. `apps/ai/tests/test_ai_advisory.py` enforces that
with a before/after snapshot of the whole ticket row.
"""

from abc import ABC, abstractmethod

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


class AIBackend(ABC):
    """The contract. Implementations must not mutate anything they are given."""

    name = "abstract"

    @abstractmethod
    def summarize(self, ticket) -> str:
        """A short plain-language summary of the ticket and its conversation."""

    @abstractmethod
    def suggest_reply(self, ticket, context: str = "") -> str:
        """A draft reply for the agent to edit. Never sent automatically."""

    @abstractmethod
    def categorize(self, subject: str, body: str) -> dict:
        """`{"category_id": int|None, "category_slug": str, "confidence": float,
        "rationale": str}`."""

    @abstractmethod
    def suggest_solutions(self, ticket) -> list[dict]:
        """Up to three already-resolved tickets that look like this one, each
        `{"ticket_id": int, "number": str, "subject": str, "resolution": str,
        "resolved_at": str}`. Empty list is a legitimate answer — a ticket with
        no similar resolved history must not force a fake result.
        """


def get_backend() -> AIBackend:
    """The configured backend, chosen by `settings.AI_BACKEND`."""
    from apps.ai.services.claude import ClaudeAIBackend
    from apps.ai.services.mock import MockAIBackend

    backends = {"mock": MockAIBackend, "claude": ClaudeAIBackend}
    key = (getattr(settings, "AI_BACKEND", "mock") or "mock").strip().lower()
    try:
        return backends[key]()
    except KeyError as exc:
        raise ImproperlyConfigured(
            f"AI_BACKEND={key!r} is not recognised. Choose one of {sorted(backends)}."
        ) from exc
