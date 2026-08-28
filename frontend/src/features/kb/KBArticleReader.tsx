import { ThumbsDown, ThumbsUp } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { useMarkHelpful } from "@/api/kb";
import type { KBArticleDetail } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import { formatDate, formatRelative } from "@/lib/format";
import { MarkdownBody } from "@/lib/markdown";

/**
 * The reader pane — third column of `/app/kb`, and the whole of `/app/kb/:slug`
 * on a narrow viewport.
 *
 * **Language fallback, never an empty page.** `has_arabic` is
 * `bool(title_ar and body_ar)`, computed server-side so the client never
 * re-derives the same rule. When the interface language has nothing to show,
 * the *other* language renders beneath an explicit notice — silence would
 * look like a missing article rather than an untranslated one.
 */
export function KBArticleReader({
  article,
  onEdit,
  onInsert,
}: {
  article: KBArticleDetail;
  onEdit?: () => void;
  onInsert?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const markHelpful = useMarkHelpful();
  const [thanked, setThanked] = React.useState(false);
  const isArabic = i18n.language.startsWith("ar");

  // `title_en`/`body_en` are required fields on the model — only Arabic can
  // ever be missing, so the fallback runs one direction only: Arabic
  // interface, no Arabic content, show English with a notice.
  const arabicUsable = Boolean(article.title_ar && article.body_ar);
  const showArabic = isArabic && arabicUsable;
  const fellBack = isArabic && !arabicUsable;

  const title = showArabic ? article.title_ar : article.title_en;
  const body = showArabic ? article.body_ar : article.body_en;

  const onHelpful = (value: boolean) => {
    if (!value) {
      // No `not_helpful` counter exists on the API — recorded as a deliberate
      // scope decision in the journal. Acknowledging the click is honest;
      // pretending it persisted somewhere would not be.
      setThanked(true);
      return;
    }
    markHelpful.mutate(article.slug, {
      onSuccess: () => setThanked(true),
      onError: () => toast.error(t("kb.helpfulFailed")),
    });
  };

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-background p-[22px_26px]" data-testid="kb-reader">
      <div className="flex flex-wrap items-center gap-2">
        {article.category_name ? <Pill className="bg-surface-3 text-slate-600">{article.category_name}</Pill> : null}
        <Pill className={article.status === "published" ? "bg-priority-low-bg text-priority-low" : "bg-priority-high-bg text-priority-high"}>
          {t(`kb.status.${article.status}`)}
        </Pill>
        <span className="flex-1" />
        {onEdit ? (
          <Button variant="outline" size="sm" onClick={onEdit}>
            {t("common.edit")}
          </Button>
        ) : null}
        {onInsert ? (
          <Button variant="outline" size="sm" onClick={onInsert} data-testid="insert-into-reply">
            {t("kb.insertIntoReply")}
          </Button>
        ) : null}
      </div>

      <h1 className="mt-3.5 text-[23px] font-bold leading-[1.3] tracking-[-0.01em]" dir={showArabic ? "rtl" : "ltr"}>
        {title}
      </h1>
      <p className="mt-2 text-[11.5px] text-faint">
        {article.author_name} · {t("kb.updated", { when: formatRelative(article.updated_at) })} ·{" "}
        {t("kb.views", { count: article.view_count })}
      </p>

      {fellBack ? (
        <p role="status" className="mt-4 max-w-[600px] rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-muted-foreground" data-testid="language-fallback-notice">
          {t("kb.arabicNotAvailable")}
        </p>
      ) : null}

      <MarkdownBody
        text={body || t("kb.emptyBody")}
        className="mt-4 max-w-[600px] text-[13px] leading-[1.75] text-ink-2"
        {...(showArabic ? { dir: "rtl" as const } : {})}
      />

      <div className="mt-5 max-w-[600px] rounded-[9px] border border-line bg-surface-2 p-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[12.5px] font-semibold">{t("kb.availableIn")}</span>
          {article.title_en ? <Pill className="bg-priority-low-bg text-priority-low">{t("common.english")}</Pill> : null}
          {arabicUsable ? <Pill className="bg-priority-low-bg text-priority-low">{t("common.arabic")}</Pill> : null}
          <span className="flex-1" />
          {thanked ? (
            <span className="text-[12px] text-muted-foreground">{t("kb.thanksForFeedback")}</span>
          ) : (
            <>
              <span className="text-[12px] text-muted-foreground">{t("kb.wasHelpful")}</span>
              <button
                type="button"
                onClick={() => onHelpful(true)}
                aria-label={t("kb.yes")}
                className="flex h-[26px] items-center gap-1 rounded-full border border-line px-2.5 text-[12px] hover:bg-background"
              >
                <ThumbsUp aria-hidden className="h-3 w-3" />
                {t("kb.yes")}
              </button>
              <button
                type="button"
                onClick={() => onHelpful(false)}
                aria-label={t("kb.no")}
                className="flex h-[26px] items-center gap-1 rounded-full border border-line px-2.5 text-[12px] hover:bg-background"
              >
                <ThumbsDown aria-hidden className="h-3 w-3" />
                {t("kb.no")}
              </button>
            </>
          )}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-faint">{formatDate(article.updated_at)}</p>
    </div>
  );
}
