import { AxiosError } from "axios";
import { ArrowLeft, Inbox, PanelRightOpen } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { useTicket } from "@/api/tickets";
import { TicketContext, TicketContextPanel } from "@/features/tickets/TicketContext";
import { TicketWorkspaceDetail } from "@/features/tickets/TicketDetail";
import { TicketQueue } from "@/features/tickets/TicketQueue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

/**
 * The three-pane agent workspace: queue left, conversation centre, context
 * right — `Main.dc.html`'s layout, at its own widths (300 / flex / 336).
 *
 * `/app/tickets` and `/app/tickets/:id` are the **same** component. The queue
 * must not unmount and refetch when a ticket is opened, and the selected row
 * is derived from the route param rather than local state, so selection
 * survives a refetch, a filter change and a page change.
 *
 * **Below `xl` (1280px) the context pane is not simply hidden.** `Main.dc.html`
 * has no responsive variant, and the fixed 300/flex/336 layout has no honest
 * way to fit three panes below that width — but the customer, SLA and
 * assignment information `TicketContext` carries is still needed at 1024px,
 * just reached through a toggle (`TicketContextPanel` in a `Dialog`) instead
 * of a permanently visible fourth-of-the-screen column.
 *
 * **Below `md` (768px) the queue and the detail pane are not shown
 * side-by-side at all.** A fixed 300px queue next to a detail pane that also
 * needs its own minimum width genuinely does not fit at 375px — there is no
 * honest way to compress a three-column workspace onto a phone screen, so it
 * becomes two full-width "pages" instead: the queue when nothing is selected,
 * the detail (with a "back to queue" link) once a ticket is open.
 */
export default function Tickets() {
  const { t } = useTranslation();
  const { id } = useParams();
  const ticketId = id ? Number(id) : null;
  const [contextOpen, setContextOpen] = React.useState(false);

  const { data: ticket, isPending, isError, error } = useTicket(ticketId);
  const notFound = isError && (error as AxiosError).response?.status === 404;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0">
      <TicketQueue
        selectedId={ticketId}
        className={cn(ticketId !== null && "hidden md:flex")}
      />

      {ticketId === null ? (
        <section className={cn("min-w-0 flex-1 items-center justify-center bg-background", "hidden md:flex")}>
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
          <div className="relative min-w-0 flex-1">
            <Link
              to="/app/tickets"
              className="flex items-center gap-1.5 border-b border-line px-4 py-2.5 text-[12.5px] font-semibold text-brand hover:text-brand-strong md:hidden"
              data-testid="back-to-queue"
            >
              <ArrowLeft aria-hidden className="h-3.5 w-3.5 rtl:-scale-x-100" />
              {t("tickets.queue")}
            </Link>
            <TicketWorkspaceDetail ticket={ticket} />
            <Button
              variant="outline"
              size="icon"
              className="absolute end-3 top-3 xl:hidden"
              onClick={() => setContextOpen(true)}
              title={t("context.customer")}
              data-testid="open-context-drawer"
            >
              <PanelRightOpen aria-hidden className="h-4 w-4" />
              <span className="sr-only">{t("context.customer")}</span>
            </Button>
          </div>
          <TicketContext ticket={ticket} />

          <Dialog open={contextOpen} onOpenChange={setContextOpen}>
            <DialogContent
              data-testid="context-drawer"
              className="flex max-h-[85vh] flex-col overflow-y-auto p-0 xl:hidden"
            >
              <DialogHeader className="px-[18px] pt-4">
                <DialogTitle className="sr-only">{t("context.customer")}</DialogTitle>
              </DialogHeader>
              <TicketContextPanel ticket={ticket} />
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
