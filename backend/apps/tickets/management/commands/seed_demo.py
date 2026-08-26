"""`manage.py seed_demo` — fill the database with credible bilingual demo data.

Odoo mental map: this is the `ir.cron` / data-XML equivalent — a management
command, not a fixture file, because the data has to be computed at run time.

**Every timestamp is derived from `timezone.now()` on each run.** A seed written
with fixed dates looks correct the day it is written and then rots silently:
a week later every ticket has breached its SLA and the "3 near breach / 3
breached" spread the design depends on is gone. Nothing here is hard-coded to a
date.

Because timestamps move, idempotency means **stable identities, not stable
rows**. Every object is keyed on a natural key — `Department.code`,
`Customer.email`, `Ticket.number`, `KBArticle.slug`, `CannedReply.shortcut`,
`User.username` — and the time-dependent columns are rewritten in place on each
run. Running the command twice leaves every object count unchanged.

Randomness comes from `random.Random(SEED)`, a seeded *instance* rather than the
global module, so the shape of the data is reproducible while the timestamps
stay live. Nothing else in the process has its RNG disturbed.
"""

from __future__ import annotations

import random
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Branch, Department
from apps.customers.models import Contact, Customer, CustomerNote
from apps.kb.models import KBArticle, KBCategory
from apps.tickets import demo_content as content
from apps.tickets.models import (
    CannedReply,
    Category,
    Channel,
    CSATRating,
    Priority,
    SLAPolicy,
    Status,
    Tag,
    Ticket,
    TicketEvent,
    TicketMessage,
)

User = get_user_model()

SEED = 20260826
TICKET_COUNT = 150
HISTORY_DAYS = 90

STATUSES = list(Status.values)
CHANNELS = list(Channel.values)
PRIORITIES = list(Priority.values)
OPEN_STATUSES = {"new", "open", "pending", "on_hold", "escalated", "reopened"}
CLOSED_STATUSES = {"resolved", "closed"}

# The first eight tickets carry the SLA states the design has to be able to
# show. Everything after them is distributed naturally; these are pinned so the
# demo cannot accidentally lose a state on a re-run.
GUARANTEED = {
    0: "breached", 1: "breached", 2: "breached", 3: "breached",
    4: "near", 5: "near", 6: "near", 7: "near",
    8: "escalated", 9: "escalated", 10: "escalated",
}

# Which department owns which ticket category.
CATEGORY_DEPARTMENT = {
    "billing-invoice": "billing",
    "payments": "billing",
    "account-access": "technical",
    "technical-fault": "technical",
    "notifications": "technical",
    "feature-request": "general",
    "onboarding": "general",
}

AI_SUMMARIES = [
    "Customer reports a billing discrepancy on a recent invoice; totals do not match the "
    "usage report. Likely a period-mismatch on the generated PDF.",
    "Portal returns a server error on ticket detail. Reproduced across two browsers, so "
    "client-side causes are ruled out.",
    "Payment was received but matched to the wrong invoice. Re-allocation, not a refund.",
    "Access request for two new users, read-only. No approval blockers identified.",
    "Arabic rendering issue in a generated PDF — font without an Arabic cut is the usual cause.",
]


