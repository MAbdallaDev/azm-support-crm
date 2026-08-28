import { Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { useSummarize } from "@/api/ai";
import type { TicketDetail } from "@/api/types";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";

/**
 * The AI summary banner from Main.dc.html — the violet-tinted card above the
 * conversation.
 *
 * Three states the design implies and the story makes explicit:
 *
 *  - **Empty and never asked**: show the generate affordance, not an empty box.
 *    A blank banner looks broken; an inviting one explains itself.
 *  - **Generating**: a spinner in place of the action, so a second click
 *    cannot fire a second request.
 *  - **Failed**: a *dismissible* error. Silently swallowing the failure leaves
 *    an empty banner that looks like "this ticket has no summary", which is a
 *    different and wrong statement.
 *
 * Long summaries collapse to two lines behind *Show detail*, because this sits
 * above the conversation and must not push the first message off screen.
 */
export function AiSummaryBanner({ ticket }: { ticket: TicketDetail }) {
  const { t } = useTranslation();
  const summarize = useSummarize();
  const [expanded, setExpanded] = React.useState(false);
  const [dismissedError, setDismissedError] = React.useState(false);

  const summary = ticket.ai_summary;
  const generating = summarize.isPending;
  const failed = summarize.isError && !dismissedError;

  const run = () => {
    setDismissedError(false);
    summarize.mutate(ticket.id);
  };

  return (
    <section
      data-testid="ai-summary"
      className="flex items-start gap-3 rounded-[9px] border border-[#ddd8fb] bg-[#f6f4ff] px-3.5 py-3"
    >
      <Pill className="mt-[1px] flex-none bg-[#e5e0fc] text-[#4c37b5]">
        <Sparkles aria-hidden className="h-3 w-3" />
        {t("ai.summary")}
      </Pill>

      <div className="min-w-0 flex-1">
        {failed ? (
          <div className="flex items-start gap-2" role="alert">
            <p className="flex-1 text-[12.5px] leading-[1.55] text-priority-urgent">
              {t("ai.failed")}
            </p>
            <button
              type="button"
              onClick={() => setDismissedError(true)}
              className="flex-none text-priority-urgent hover:opacity-70"
              title={t("ai.dismiss")}
            >
              <X aria-hidden className="h-3.5 w-3.5" />
              <span className="sr-only">{t("ai.dismiss")}</span>
            </button>
          </div>
        ) : summary ? (
          <p
            data-testid="ai-summary-text"
            className={cn(
              "text-[12.5px] leading-[1.55] text-ink-2",
              !expanded && "line-clamp-2",
            )}
          >
            {summary}
          </p>
        ) : (
          <p className="text-[12.5px] leading-[1.55] text-muted-foreground">
            {generating ? t("ai.generating") : t("ai.empty")}
          </p>
        )}
      </div>

      <div className="flex flex-none items-center gap-3">
        {summary && !failed ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-[12px] font-semibold text-brand hover:text-brand-strong"
          >
            {expanded ? t("ai.hideDetail") : t("ai.showDetail")}
          </button>
        ) : null}

        <button
          type="button"
          onClick={run}
          disabled={generating}
          data-testid="ai-summary-generate"
          className="flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:text-brand-strong disabled:opacity-60"
        >
          {generating ? (
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw aria-hidden className="h-3.5 w-3.5" />
          )}
          {generating
            ? t("ai.generating")
            : summary
              ? t("ai.regenerate")
              : t("ai.generate")}
        </button>
      </div>
    </section>
  );
}
