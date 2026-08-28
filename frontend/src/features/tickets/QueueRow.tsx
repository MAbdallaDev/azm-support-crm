import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { TicketListRow } from "@/api/types";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { SlaBar } from "@/components/ui/SlaBar";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * One queue row, exactly the fields Main.dc.html draws: priority, number,
 * channel, age; then the subject; then customer and the live countdown.
 *
 * The selected row is `bg-surface-3` plus `border-inline-start: 3px` — the
 * artboard's own rule, and **inline-start** rather than left, so the marker
 * moves to the correct edge in Arabic with no extra logic.
 *
 * Selection is derived from the route, not from local state: a refetch, a page
 * change or a filter change must not clear the highlight on the ticket the
 * agent is reading.
 */
export function QueueRow({
  ticket,
  selected,
  to,
}: {
  ticket: TicketListRow;
  selected: boolean;
  to: string;
}) {
  const { t } = useTranslation();

  return (
    <Link
      to={to}
      aria-current={selected ? "true" : undefined}
      data-testid={`queue-row-${ticket.id}`}
      className={cn(
        "block cursor-pointer border-b border-line-2 px-4 py-[13px] hover:bg-surface-2",
        selected && "border-s-[3px] border-s-ink bg-surface-3 ps-[13px]",
      )}
    >
      <div className="flex items-center gap-1.5">
        <PriorityBadge priority={ticket.priority} />
        <span className="mono-ltr text-[11px] text-muted-foreground">{ticket.number}</span>
        <ChannelBadge channel={ticket.channel} />
        <span className="flex-1" />
        <span className="text-[11px] text-faint">{formatRelative(ticket.created_at)}</span>
      </div>

      <p className="mt-2 line-clamp-2 text-[13.5px] font-semibold leading-[1.4]">
        {ticket.subject}
      </p>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-[11.5px] text-muted-foreground">
          {ticket.customer_name}
        </span>
        {/* compact: the countdown alone, no bar — the row has no space for one,
            but it is the same component and therefore the same colour rule as
            the detail pane's full bar. */}
        <SlaBar sla={ticket.resolution_sla} compact />
      </div>

      <span className="sr-only">{t(`status.${ticket.status}`)}</span>
    </Link>
  );
}