class Command(BaseCommand):
    help = "Create (or refresh) a full set of bilingual demo data. Safe to run twice."

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete previously seeded data in FK-safe order before seeding. DEBUG only.",
        )

    # ------------------------------------------------------------------
    # Entry point
    # ------------------------------------------------------------------

    def handle(self, *args, **options):
        if options["flush"]:
            if not settings.DEBUG:
                raise CommandError(
                    "--flush refuses to run with DEBUG=False. It deletes tickets, customers "
                    "and users, which is not something to do by accident against a real "
                    "deployment."
                )
            self._flush()

        self.rng = random.Random(SEED)
        self.now = timezone.now()
        self.counts: dict[str, int] = {}

        with transaction.atomic():
            departments = self._seed_departments()
            branches = self._seed_branches()
            staff = self._seed_staff(departments, branches)
            customers = self._seed_customers(branches, staff)
            portal_users = self._seed_portal_logins(customers, branches)
            categories = self._seed_categories()
            tags = self._seed_tags()
            policies = self._seed_sla_policies()
            self._seed_canned_replies(categories)
            self._seed_knowledge_base(staff)
            self._seed_tickets(
                staff=staff,
                portal_users=portal_users,
                customers=customers,
                categories=categories,
                tags=tags,
                policies=policies,
                departments=departments,
            )

        self._report()

    # ------------------------------------------------------------------
    # Flush
    # ------------------------------------------------------------------

    def _flush(self):
        """FK-safe order: tickets before customers (Ticket.customer is PROTECT),
        customers before the portal users that point at them.
        """
        self.stdout.write(self.style.WARNING("Flushing previously seeded data…"))
        CSATRating.objects.all().delete()
        TicketEvent.objects.all().delete()
        TicketMessage.objects.all().delete()
        Ticket.objects.all().delete()
        CustomerNote.objects.all().delete()
        Contact.objects.all().delete()
        # Portal logins point at Customer with SET_NULL, so users can outlive the
        # customer row — but delete them first anyway so counts are exact.
        User.objects.filter(username__endswith="@demo").delete()
        Customer.objects.all().delete()
        KBArticle.objects.all().delete()
        KBCategory.objects.all().delete()
        CannedReply.objects.all().delete()
        SLAPolicy.objects.all().delete()
        Tag.objects.all().delete()
        Category.objects.all().delete()
        Department.objects.all().delete()
        Branch.objects.all().delete()

    # ------------------------------------------------------------------
    # Organisation
    # ------------------------------------------------------------------

    def _seed_departments(self):
        out = {}
        for code, name_en, name_ar in content.DEPARTMENTS:
            obj, _ = Department.objects.update_or_create(
                code=code, defaults={"name_en": name_en, "name_ar": name_ar}
            )
            out[code] = obj
        self.counts["Departments"] = len(out)
        return out

    def _seed_branches(self):
        out = {}
        for code, name_en, name_ar in content.BRANCHES:
            obj, _ = Branch.objects.update_or_create(
                code=code, defaults={"name_en": name_en, "name_ar": name_ar}
            )
            out[code] = obj
        self.counts["Branches"] = len(out)
        return out

    # ------------------------------------------------------------------
    # People
    # ------------------------------------------------------------------

    def _seed_staff(self, departments, branches):
        out = {}
        for (
            username, first, last, role, dept, branch, tier, language, superuser, staff_flag
        ) in content.STAFF:
            user, created = User.objects.get_or_create(
                username=username, defaults={"email": f"{username}.local"}
            )
            user.email = f"{username}.local"
            user.first_name = first
            user.last_name = last
            user.role = role
            user.department = departments[dept]
            user.branch = branches[branch]
            user.tier = tier
            user.language = language
            user.is_superuser = superuser
            user.is_staff = staff_flag
            user.is_active = True
            user.is_available = True
            user.phone = f"+966 5{self.rng.randint(0, 9)} {self.rng.randint(100, 999)} "\
                         f"{self.rng.randint(1000, 9999)}"
            # set_password re-hashes on every run; that is cheap and it means a
            # changed DEMO_PASSWORD actually takes effect on an existing database.
            user.set_password(content.DEMO_PASSWORD)
            user.save()
            out[username] = user
        self.counts["Staff users"] = len(out)
        return out

    def _seed_portal_logins(self, customers, branches):
        """One portal login per customer, so every ticket opened over the web
        channel has a believable author. `customer@demo` is the documented one.
        """
        username, first, last, role, language = content.CUSTOMER_LOGIN
        out = {}

        named_customer = customers["support@najdlogistics.sa"]
        user, _ = User.objects.get_or_create(
            username=username, defaults={"email": f"{username}.local"}
        )
        user.email = f"{username}.local"
        user.first_name, user.last_name = first, last
        user.role = role
        user.language = language
        user.customer = named_customer
        user.branch = named_customer.branch
        user.is_staff = False
        user.is_superuser = False
        user.set_password(content.DEMO_PASSWORD)
        user.save()
        out[named_customer.pk] = user

        for email, customer in customers.items():
            if customer.pk in out:
                continue
            portal_username = f"portal-{email.split('@')[1].split('.')[0]}@demo"
            pu, _ = User.objects.get_or_create(
                username=portal_username, defaults={"email": f"{portal_username}.local"}
            )
            pu.email = f"{portal_username}.local"
            pu.first_name = customer.name.split()[0]
            pu.last_name = " ".join(customer.name.split()[1:])
            pu.role = User.Role.CUSTOMER
            pu.language = customer.preferred_language
            pu.customer = customer
            pu.branch = customer.branch
            pu.is_staff = False
            pu.set_password(content.DEMO_PASSWORD)
            pu.save()
            out[customer.pk] = pu

        self.counts["Portal users"] = len(out)
        return out

    def _seed_customers(self, branches, staff):
        creator = staff["admin@demo"]
        out = {}
        for email, name, company, tier, branch, language, phone, whatsapp in content.CUSTOMERS:
            customer, _ = Customer.objects.update_or_create(
                email=email,
                defaults={
                    "name": name,
                    "company": company,
                    "tier": tier,
                    "branch": branches[branch],
                    "preferred_language": language,
                    "phone": phone,
                    "whatsapp": whatsapp,
                    "created_by": creator,
                },
            )
            out[email] = customer

            for contact_name, position, is_primary in content.CONTACTS[email]:
                Contact.objects.update_or_create(
                    customer=customer,
                    name=contact_name,
                    defaults={
                        "position": position,
                        "is_primary": is_primary,
                        "email": f"{contact_name.split()[0].lower()}@"
                                 f"{email.split('@')[1]}",
                        "phone": f"+966 5{self.rng.randint(0, 9)} "
                                 f"{self.rng.randint(100, 999)} "
                                 f"{self.rng.randint(1000, 9999)}",
                    },
                )

            # Notes are keyed on their body, so a second run matches rather than
            # appends. Two notes per customer, drawn deterministically.
            note_bodies = self.rng.sample(content.CUSTOMER_NOTES, self.rng.randint(1, 2))
            for body in note_bodies:
                CustomerNote.objects.update_or_create(
                    customer=customer,
                    body=body,
                    defaults={"author": staff["manager@demo"]},
                )

        self.counts["Customers"] = len(out)
        self.counts["Contacts"] = Contact.objects.count()
        self.counts["Customer notes"] = CustomerNote.objects.count()
        return out

    # ------------------------------------------------------------------
    # Ticket taxonomy
    # ------------------------------------------------------------------

    def _seed_categories(self):
        out = {}
        for slug, name_en, name_ar, default_priority in content.CATEGORIES:
            obj, _ = Category.objects.update_or_create(
                slug=slug,
                defaults={
                    "name_en": name_en,
                    "name_ar": name_ar,
                    "default_priority": default_priority,
                },
            )
            out[slug] = obj
        self.counts["Ticket categories"] = len(out)
        return out

    def _seed_tags(self):
        out = {}
        for key, name_en, name_ar, color in content.TAGS:
            obj, _ = Tag.objects.update_or_create(
                name_en=name_en, defaults={"name_ar": name_ar, "color": color}
            )
            out[key] = obj
        self.counts["Tags"] = len(out)
        return out

    def _seed_sla_policies(self):
        """Keyed on (tier, priority) — the model's unique constraint — so story
        05's policy lookup returns exactly one row or none.
        """
        out = {}
        for name, tier, priority, first_min, res_min, escalate in content.SLA_POLICIES:
            obj, _ = SLAPolicy.objects.update_or_create(
                customer_tier=tier,
                priority=priority,
                defaults={
                    "name": name,
                    "first_response_minutes": first_min,
                    "resolution_minutes": res_min,
                    "escalate_at_percent": escalate,
                    "is_active": True,
                },
            )
            out[(tier, priority)] = obj
        self.counts["SLA policies"] = len(out)
        return out

    def _seed_canned_replies(self, categories):
        for shortcut, category_slug, title_en, title_ar, body_en, body_ar in \
                content.CANNED_REPLIES:
            CannedReply.objects.update_or_create(
                shortcut=shortcut,
                defaults={
                    "title_en": title_en,
                    "title_ar": title_ar,
                    "body_en": body_en,
                    "body_ar": body_ar,
                    "category": categories.get(category_slug),
                },
            )
        self.counts["Canned replies"] = CannedReply.objects.count()

    # ------------------------------------------------------------------
    # Knowledge base
    # ------------------------------------------------------------------

    def _seed_knowledge_base(self, staff):
        kb_categories = {}
        for slug, name_en, name_ar, order in content.KB_CATEGORIES:
            obj, _ = KBCategory.objects.update_or_create(
                slug=slug,
                defaults={"name_en": name_en, "name_ar": name_ar, "order": order},
            )
            kb_categories[slug] = obj

        authors = [staff["manager@demo"], staff["agent@demo"], staff["sara@demo"]]
        for i, (
            slug, category_slug, status, title_en, title_ar, body_en, body_ar
        ) in enumerate(content.KB_ARTICLES):
            KBArticle.objects.update_or_create(
                slug=slug,
                defaults={
                    "title_en": title_en,
                    "title_ar": title_ar,
                    "body_en": body_en,
                    "body_ar": body_ar,
                    "category": kb_categories[category_slug],
                    "status": status,
                    "author": authors[i % len(authors)],
                    "view_count": self.rng.randint(20, 900),
                    "helpful_count": self.rng.randint(2, 140),
                },
            )

        self.counts["KB categories"] = len(kb_categories)
        self.counts["KB articles"] = KBArticle.objects.count()

    # ------------------------------------------------------------------
    # Tickets
    # ------------------------------------------------------------------

    def _seed_tickets(self, *, staff, portal_users, customers, categories, tags,
                      policies, departments):
        agents = [u for u in staff.values() if u.role in ("agent", "manager")]
        customer_list = list(customers.values())
        tag_list = list(tags.values())
        watcher_pool = list(staff.values())

        message_count = 0
        event_count = 0
        csat_count = 0
        unassigned = 0

        for index in range(TICKET_COUNT):
            spec = self._ticket_spec(
                index, agents, customer_list, categories, policies, departments
            )
            number = f"TK-{index + 1:04d}"

            ticket, _created = Ticket.objects.get_or_create(
                number=number,
                defaults={"customer": spec["customer"], "subject": spec["subject"]},
            )

            # Every mutable column is rewritten, not just the ones that moved:
            # a re-run after an edit in the admin restores the demo state.
            for field, value in spec["fields"].items():
                setattr(ticket, field, value)
            ticket.save()
            # created_at is auto_now_add, so it cannot be assigned on save.
            # update() writes the column directly and bypasses it.
            Ticket.objects.filter(pk=ticket.pk).update(created_at=spec["created_at"])

            ticket.tags.set(spec["tags"] and self.rng.sample(tag_list, spec["tags"]) or [])
            ticket.watchers.set(
                self.rng.sample(watcher_pool, spec["watchers"]) if spec["watchers"] else []
            )

            if spec["fields"]["assignee"] is None:
                unassigned += 1

            # Children are rebuilt rather than appended. That is what keeps the
            # counts identical across runs while the timestamps stay relative to
            # a fresh `now`.
            ticket.messages.all().delete()
            ticket.events.all().delete()
            message_count += self._seed_thread(ticket, spec, portal_users, staff)
            event_count += self._seed_events(ticket, spec)

            if spec["csat"] is not None:
                CSATRating.objects.update_or_create(
                    ticket=ticket,
                    defaults={"score": spec["csat"][0], "comment": spec["csat"][1]},
                )
                csat_count += 1
            else:
                CSATRating.objects.filter(ticket=ticket).delete()

        self.counts["Tickets"] = Ticket.objects.count()
        self.counts["  · unassigned"] = unassigned
        self.counts["Ticket messages"] = message_count
        self.counts["Ticket events"] = event_count
        self.counts["CSAT ratings"] = csat_count

    def _ticket_spec(self, index, agents, customer_list, categories, policies, departments):
        """Everything random about one ticket, decided in one place.

        All RNG calls happen here and unconditionally, so the sequence is the
        same whether the ticket is being created or refreshed — that is what
        makes the second run produce identical data.
        """
        rng = self.rng
        now = self.now

        category_slug, subject, description = content.TICKET_SEEDS[
            index % len(content.TICKET_SEEDS)
        ]
        category = categories[category_slug]
        customer = customer_list[index % len(customer_list)]
        priority = PRIORITIES[index % len(PRIORITIES)]
        channel = CHANNELS[index % len(CHANNELS)]

        policy = policies[(customer.tier, priority)]
        response_minutes = policy.first_response_minutes
        resolution_minutes = policy.resolution_minutes

        kind = GUARANTEED.get(index)
        age_hours = int(HISTORY_DAYS * 24 * (rng.random() ** 1.5))
        status = self._pick_status(index, kind, age_hours / 24, rng)

        # created_at is derived from the SLA state we want, not the other way
        # round, for the pinned tickets — that is how "3 breached, 3 near breach"
        # stays true no matter when the command runs.
        if kind == "breached":
            overdue = timedelta(minutes=rng.randint(180, 4000))
            created_at = now - overdue - timedelta(minutes=resolution_minutes)
        elif kind == "near":
            remaining = timedelta(minutes=resolution_minutes * rng.uniform(0.02, 0.09))
            created_at = now + remaining - timedelta(minutes=resolution_minutes)
        elif kind == "escalated":
            created_at = now - timedelta(minutes=resolution_minutes * rng.uniform(0.92, 1.30))
        else:
            created_at = now - timedelta(hours=age_hours, minutes=rng.randint(0, 59))
            # A ticket that is still open cannot sit 60 days past a 24-hour
            # resolution target and be believable. Pull the open ones forward so
            # most of them are comfortable, leaving roughly one in eight to
            # breach naturally — the Breaching tab should not consist only of
            # the pinned tickets above.
            still_open = status in OPEN_STATUSES
            overdue_now = created_at + timedelta(minutes=resolution_minutes) < now
            if still_open and overdue_now:
                if rng.random() < 0.12:
                    factor = rng.uniform(1.02, 1.9)
                else:
                    factor = rng.uniform(0.05, 0.80)
                created_at = now - timedelta(minutes=resolution_minutes * factor)

        response_due = created_at + timedelta(minutes=response_minutes)
        resolution_due = created_at + timedelta(minutes=resolution_minutes)

        first_response_at = None
        if status != "new":
            first_response_at = min(
                created_at + timedelta(minutes=response_minutes * rng.uniform(0.1, 1.6)), now
            )

        resolved_at = closed_at = None
        if status in CLOSED_STATUSES:
            resolved_at = min(
                created_at + timedelta(minutes=resolution_minutes * rng.uniform(0.12, 1.20)),
                now,
            )
            if status == "closed":
                closed_at = min(resolved_at + timedelta(minutes=rng.randint(60, 2880)), now)

        response_breached = (
            first_response_at > response_due if first_response_at else response_due < now
        )
        resolution_breached = (
            resolved_at > resolution_due if resolved_at else resolution_due < now
        )

        escalation_level = 0
        escalated_at = None
        if status == "escalated" or kind == "escalated":
            escalation_level = rng.randint(1, 3)
            escalated_at = min(
                created_at + timedelta(
                    minutes=resolution_minutes * policy.escalate_at_percent / 100
                ),
                now,
            )

        # `new` is never assigned; half of the other live statuses are left
        # unassigned so story 07's Unassigned tab has rows. Resolved and closed
        # tickets always have an owner — a support queue where a third of the
        # closed work has no owner would not be believable.
        assignee = None
        assignment_reason = ""
        if status != "new" and not (status in ("open", "pending", "reopened") and rng.random() < 0.5):
            assignee = rng.choice(agents)
            assignment_reason = rng.choice(content.ASSIGNMENT_REASONS)

        csat = None
        if status in CLOSED_STATUSES and rng.random() < 0.6:
            score = rng.choices([5, 4, 3, 2, 1], weights=[46, 29, 12, 8, 5])[0]
            csat = (score, rng.choice(content.CSAT_COMMENTS))

        ai_summary = rng.choice(AI_SUMMARIES) if rng.random() < 0.25 else ""
        ai_suggested = (
            rng.choice(list(categories.values())) if rng.random() < 0.15 else None
        )

        n_tags = rng.randint(0, 3)
        n_watchers = rng.randint(0, 2)
        n_messages = rng.randint(1, 6)
        arabic_thread = customer.preferred_language == "ar"

        return {
            "customer": customer,
            "subject": subject,
            "created_at": created_at,
            "status": status,
            "tags": n_tags,
            "watchers": n_watchers,
            "messages": n_messages,
            "arabic": arabic_thread,
            "csat": csat,
            "resolved_at": resolved_at,
            "fields": {
                "subject": subject,
                "description": description,
                "customer": customer,
                "contact": customer.contacts.filter(is_primary=True).first(),
                "category": category,
                "priority": priority,
                "status": status,
                "channel": channel,
                "assignee": assignee,
                "assignment_reason": assignment_reason,
                "department": departments[CATEGORY_DEPARTMENT[category_slug]],
                "branch": customer.branch,
                "escalation_level": escalation_level,
                "escalated_at": escalated_at,
                "first_response_at": first_response_at,
                "resolved_at": resolved_at,
                "closed_at": closed_at,
                "sla_policy": policy,
                "sla_response_due_at": response_due,
                "sla_resolution_due_at": resolution_due,
                "sla_response_breached": response_breached,
                "sla_resolution_breached": resolution_breached,
                "ai_summary": ai_summary,
                "ai_suggested_category": ai_suggested,
            },
        }

    @staticmethod
    def _pick_status(index, kind, age_days, rng):
        if kind == "breached":
            return ("open", "pending", "on_hold", "open")[index % 4]
        if kind == "near":
            return "open"
        if kind == "escalated":
            return "escalated"
        # Tickets 11–26 walk every status twice, so full badge coverage does not
        # depend on the random draw below happening to hit all eight.
        if index < 11 + 2 * len(STATUSES):
            return STATUSES[(index - 11) % len(STATUSES)]
        if age_days > 14:
            return rng.choices(["closed", "resolved"], weights=[7, 3])[0]
        if age_days > 4:
            return rng.choices(
                ["closed", "resolved", "pending", "on_hold", "open"],
                weights=[30, 20, 15, 10, 25],
            )[0]
        return rng.choices(
            ["new", "open", "pending", "escalated", "reopened"],
            weights=[30, 30, 15, 10, 15],
        )[0]

    def _seed_thread(self, ticket, spec, portal_users, staff):
        """A public/internal mix, timestamped between creation and resolution."""
        rng = self.rng
        created_at = spec["created_at"]
        end = spec["resolved_at"] or self.now
        span = max((end - created_at).total_seconds(), 600)

        author_customer = portal_users.get(spec["customer"].pk)
        author_agent = ticket.assignee or staff["agent@demo"]

        rows = [(
            spec["fields"]["description"], False, ticket.channel, author_customer, 0.0
        )]
        for i in range(spec["messages"]):
            fraction = (i + 1) / (spec["messages"] + 1)
            if rng.random() < 0.28:
                rows.append((rng.choice(content.INTERNAL_NOTES), True, "web", author_agent, fraction))
            elif i % 2 == 0:
                rows.append((rng.choice(content.AGENT_REPLIES), False, ticket.channel,
                             author_agent, fraction))
            else:
                rows.append((rng.choice(content.CUSTOMER_REPLIES), False, ticket.channel,
                             author_customer, fraction))

        for body, is_internal, channel, author, fraction in rows:
            message = TicketMessage.objects.create(
                ticket=ticket,
                author=author,
                body=body,
                is_internal=is_internal,
                channel=channel,
            )
            stamp = created_at + timedelta(seconds=span * fraction)
            TicketMessage.objects.filter(pk=message.pk).update(
                created_at=min(stamp, self.now)
            )
        return len(rows)

    def _seed_events(self, ticket, spec):
        """The Activity log tab. Same backdating trick as the messages."""
        created_at = spec["created_at"]
        end = spec["resolved_at"] or self.now
        span = max((end - created_at).total_seconds(), 600)

        rows = [("created", "", "", ticket.status, 0.0)]
        if ticket.assignee:
            rows.append(("assigned", "assignee", "", ticket.assignee.username, 0.15))
        if ticket.status != "new":
            rows.append(("status_changed", "status", "new", "open", 0.2))
        if ticket.status not in ("new", "open"):
            rows.append(("status_changed", "status", "open", ticket.status, 0.75))
        if ticket.escalation_level:
            rows.append(
                ("escalated", "escalation_level", "0", str(ticket.escalation_level), 0.8)
            )
        rows.append(("message_added", "", "", f"{spec['messages'] + 1} messages", 0.9))

        actor = ticket.assignee
        for event_type, field, old, new, fraction in rows:
            event = TicketEvent.objects.create(
                ticket=ticket,
                actor=actor,
                event_type=event_type,
                field=field,
                old_value=old,
                new_value=new,
            )
            stamp = created_at + timedelta(seconds=span * fraction)
            TicketEvent.objects.filter(pk=event.pk).update(created_at=min(stamp, self.now))
        return len(rows)

    # ------------------------------------------------------------------
    # Report
    # ------------------------------------------------------------------

    def _report(self):
        now = self.now
        breached = Ticket.objects.filter(
            sla_resolution_due_at__lt=now, status__in=OPEN_STATUSES
        ).count()
        escalated = Ticket.objects.filter(status="escalated").count()
        near = sum(
            1
            for t in Ticket.objects.filter(
                status__in=OPEN_STATUSES, sla_resolution_due_at__gt=now
            ).select_related("sla_policy")
            if t.sla_policy
            and (t.sla_resolution_due_at - now).total_seconds()
            < 0.10 * t.sla_policy.resolution_minutes * 60
        )

        width = max(len(k) for k in self.counts) + 2
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Seeded"))
        for label, value in self.counts.items():
            self.stdout.write(f"  {label.ljust(width, '.')} {value}")

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("SLA spread (relative to now)"))
        self.stdout.write(f"  {'already breached'.ljust(width, '.')} {breached}")
        self.stdout.write(f"  {'within 10% of breach'.ljust(width, '.')} {near}")
        self.stdout.write(f"  {'escalated'.ljust(width, '.')} {escalated}")

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Demo logins"))
        self.stdout.write(f"  password for every account: {content.DEMO_PASSWORD}")
        for username, _f, _l, role, *_rest in content.STAFF[:3]:
            self.stdout.write(f"  {username.ljust(width)} {role}")
        self.stdout.write(f"  {content.CUSTOMER_LOGIN[0].ljust(width)} customer (portal)")
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("seed_demo complete."))
