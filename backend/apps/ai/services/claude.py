"""The live backend — a stub with the real signatures and the real prompts.

This file exists so that swapping to a live model is a configuration change
rather than a design change. The prompts below are the actual intended prompts,
documented now while the reasoning is fresh, so whoever wires this up is not
also inventing the product behaviour.

Selecting `AI_BACKEND="claude"` without `ANTHROPIC_API_KEY` **fails at Django
startup**, not on the first request. A misconfiguration that boots happily and
then 500s in front of an audience is strictly worse than one that refuses to
start: the second is noticed immediately, by the person who caused it.
"""

import os

from django.core.exceptions import ImproperlyConfigured

from apps.ai.services.base import AIBackend

MODEL = "claude-sonnet-4-5"

SUMMARIZE_PROMPT = """\
Summarise this support ticket for an agent picking it up cold, in at most three
sentences. State what the customer needs, what has already been tried, and what
is still missing. Do not speculate about causes and do not propose a fix.

Subject: {subject}
Customer: {customer} (tier: {tier})
Channel: {channel} | Status: {status} | Priority: {priority}
Conversation:
{thread}
"""

SUGGEST_REPLY_PROMPT = """\
Draft a reply to this customer for a support agent to review and edit before
sending. Write in {language}. Be specific about what happens next and by when.
Do not promise a refund, a discount, or a delivery date that is not already in
the thread. Do not apologise more than once.

Subject: {subject}
Customer: {customer}
Conversation so far:
{thread}
Agent's note to incorporate: {context}
"""

CATEGORIZE_PROMPT = """\
Classify this ticket into exactly one of the categories listed. Reply as JSON
with keys "category_slug", "confidence" (0-1) and "rationale" (one sentence).
If no category fits well, choose the closest and lower the confidence rather
than inventing a new one.

Categories: {categories}
Subject: {subject}
Body: {body}
"""

SUGGEST_SOLUTIONS_PROMPT = """\
List up to three previously resolved tickets most similar to this one, with a
one-line note on how each was resolved. Only use tickets provided in the
candidate list below — do not invent ticket numbers or resolutions.

Subject: {subject}
Category: {category}
Candidate resolved tickets (number, subject, resolution):
{candidates}
"""


class ClaudeAIBackend(AIBackend):
    name = "claude"

    def __init__(self):
        if not os.getenv("ANTHROPIC_API_KEY"):
            raise ImproperlyConfigured(
                "AI_BACKEND='claude' requires ANTHROPIC_API_KEY. Set it, or set "
                "AI_BACKEND='mock' (the default) to use the offline backend."
            )

    def summarize(self, ticket) -> str:
        raise NotImplementedError(
            "ClaudeAIBackend is a documented stub. No Anthropic key is available "
            "for this project; MockAIBackend is the default. Wiring this up means "
            "calling the Messages API with SUMMARIZE_PROMPT."
        )

    def suggest_reply(self, ticket, context: str = "") -> str:
        raise NotImplementedError(
            "ClaudeAIBackend is a documented stub — see SUGGEST_REPLY_PROMPT."
        )

    def categorize(self, subject: str, body: str) -> dict:
        raise NotImplementedError(
            "ClaudeAIBackend is a documented stub — see CATEGORIZE_PROMPT."
        )

    def suggest_solutions(self, ticket) -> list[dict]:
        raise NotImplementedError(
            "ClaudeAIBackend is a documented stub — see SUGGEST_SOLUTIONS_PROMPT."
        )
