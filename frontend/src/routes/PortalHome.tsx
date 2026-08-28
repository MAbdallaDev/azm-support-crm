import { Plus, Search } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { usePortalTickets } from "@/api/portal";
import type { PortalTicket } from "@/api/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";

/**
 * `/portal` — `PortalHome.dc.html`: the customer's own tickets, open and
 * closed, a prominent submit action, and a KB search box.
 *
 * A closed status here is whatever `PortalTicketSerializer.status` (a
 * `get_status_display` string, e.g. "Resolved" or "Closed") reports — open vs
 * closed is decided on that text rather than on the raw enum key the portal
 * serializer deliberately never exposes.
 */

const CLOSED_LABELS = new Set(["Resolved", "Closed"]);

function TicketRow({ ticket }: { ticket: PortalTicket }) {
  return (
    <Link
      to={`/portal/tickets/${ticket.id}`}
      className="flex items-center gap-3 border-b border-line-2 px-4 py-3 hover:bg-surface-2"
    >
      <span className="mono-ltr w-[76px] flex-none text-[11px] text-muted-foreground">{ticket.number}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{ticket.subject}</span>
      <span className="hidden w-[110px] flex-none text-[11.5px] text-muted-foreground sm:block">
        {formatDate(ticket.created_at)}
      </span>
      <Pill className="bg-surface-3 text-slate-600">{ticket.status}</Pill>
      {/* `ticket.channel` is already `get_channel_display()`'s text ("Portal",
          "Email"), not an enum key — there is no `channel.<key>` to look up,
          so this renders the server's own string rather than mistranslating it. */}
      <span className="hidden text-[11px] text-muted-foreground md:block">{ticket.channel}</span>
    </Link>
  );
}

export default function PortalHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");

  const { data, isPending } = usePortalTickets(new URLSearchParams({ page_size: "100" }));
  const tickets = data?.results ?? [];
  const open = tickets.filter((ticket) => !CLOSED_LABELS.has(ticket.status));
  const closed = tickets.filter((ticket) => CLOSED_LABELS.has(ticket.status));

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    navigate(query ? `/portal/kb?q=${encodeURIComponent(query)}` : "/portal/kb");
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-bold tracking-[-0.01em]">{t("portal.home")}</h1>
        <Button asChild data-testid="submit-request">
          <Link to="/portal/new">
            <Plus aria-hidden className="h-4 w-4" />
            {t("portal.submitRequest")}
          </Link>
        </Button>
      </div>

      <form onSubmit={onSearch} className="mt-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("portal.searchHelp")}
            aria-label={t("portal.searchHelp")}
            data-testid="portal-kb-search"
            className="h-10 w-full rounded-lg border border-line bg-background ps-9 pe-3 text-[13px] outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button type="submit" variant="outline">{t("common.search")}</Button>
      </form>

      <div className="mt-6 rounded-[9px] border border-line bg-background">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[13.5px] font-bold">{t("portal.openTickets")}</h2>
        </div>
        {isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        ) : open.length === 0 ? (
          <EmptyState title={t("portal.noOpenTickets")} description={t("portal.noOpenTicketsBody")} />
        ) : (
          <div>
            {open.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-[9px] border border-line bg-background">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[13.5px] font-bold">{t("portal.closedTickets")}</h2>
        </div>
        {isPending ? null : closed.length === 0 ? (
          <EmptyState title={t("portal.noClosedTickets")} description="" />
        ) : (
          <div>
            {closed.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
