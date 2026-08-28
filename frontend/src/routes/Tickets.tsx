import { AxiosError } from "axios";
import { Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import { useTicket } from "@/api/tickets";
import { TicketContext } from "@/features/tickets/TicketContext";
import { TicketWorkspaceDetail } from "@/features/tickets/TicketDetail";
import { TicketQueue } from "@/features/tickets/TicketQueue";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The three-pane agent workspace: queue left, conversation centre, context
 * right — `Main.dc.html`'s layout, at its own widths (300 / flex / 336).
 *
 * `/app/tickets` and `/app/tickets/:id` are the **same** component. The queue
 * must not unmount and refetch when a ticket is opened, and the selected row
 * is derived from the route param rather than local state, so selection
 * survives a refetch, a filter change and a page change.
 */
export default function Tickets() {
  const { t } = useTranslation();
  const { id } = useParams();
  const ticketId = id ? Number(id) : null;

  const { data: ticket, isPending, isError, error } = useTicket(ticketId);
  const notFound = isError && (error as AxiosError).response?.status === 404;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0">
      <TicketQueue selectedId={ticketId} />

      {ticketId === null ? (
        <section className="flex min-w-0 flex-1 items-center justify-center bg-background">
          <EmptyState
            icon={Inbox}
            title={t("tickets.selectTitle")}
            description={t("tickets.selectBody")}
          />
        </section>
      ) : isPending ? (
        <section className="min-w-0 flex-1 space-y-4 bg-background p-6" data-testid="detail-skeleton">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </section>
      ) : isError || !ticket ? (
        <section className="flex min-w-0 flex-1 items-center justify-center bg-background">
          {/* 404 means out of scope, which story 03 returns instead of 403 on
              purpose — "not available" is the honest wording for both. */}
          <EmptyState
            title={t(notFound ? "tickets.notFound" : "tickets.loadError")}
            description=""
          />
        </section>
      ) : (
        <>
          <TicketWorkspaceDetail ticket={ticket} />
          <TicketContext ticket={ticket} />
        </>
      )}
    </div>
  );
}
