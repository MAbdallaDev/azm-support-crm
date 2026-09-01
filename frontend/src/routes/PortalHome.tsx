import { MessageSquare, Plus, Search, Star } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { useMe } from "@/api/auth";
import { usePortalTickets } from "@/api/portal";
import type { PortalTicket } from "@/api/types";
import { Button } from "@/components/ui/button";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useChatWidget } from "@/features/portal/ChatWidgetContext";
import { formatRelative } from "@/lib/format";
import { PORTAL_KB_CATEGORIES } from "@/lib/portalKbCategories";

/**
 * `/portal` — `PortalHome.dc.html`: a dark hero (personalized greeting, KB
 * search, the two request-starting actions) over the customer's own
 * tickets, split into open and closed.
 *
 * `PortalTicketSerializer.status`/`.channel` are the raw enum keys (`"open"`,
 * `"email"`), the same values `TicketListSerializer` exposes on the agent
 * side — not `get_..._display()` text, which is English-only regardless of
 * the customer's language and showed up as an orphaned English word under an
 * Arabic session during story 10's sweep. Rendered here via the same
 * `StatusBadge`/`ChannelBadge` the agent queue uses, not a second colour map.
 *
 * The four chips below the hero search box are real category filters
 * (`?category=<slug>` into `/portal/kb`, matching the agent-side KB
 * browser's own `category` param) — see `lib/portalKbCategories.ts`.
 */

const CLOSED_STATUSES = new Set(["resolved", "closed"]);
const RATEABLE_STATUSES = new Set(["resolved", "closed"]);
const CLOSED_PAGE_SIZE = 5;

function TicketRow({ ticket }: { ticket: PortalTicket }) {
  const { t } = useTranslation();
  const rateable = RATEABLE_STATUSES.has(ticket.status);

  return (
    <Link
      to={`/portal/tickets/${ticket.id}`}
      className="block border-b border-line-2 px-4 py-3.5 last:border-b-0 hover:bg-surface-2"
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{ticket.subject}</span>
        <StatusBadge status={ticket.status} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
        <span className="mono-ltr">{ticket.number}</span>
        <span>·</span>
        <ChannelBadge channel={ticket.channel} />
        <span>·</span>
        <span>
          {CLOSED_STATUSES.has(ticket.status)
            ? t("portal.closedRelative", { when: formatRelative(ticket.resolved_at ?? ticket.created_at) })
            : t("portal.openedRelative", { when: formatRelative(ticket.created_at) })}
        </span>
        {CLOSED_STATUSES.has(ticket.status) ? (
          <>
            <span>·</span>
            {ticket.csat ? (
              <span className="inline-flex items-center gap-1 font-medium text-ink-2">
                {t("portal.youRated", { score: ticket.csat.score })}
                <Star aria-hidden className="h-3 w-3 fill-current" />
              </span>
            ) : rateable ? (
              <span className="font-semibold text-brand">{t("portal.rateThis")}</span>
            ) : null}
          </>
        ) : null}
      </div>
    </Link>
  );
}

export default function PortalHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [showAllClosed, setShowAllClosed] = React.useState(false);

  const { data: me } = useMe();
  const { data, isPending, isError, refetch } = usePortalTickets(new URLSearchParams({ page_size: "100" }));
  const tickets = data?.results ?? [];
  const open = tickets.filter((ticket) => !CLOSED_STATUSES.has(ticket.status));
  const closed = tickets.filter((ticket) => CLOSED_STATUSES.has(ticket.status));
  const visibleClosed = showAllClosed ? closed : closed.slice(0, CLOSED_PAGE_SIZE);

  const { openChat } = useChatWidget();

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    navigate(query ? `/portal/kb?q=${encodeURIComponent(query)}` : "/portal/kb");
  };

  const onCategoryShortcut = (slug: string) => navigate(`/portal/kb?category=${encodeURIComponent(slug)}`);

  const firstName = me?.full_name?.split(" ")[0];

  return (
    <section>
      <div className="rounded-xl bg-ink px-7 py-6 text-white">
        <h1 className="text-[22px] font-bold tracking-[-0.01em]">
          {firstName ? t("portal.heroTitleNamed", { name: firstName }) : t("portal.heroTitle")}
        </h1>
        <p className="mt-1.5 text-[13px] text-faint">{t("portal.heroSubtitle")}</p>

        <form onSubmit={onSearch} className="mt-4 flex flex-wrap gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute start-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("portal.searchHelp")}
              aria-label={t("portal.searchHelp")}
              data-testid="portal-kb-search"
              className="h-[42px] w-full rounded-[9px] border-0 bg-white ps-9 pe-3 text-[13px] text-ink outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-[42px] flex-none border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            data-testid="start-live-chat"
            onClick={openChat}
          >
            <MessageSquare aria-hidden className="h-4 w-4" />
            {t("portal.startLiveChat")}
          </Button>
          <Button type="submit" variant="outline" className="h-[42px] flex-none border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
            {t("common.search")}
          </Button>
          <Button asChild className="h-[42px] flex-none" data-testid="submit-request">
            <Link to="/portal/new">
              <Plus aria-hidden className="h-4 w-4" />
              {t("portal.submitRequest")}
            </Link>
          </Button>
        </form>

        <div className="mt-3.5 flex flex-wrap gap-2">
          {PORTAL_KB_CATEGORIES.map(({ slug, labelKey }) => (
            <button
              key={slug}
              type="button"
              onClick={() => onCategoryShortcut(slug)}
              className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-[#c9cfda] hover:bg-white/15"
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-priority-urgent/30 bg-priority-urgent-bg px-3.5 py-2.5 text-[12.5px] font-medium text-priority-urgent"
        >
          <span>{t("portal.loadFailed")}</span>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t("auth.retry")}
          </Button>
        </div>
      ) : null}

      <div className="mt-6 rounded-[9px] border border-line bg-background">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[13.5px] font-bold">
            {t("portal.openTickets")}
            {!isPending ? (
              <span className="ms-1.5 rounded-full bg-surface-3 px-[6px] py-[1px] text-[10px] font-semibold text-muted-foreground">
                {open.length}
              </span>
            ) : null}
          </h2>
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
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[13.5px] font-bold">
            {t("portal.closedTickets")}
            {!isPending ? (
              <span className="ms-1.5 rounded-full bg-surface-3 px-[6px] py-[1px] text-[10px] font-semibold text-muted-foreground">
                {closed.length}
              </span>
            ) : null}
          </h2>
          {!showAllClosed && closed.length > CLOSED_PAGE_SIZE ? (
            <button
              type="button"
              data-testid="view-all-closed"
              onClick={() => setShowAllClosed(true)}
              className="text-[12px] font-semibold text-brand hover:text-brand-strong"
            >
              {t("portal.viewAll", { count: closed.length })}
            </button>
          ) : null}
        </div>
        {isPending ? null : closed.length === 0 ? (
          <EmptyState title={t("portal.noClosedTickets")} description="" />
        ) : (
          <div>
            {visibleClosed.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
