import * as React from "react";
import { useTranslation } from "react-i18next";

import type { Sla, SlaState } from "@/api/types";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The SLA block from DesignSystem.dc.html: a label, a signed countdown and a
 * 5px progress bar.
 *
 * **The prop is the API object, verbatim.** `response_sla` / `resolution_sla`
 * come off the ticket detail already shaped like this, so story 07 writes
 * `<SlaBar sla={ticket.response_sla} />` — no adapter, and no second place
 * where a rename between the serializer and the component could drift.
 *
 * `seconds_remaining` is **signed**: the sign chooses the sentence
 * ("2h left" vs "Breached 14m"), the magnitude fills it in.
 *
 * The countdown ticks on **its own interval**, not a page-level refetch. Fifty
 * of these in a queue each re-render a 40px box once a second; one page-level
 * timer would re-render fifty rows of ticket content instead.
 */

const TEXT: Record<SlaState, string> = {
  ok: "text-sla-ok",
  approaching: "text-sla-approaching",
  breached: "text-sla-breached",
};

const FILL: Record<SlaState, string> = {
  ok: "bg-sla-ok-fill",
  approaching: "bg-sla-approaching-fill",
  breached: "bg-sla-breached-fill",
};

export type SlaBarProps = {
  sla: Sla;
  /** "Response" / "Resolution". Falls back to the policy name. */
  label?: string;
  className?: string;
};

export function SlaBar({ sla, label, className }: SlaBarProps) {
  const { t } = useTranslation();
  const { state, seconds_remaining, target_minutes, policy_name } = sla;

  /*
   * Seconds elapsed since this value arrived, counted locally. Keeping a
   * delta rather than a mutable copy of `seconds_remaining` means a refetch
   * that delivers a fresh number wins immediately, instead of the two
   * fighting over which is authoritative.
   */
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    setElapsed(0);
    if (seconds_remaining === null) return;

    const id = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [seconds_remaining]);

  if (seconds_remaining === null || target_minutes === null) {
    return (
      <div className={cn("text-[12px] text-muted-foreground", className)} data-testid="sla-none">
        {t("sla.none")}
      </div>
    );
  }

  const remaining = seconds_remaining - elapsed;
  const breached = remaining < 0;
  // The server's `state` is authoritative for colour; only a live crossover
  // into negative territory overrides it, so the badge and the bar agree.
  const effective: SlaState = breached ? "breached" : state;

  const targetSeconds = Math.max(1, target_minutes * 60);
  const consumed = ((targetSeconds - remaining) / targetSeconds) * 100;
  const percent = Math.min(100, Math.max(0, consumed));

  return (
    <div className={cn("w-full", className)} data-testid={`sla-${effective}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12.5px] font-semibold">
          {label || policy_name || t(`sla.${effective}`)}
        </span>
        <span className={cn("text-[12px] font-bold", TEXT[effective])}>
          {breached
            ? t("sla.over", { duration: formatDuration(remaining) })
            : t("sla.left", { duration: formatDuration(remaining) })}
        </span>
      </div>
      <div
        className="mt-2 h-[5px] overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-label={policy_name || t(`sla.${effective}`)}
      >
        <div
          className={cn("h-full rounded-full transition-[width]", FILL[effective])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
