import { useTranslation } from "react-i18next";

import type { TicketStatus } from "@/api/types";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";

/**
 * All eight `Status` choices from `apps/tickets/models.py`, coloured per the
 * status swatch row in DesignSystem.dc.html.
 *
 * The map is written out rather than interpolated (`bg-status-${status}-bg`)
 * because Tailwind scans source text for literal class names — a template
 * string compiles to no CSS at all, and the badge renders unstyled.
 */
const CLASSES: Record<TicketStatus, string> = {
  new: "bg-status-new-bg text-status-new",
  open: "bg-status-open-bg text-status-open",
  pending: "bg-status-pending-bg text-status-pending",
  on_hold: "bg-status-on_hold-bg text-status-on_hold",
  escalated: "bg-status-escalated-bg text-status-escalated",
  resolved: "bg-status-resolved-bg text-status-resolved",
  closed: "bg-status-closed-bg text-status-closed",
  reopened: "bg-status-reopened-bg text-status-reopened",
};

export type StatusBadgeProps = {
  status: TicketStatus;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation();

  return (
    <Pill className={cn(CLASSES[status], className)} data-testid={`status-${status}`}>
      {t(`status.${status}`)}
    </Pill>
  );
}
