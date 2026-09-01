"""`manage.py check_sla_breaches` — the SLA breach notification's only writer.

Odoo mental map: `ir.cron` — a periodic job, not something a request calls.
This is the one place in the codebase allowed to turn a lazily-derived SLA
state into a written side effect: `sla_service`'s "no scheduler" rule governs
*state* (breach is always recomputed from the stored due timestamps, never
cached in a column this command would need to keep in sync), not *whether a
notification gets sent*. A notification is inherently an event at a point in
time, and nothing about a GET request "causes" a breach — so unlike breach
state itself, there is no honest way to derive it lazily. A periodic sweep is
the honest alternative to a lossy check bolted onto an unrelated write.

Nothing in this project runs this on a schedule — there is no Celery beat, no
cron container. Wiring an actual `cron`/`systemd timer` entry to run
`python manage.py check_sla_breaches` every few minutes is deployment
configuration, out of scope for this repository. Until that exists, this is a
manually-triggered sweep.
"""

from django.core.management.base import BaseCommand

from apps.accounts.notifications import notify_sla_breach
from apps.tickets.models import Ticket
from apps.tickets.services.sla_service import breached_q


class Command(BaseCommand):
    help = "Send an SLA-breach notification for every currently-breached, assigned ticket that hasn't had one yet."

    def handle(self, *args, **options):
        candidates = list(
            Ticket.objects.filter(breached_q())
            .exclude(assignee__isnull=True)
            .select_related("assignee")
        )

        sent = sum(1 for ticket in candidates if notify_sla_breach(ticket))

        self.stdout.write(
            f"check_sla_breaches: {sent} notification(s) sent, {len(candidates)} ticket(s) breached"
        )
