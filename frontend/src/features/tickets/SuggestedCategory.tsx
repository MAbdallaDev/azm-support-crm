import { Check, Loader2, Sparkles } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { useCategorize } from "@/api/ai";
import { useApplyCategory, useCategories } from "@/api/tickets";
import type { AiCategorySuggestion, TicketDetail } from "@/api/types";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";

/**
 * The fifth AI-panel card — same violet shell as `AiSummaryBanner` and
 * `SuggestedSolutions`, closing the one AI feature from the brief
 * ("auto-categorize") that had a working, tested backend endpoint
 * (`/ai/categorize/`) but no way for an agent to ever see or use it.
 *
 * Two separate steps, on purpose: `useCategorize` only ever writes
 * `ai_suggested_category` on the ticket (the suggestion), never `category`
 * itself — the same "an agent always approves" rule `AiSummaryBanner` and
 * `SuggestedSolutions` already hold. Applying it is the agent's own, explicit
 * click, via `useApplyCategory`.
 *
 * `/ai/categorize/` returns only a `category_id` — not the full `Category`
 * shape (name_en/name_ar) the card needs to render — so a fresh suggestion is
 * resolved against `useCategories()` (already the reference list every other
 * category picker in the workspace uses) rather than waiting on a second
 * round trip to refetch the ticket detail. A suggestion from an *earlier*
 * session still shows from `ticket.ai_suggested_category` — the one field the
 * endpoint does persist — once a fresh one hasn't been generated here yet.
 */
export function SuggestedCategory({ ticket }: { ticket: TicketDetail }) {
  const { t } = useTranslation();
  const categorize = useCategorize();
  const apply = useApplyCategory();
  const { data: categories } = useCategories();
  const [lastResult, setLastResult] = React.useState<AiCategorySuggestion | null>(null);

  const freshSuggestion = lastResult
    ? (categories ?? []).find((category) => category.id === lastResult.category_id) ?? null
    : null;
  const suggestion = freshSuggestion ?? ticket.ai_suggested_category;
  const generating = categorize.isPending;
  const matchesCurrent = suggestion !== null && suggestion.id === ticket.category?.id;

  const run = () => categorize.mutate(ticket.id, { onSuccess: setLastResult });

  const applySuggestion = () => {
    if (!suggestion) return;
    apply.mutate(
      { id: ticket.id, category: suggestion },
      {
        onSuccess: () => toast.success(t("ai.categoryApplied")),
        onError: () => toast.error(t("ai.categoryApplyFailed")),
      },
    );
  };

  return (
    <section
      data-testid="suggested-category"
      className="flex items-start gap-3 rounded-[9px] border border-[#ddd8fb] bg-[#f6f4ff] px-3.5 py-3"
    >
      <Pill className="mt-[1px] flex-none bg-[#e5e0fc] text-[#4c37b5]">
        <Sparkles aria-hidden className="h-3 w-3" />
        {t("ai.category")}
      </Pill>

      <div className="min-w-0 flex-1">
        {categorize.isError ? (
          <p className="text-[12.5px] leading-[1.55] text-priority-urgent">
            {t("ai.categoryFailed")}
          </p>
        ) : !suggestion ? (
          <p className="text-[12.5px] leading-[1.55] text-muted-foreground">
            {generating ? t("ai.generating") : t("ai.categoryEmpty")}
          </p>
        ) : matchesCurrent ? (
          <p className="flex items-center gap-1.5 text-[12.5px] leading-[1.55] text-ink-2">
            <Check aria-hidden className="h-3.5 w-3.5 flex-none text-emerald-600" />
            {t("ai.categoryMatchesCurrent", { name: suggestion.name_en })}
          </p>
        ) : (
          <p data-testid="suggested-category-text" className="text-[12.5px] leading-[1.55] text-ink-2">
            <span className="font-semibold">{suggestion.name_en}</span>
            {lastResult ? (
              <span className="text-muted-foreground">
                {" "}
                {t("ai.categoryConfidence", { percent: Math.round(lastResult.confidence * 100) })}
              </span>
            ) : null}
            {ticket.category ? (
              <span className="block text-muted-foreground">
                {t("ai.categoryCurrent", { name: ticket.category.name_en })}
              </span>
            ) : null}
            {lastResult?.rationale ? (
              <span className="block text-muted-foreground">{lastResult.rationale}</span>
            ) : null}
          </p>
        )}
      </div>

      <div className="flex flex-none items-center gap-3">
        {suggestion && !matchesCurrent ? (
          <button
            type="button"
            onClick={applySuggestion}
            disabled={apply.isPending}
            data-testid="suggested-category-apply"
            className="flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:text-brand-strong disabled:opacity-60"
          >
            {apply.isPending ? (
              <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {t("ai.categoryApply")}
          </button>
        ) : null}

        <button
          type="button"
          onClick={run}
          disabled={generating}
          data-testid="suggested-category-generate"
          className="flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:text-brand-strong disabled:opacity-60"
        >
          {generating ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : null}
          {t("ai.categoryGenerate")}
        </button>
      </div>
    </section>
  );
}
