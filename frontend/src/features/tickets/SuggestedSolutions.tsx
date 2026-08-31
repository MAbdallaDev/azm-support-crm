import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useSuggestedSolutions } from "@/api/ai";
import type { TicketDetail } from "@/api/types";
import { Pill } from "@/components/ui/pill";
import { formatRelative } from "@/lib/format";

/**
 * The fourth AI-panel card, structural and visual twin of `AiSummaryBanner`:
 * same violet card, same click-to-generate pattern, three states (never
 * asked / has results / fetched-but-empty). Unlike the summary card this one
 * is read-only — `useSuggestedSolutions` is a `useQuery`, not a mutation,
 * fired by `refetch()` rather than `mutate()` — but the UX is deliberately
 * identical so it reads as the fourth item in one family, not a bolt-on.
 */
export function SuggestedSolutions({ ticket }: { ticket: TicketDetail }) {
  const { t } = useTranslation();
  const { data, isFetching, isFetched, refetch } = useSuggestedSolutions(ticket.id);

  const solutions = data?.solutions ?? [];

  return (
    <section
      data-testid="suggested-solutions"
      className="flex items-start gap-3 rounded-[9px] border border-[#ddd8fb] bg-[#f6f4ff] px-3.5 py-3"
    >
      <Pill className="mt-[1px] flex-none bg-[#e5e0fc] text-[#4c37b5]">
        <Sparkles aria-hidden className="h-3 w-3" />
        {t("ai.suggestedSolutions")}
      </Pill>

      <div className="min-w-0 flex-1">
        {!isFetched ? (
          <p className="text-[12.5px] leading-[1.55] text-muted-foreground">
            {isFetching ? t("ai.generating") : t("ai.suggestedSolutionsEmpty")}
          </p>
        ) : solutions.length === 0 ? (
          <p className="text-[12.5px] leading-[1.55] text-muted-foreground">
            {t("ai.suggestedSolutionsEmpty")}
          </p>
        ) : (
          <ul data-testid="suggested-solutions-list" className="space-y-2">
            {solutions.map((solution) => (
              <li key={solution.ticket_id} className="text-[12.5px] leading-[1.45]">
                <Link
                  to={`/app/tickets/${solution.ticket_id}`}
                  className="inline-flex items-center gap-1 font-semibold text-brand hover:text-brand-strong"
                >
                  <span className="mono-ltr text-[11px] text-muted-foreground">
                    {solution.number}
                  </span>
                  {solution.subject}
                  <ExternalLink aria-hidden className="h-3 w-3 flex-none" />
                </Link>
                <p className="text-ink-2">
                  {solution.resolution || t("ai.noResolutionNote")}
                </p>
                {solution.resolved_at ? (
                  <p className="text-[11px] text-faint">
                    {t("ai.resolvedRelative", { when: formatRelative(solution.resolved_at) })}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => refetch()}
        disabled={isFetching}
        data-testid="suggested-solutions-generate"
        className="flex flex-none items-center gap-1.5 text-[12px] font-semibold text-brand hover:text-brand-strong disabled:opacity-60"
      >
        {isFetching ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : null}
        {t("ai.suggestedSolutionsGenerate")}
      </button>
    </section>
  );
}
