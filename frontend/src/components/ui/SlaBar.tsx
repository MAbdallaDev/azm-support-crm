import * as React from "react";
import { useTranslation } from "react-i18next";

import type { Sla, SlaState } from "@/api/types";
import { formatDuration } from "@/lib/format";
import { useSecondsTick } from "@/lib/ticker";
import { cn } from "@/lib/utils";

/**
 * The SLA block from DesignSystem.dc.html: a label, a signed countdown and a
 * 5px progress bar.
 *
 * **The prop is the API object, verbatim.** `response_sla` / `resolution_sla`
 * come off the ticket already shaped like this — on the detail *and*, since
 * story 07, on every queue row — so a caller writes
 * `<SlaBar sla={ticket.response_sla} />` with no adapter, and no rename can
 * drift between the serializer and the component.
 *
 * `seconds_remaining` is **signed**: the sign chooses the sentence
 * ("2h left" vs "Breached 14m"), the magnitude fills it in.
 *
 * Ticking changed in story 07: the countdown now reads a single app-wide
 * interval (`useSecondsTick`) instead of owning one each. Story 06's reason for
 * a per-component timer — fifty rows must not re-render a page every second —
 * still holds, and still does: `useSyncExternalStore` wakes only the
 * components that subscribed, so one timer drives fifty independent boxes.
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
  /** "First response" / "Resolution". Falls back to the policy name. */
  label?: string;
  /** Countdown only, for a dense queue row. */
  compact?: boolean;
  className?: string;
};

export function SlaBar({ sla, label, compact = false, className }: SlaBarProps) {
  const { t } = useTranslation();

  // Split so a ticket with no policy never subscribes to the ticker at all —
  // which is what keeps "no timer on a screen with no countdowns" true.
  if (sla.seconds_remaining === null || sla.target_minutes === null) {
    return (
      <span
        className={cn("text-[12px] text-muted-foreground", className)}
        data-testid="sla-none"
      >
        {t("sla.none")}
      </span>
    );
  }

  return <LiveSlaBar sla={sla} label={label} compact={compact} className={className} />;
}

function LiveSlaBar({ sla, label, compact, className }: SlaBarProps) {
  const { t } = useTranslation();
  const { state, seconds_remaining, target_minutes, policy_name } = sla;

  const tick = useSecondsTick();

  /*
   * Elapsed is a **delta** against the tick at which this value arrived, not a
   * mutable copy of `seconds_remaining`. That is what makes a refetch win
   * immediately: a fresh number re-anchors, rather than the two fighting over
   * which is authoritative.
   *
   * Re-anchoring happens during render rather than in an effect, because an
   * effect runs one render too late — the first frame after a refetch would
   * show the new value minus the old elapsed, a visible jump backwards.
   */
  const anchor = React.useRef({ value: seconds_remaining, tick });
  if (anchor.current.value !== seconds_remaining) {
    anchor.current = { value: seconds_remaining, tick };
  }
  const elapsed = tick - anchor.current.tick;

  const remaining = (seconds_remaining ?? 0) - elapsed;
  const breached = remaining < 0;
  // The server's `state` is authoritative for colour; only a live crossover
  // into negative territory overrides it, so the badge and the bar agree.
  const effective: SlaState = breached ? "breached" : state;

  const targetSeconds = Math.max(1, (target_minutes ?? 1) * 60);
  const consumed = ((targetSeconds - remaining) / targetSeconds) * 100;
  const percent = Math.min(100, Math.max(0, consumed));

  const countdown = breached
    ? t("sla.over", { duration: formatDuration(remaining) })
    : t("sla.left", { duration: formatDuration(remaining) });

  if (compact) {
    return (
      <span
        data-testid={`sla-${effective}`}
        className={cn("text-[11.5px] font-semibold", TEXT[effective], className)}
      >
        {countdown}
      </span>
    );
  }

  return (
    <div className={cn("w-full", className)} data-testid={`sla-${effective}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12.5px] font-semibold">
          {label ?? policy_name ?? t(`sla.${effective}`)}
        </span>
        <span className={cn("text-[12px] font-bold", TEXT[effective])}>{countdown}</span>
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
      {target_minutes ? (
        <p className="mt-[7px] text-[11px] text-muted-foreground">
          {t("sla.target", { duration: formatDuration(target_minutes * 60) })}
          {policy_name ? ` · ${policy_name}` : ""}
        </p>
      ) : null}
    </div>
  );
}
