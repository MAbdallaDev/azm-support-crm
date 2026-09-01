import { MessageSquare, Plus, Search } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { usePortalTickets, useSubmitPortalTicket } from "@/api/portal";
import type { PortalTicket } from "@/api/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";

/**
 * `/portal` — `PortalHome.dc.html`: the customer's own tickets, open and
 * closed, a prominent submit action, and a KB search box.
 *
 * `PortalTicketSerializer.status`/`.channel` are the raw enum keys (`"open"`,
 * `"email"`), the same values `TicketListSerializer` exposes on the agent
 * side — not `get_..._display()` text, which is English-only regardless of
 * the customer's language and showed up as an orphaned English word under an
 * Arabic session during story 10's sweep. Translated here via the existing
 * `status.*`/`channel.*` keys instead.
 */

const CLOSED_STATUSES = new Set(["resolved", "closed"]);

function TicketRow({ ticket }: { ticket: PortalTicket }) {
  const { t } = useTranslation();
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
      <Pill className="bg-surface-3 text-slate-600">{t(`status.${ticket.status}`)}</Pill>
      <span className="hidden text-[11px] text-muted-foreground md:block">{t(`channel.${ticket.channel}`)}</span>
    </Link>
  );
}

export default function PortalHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");

  const { data, isPending, isError, refetch } = usePortalTickets(new URLSearchParams({ page_size: "100" }));
  const tickets = data?.results ?? [];
  const open = tickets.filter((ticket) => !CLOSED_STATUSES.has(ticket.status));
  const closed = tickets.filter((ticket) => CLOSED_STATUSES.has(ticket.status));

  const submitChat = useSubmitPortalTicket();

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    navigate(query ? `/portal/kb?q=${encodeURIComponent(query)}` : "/portal/kb");
  };

  const onStartLiveChat = () => {
    const existing = open.find((ticket) => ticket.channel === "chat");
    if (existing) {
      navigate(`/portal/tickets/${existing.id}`);
      return;
    }
    submitChat.mutate(
      {
        subject: t("portal.liveChatSubject"),
        description: t("portal.liveChatSubject"),
        category: null,
        channel: "chat",
        attachments: [],
      },
      {
        onSuccess: (created) => navigate(`/portal/tickets/${created.id}`),
        onError: () => toast.error(t("portal.submitFailed")),
      },
    );
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-bold tracking-[-0.01em]">{t("portal.home")}</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            data-testid="start-live-chat"
            onClick={onStartLiveChat}
            disabled={submitChat.isPending}
          >
            <MessageSquare aria-hidden className="h-4 w-4" />
            {t("portal.startLiveChat")}
          </Button>
          <Button asChild data-testid="submit-request">
            <Link to="/portal/new">
              <Plus aria-hidden className="h-4 w-4" />
              {t("portal.submitRequest")}
            </Link>
          </Button>
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
