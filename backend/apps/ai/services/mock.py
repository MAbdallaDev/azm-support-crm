"""The default AI backend: deterministic, and genuinely input-dependent.

Those two properties are both required and they pull against each other. Tests
need stable output across runs; the demo needs output that visibly differs per
ticket. A backend returning a constant string would satisfy the first and
destroy the second — every ticket in story 07's AI panel would look identical,
and broken wiring would be indistinguishable from working wiring.

The resolution is a per-ticket seed derived from the subject, so the same ticket
always produces the same text and different tickets produce different text.
"""

import hashlib
import random
from datetime import timedelta

from django.utils import timezone

from apps.ai.services.base import AIBackend

SUMMARY_OPENERS = [
    "{customer} reports: {subject}.",
    "Raised by {customer} — {subject}.",
    "{subject}, reported by {customer}.",
]

SUMMARY_READS = [
    "Arrived over {channel} {age} ago and is currently {status}.",
    "Opened {age} ago via {channel}; status is {status}.",
    "{age} old, came in on {channel}, sitting at {status}.",
]

SUMMARY_TAILS = [
    "The thread has {messages} message(s); no blocking information is missing.",
    "{messages} message(s) so far. The customer has given enough detail to act on.",
    "{messages} message(s) exchanged. Worth confirming the outcome before closing.",
]

REPLY_EN = {
    "billing-invoice": (
        "Thank you for flagging this. I have pulled up the invoice on your account and "
        "can see what you are describing. I am checking it against the usage report now "
        "and will come back to you within two working hours with either a corrected "
        "invoice or an explanation of the difference."
    ),
    "payments": (
        "Thank you for the details. I can see the payment on our side and I am tracing "
        "which invoice it was matched to. If it has been allocated to the wrong one I "
        "will move it and the balance will correct itself immediately — you will not "
        "need to send anything again."
    ),
    "account-access": (
        "Thanks for letting us know. I have checked the account and the login itself is "
        "active, so this is most likely the password reset not completing. I am sending "
        "a fresh reset link now; it stays valid for one hour and can only be used once."
    ),
    "technical-fault": (
        "Thank you for reporting this, and apologies for the disruption. I have "
        "reproduced the behaviour on my side, so this is not something specific to your "
        "setup. It is with the platform team now and I will update you here as soon as "
        "I have a fix window."
    ),
    "notifications": (
        "Thanks for the report. Our records show the notification left our system within "
        "seconds of the event, which means the delay was added downstream by the mobile "
        "operator. I can switch this account to email notifications if you need a "
        "guaranteed arrival time."
    ),
    "__default__": (
        "Thank you for getting in touch. I have your request and I am looking into it "
        "now. I expect to have an update for you within the next two working hours, and "
        "I will write again as soon as I know more."
    ),
}

REPLY_AR = {
    "billing-invoice": (
        "شكرًا لتنبيهنا إلى هذا الأمر. راجعت الفاتورة على حسابك وأرى ما تشير إليه، وأقوم "
        "الآن بمطابقتها مع تقرير الاستخدام. سأوافيك خلال ساعتَي عمل إما بفاتورة مصححة أو "
        "بتوضيح سبب الفرق."
    ),
    "payments": (
        "شكرًا على التفاصيل. أرى الدفعة من جهتنا وأتابع الفاتورة التي طوبقت معها. وإذا "
        "كانت قد وُجّهت إلى فاتورة غير صحيحة فسأعيد توجيهها ليصحّح الرصيد فورًا، ولن تحتاج "
        "إلى إعادة الإرسال."
    ),
    "account-access": (
        "شكرًا لإبلاغنا. راجعت الحساب ووجدت أن بيانات الدخول نشطة، ما يعني أن المشكلة على "
        "الأرجح في عدم اكتمال إعادة تعيين كلمة المرور. أرسلت الآن رابطًا جديدًا، وهو صالح "
        "لمدة ساعة ويُستخدم مرة واحدة فقط."
    ),
    "technical-fault": (
        "شكرًا لإبلاغنا، ونعتذر عن الانقطاع. تمكنت من إعادة إنتاج المشكلة من جهتي، وهذا "
        "يعني أنها ليست خاصة بإعداداتك. المشكلة الآن لدى فريق المنصة وسأوافيك بتحديث هنا "
        "بمجرد تحديد موعد الإصلاح."
    ),
    "notifications": (
        "شكرًا على الإبلاغ. تُظهر سجلاتنا أن الإشعار غادر نظامنا خلال ثوانٍ من وقوع الحدث، "
        "ما يعني أن التأخير أُضيف لاحقًا لدى مشغّل الشبكة. ويمكنني تحويل هذا الحساب إلى "
        "إشعارات البريد الإلكتروني إذا كنت تحتاج إلى وقت وصول مضمون."
    ),
    "__default__": (
        "شكرًا لتواصلك معنا. وصلني طلبك وأعمل على متابعته الآن، وأتوقع أن أوافيك بتحديث "
        "خلال ساعتَي عمل، وسأكتب إليك فور توفر أي جديد."
    ),
}

# Ignored when matching a ticket's subject against another for "suggested
# solutions" — otherwise every ticket in English "matches" every other one on
# the word "the".
STOPWORDS = {"the", "a", "an", "is", "are", "to", "for", "on", "in", "of", "and", "our", "my"}

