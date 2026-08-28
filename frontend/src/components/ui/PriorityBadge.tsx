import { useTranslation } from "react-i18next";

import type { TicketPriority } from "@/api/types";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";

/** The `priority-*` theme tokens; see StatusBadge for why the map is literal. */
const CLASSES: Record<TicketPriority, string> = {
  low: "bg-priority-low-bg text-priority-low",
  normal: "bg-priority-normal-bg text-priority-normal",
  high: "bg-priority-high-bg text-priority-high",
  urgent: "bg-priority-urgent-bg text-priority-urgent",
};

export type PriorityBadgeProps = {
  priority: TicketPriority;
  className?: string;
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const { t } = useTranslation();

  return (
    <Pill className={cn(CLASSES[priority], className)} data-testid={`priority-${priority}`}>
      {t(`priority.${priority}`)}
    </Pill>
  );
}