# Substring hints for categorisation, checked in order. Crude on purpose: the
# point is a plausible, explainable answer, not a classifier.
CATEGORY_HINTS = [
    (("invoice", "vat", "statement", "فاتورة", "كشف"), "billing-invoice"),
    (("payment", "refund", "transfer", "charge", "دفع", "استرداد"), "payments"),
    (("login", "password", "access", "user", "دخول", "كلمة المرور"), "account-access"),
    (("error", "500", "crash", "broken", "fail", "خطأ", "عطل"), "technical-fault"),
    (("sms", "email", "notification", "whatsapp", "إشعار", "رسالة"), "notifications"),
    (("add", "setup", "import", "connect", "إعداد", "إضافة"), "onboarding"),
]


def _humanise(delta: timedelta) -> str:
    seconds = int(delta.total_seconds())
    if seconds < 3600:
        return f"{max(seconds // 60, 1)} minutes"
    if seconds < 86400:
        return f"{seconds // 3600} hours"
    return f"{seconds // 86400} days"


class MockAIBackend(AIBackend):
    name = "mock"

    @staticmethod
    def _rng(seed_text: str) -> random.Random:
        # Seeded from a hash of the input so tests are stable across runs while
        # the output still varies per ticket.
        return random.Random(hashlib.sha256(seed_text.encode("utf-8")).hexdigest())

    def summarize(self, ticket) -> str:
        rng = self._rng(ticket.subject)
        age = _humanise(timezone.now() - (ticket.created_at or timezone.now()))
        fields = {
            "customer": ticket.customer.name if ticket.customer_id else "an unknown customer",
            "subject": ticket.subject.rstrip("."),
            "channel": ticket.get_channel_display(),
            "status": ticket.get_status_display().lower(),
            "age": age,
            "messages": ticket.messages.count(),
        }
        return " ".join(
            [
                rng.choice(SUMMARY_OPENERS).format(**fields),
                rng.choice(SUMMARY_READS).format(**fields),
                rng.choice(SUMMARY_TAILS).format(**fields),
            ]
        )

    def suggest_reply(self, ticket, context: str = "") -> str:
        """Drafted in the customer's preferred language.

        An Arabic-preferring customer gets an Arabic draft. That is what makes
        the feature legible in the demo rather than a plausible-looking English
        box next to an Arabic conversation.
        """
        slug = ticket.category.slug if ticket.category_id else "__default__"
        arabic = (
            ticket.customer_id and ticket.customer.preferred_language == "ar"
        )
        table = REPLY_AR if arabic else REPLY_EN
        body = table.get(slug, table["__default__"])

        if context:
            suffix = (
                f"\n\nبخصوص ملاحظتك: {context}" if arabic else f"\n\nRegarding your note: {context}"
            )
            body += suffix
        return body

    def categorize(self, subject: str, body: str) -> dict:
        from apps.tickets.models import Category

        haystack = f"{subject} {body}".lower()
        matched_slug = None
        for needles, slug in CATEGORY_HINTS:
            if any(needle in haystack for needle in needles):
                matched_slug = slug
                break

        rng = self._rng(subject)
        if matched_slug is None:
            category = Category.objects.order_by("slug").first()
            confidence = round(rng.uniform(0.30, 0.55), 2)
            rationale = (
                "No strong keyword signal; defaulting to the first category. "
                "Worth an agent's judgement."
            )
        else:
            category = Category.objects.filter(slug=matched_slug).first()
            confidence = round(rng.uniform(0.72, 0.96), 2)
            rationale = f"Matched wording associated with '{matched_slug}'."

        return {
            "category_id": category.pk if category else None,
            "category_slug": category.slug if category else "",
            "confidence": confidence,
            "rationale": rationale,
        }

    def suggest_solutions(self, ticket) -> list[dict]:
        """"Similar" is a real, explainable, deterministic database ordering —
        not a call to any model or vector index. Same category outranks a
        keyword-only match; the most recently resolved candidate breaks ties.
        Same house style as `categorize`'s substring hints: a smart-looking
        query, not machine learning, and it is exactly as convincing in a demo
        because the result is always genuinely related to the ticket at hand.
        """
        from django.db.models import Q

        from apps.tickets.models import Status, Ticket

        words = {
            w for w in ticket.subject.lower().split() if len(w) > 2 and w not in STOPWORDS
        }
        if not words and not ticket.category_id:
            # Neither signal available — "similar" has no honest answer here.
            # Ranking the whole resolved-ticket table by recency would be
            # "recent", not "similar", which is a wrong answer, not a weak one.
            return []

        keyword_q = Q()
        for word in words:
            keyword_q |= Q(subject__icontains=word)

        filter_q = keyword_q
        if ticket.category_id:
            filter_q = Q(category_id=ticket.category_id) | keyword_q if words else Q(
                category_id=ticket.category_id
            )

        candidates = (
            Ticket.objects.filter(status__in=[Status.RESOLVED, Status.CLOSED])
            .exclude(pk=ticket.pk)
            .filter(filter_q)
            .select_related("category")
            .prefetch_related("messages")
        )

        def rank(candidate):
            same_category = (
                ticket.category_id is not None and candidate.category_id == ticket.category_id
            )
            overlap = len({w.lower() for w in candidate.subject.split()} & words)
            return (not same_category, -overlap, -(candidate.resolved_at or candidate.updated_at).timestamp())

        ranked = sorted(candidates, key=rank)[:3]

        results = []
        for candidate in ranked:
            resolution_message = (
                candidate.messages.filter(is_internal=False).order_by("-created_at").first()
            )
            results.append(
                {
                    "ticket_id": candidate.pk,
                    "number": candidate.number,
                    "subject": candidate.subject,
                    "resolution": resolution_message.body if resolution_message else "",
                    "resolved_at": candidate.resolved_at.isoformat() if candidate.resolved_at else "",
                }
            )
        return results
