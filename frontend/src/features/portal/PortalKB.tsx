import { Inbox } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { usePortalArticle, usePortalArticles } from "@/api/portal";
import type { PortalKBArticle } from "@/api/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { MarkdownBody } from "@/lib/markdown";

/**
 * `/portal/kb` and `/portal/kb/:slug` — browse and search published articles,
 * one component for list and reader (the same story 08 pattern KBBrowse uses
 * for the agent side).
 *
 * **The language-fallback notice is duplicated from `KBArticleReader`, not
 * extracted.** `PortalKBArticleSerializer` returns the same `title_ar`/
 * `body_ar` pair the agent detail does, so the fallback rule
 * (`Boolean(title_ar && body_ar)`) is identical — but extracting a shared
 * component would need it to live somewhere both `features/kb` and
 * `features/portal` import from, and `src/api/portal.ts`'s
 * portal-endpoint-only constraint makes that reorganisation more disruptive
 * than the six lines it would save. Recorded here rather than left unexplained.
 */

function ArticleRow({ article, selected }: { article: PortalKBArticle; selected: boolean }) {
  return (
    <Link
      to={`/portal/kb/${article.slug}`}
      data-testid={`portal-kb-row-${article.slug}`}
      aria-current={selected ? "true" : undefined}
      className={
        "block border-b border-line-2 px-4 py-[13px] hover:bg-surface-2" +
        (selected ? " border-s-[3px] border-s-ink bg-surface-3 ps-[13px]" : "")
      }
    >
      <span className="text-[13.5px] font-semibold leading-[1.4]">{article.title_en}</span>
      {article.title_ar ? (
        <p dir="rtl" className="mt-1 text-[12.5px] text-muted-foreground">
          {article.title_ar}
        </p>
      ) : null}
      <p className="mt-1.5 text-[11px] text-faint">{article.category}</p>
    </Link>
  );
}

function PortalReader({ article }: { article: PortalKBArticle }) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language.startsWith("ar");
  const arabicUsable = Boolean(article.title_ar && article.body_ar);
  const showArabic = isArabic && arabicUsable;
  const fellBack = isArabic && !arabicUsable;

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-background p-[22px_26px]" data-testid="portal-kb-reader">
      {article.category ? <Pill className="bg-surface-3 text-slate-600">{article.category}</Pill> : null}
      <h1 className="mt-3.5 text-[21px] font-bold leading-[1.3] tracking-[-0.01em]" dir={showArabic ? "rtl" : "ltr"}>
        {showArabic ? article.title_ar : article.title_en}
      </h1>

      {fellBack ? (
        <p role="status" className="mt-4 max-w-[600px] rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-muted-foreground" data-testid="portal-language-fallback-notice">
          {t("kb.arabicNotAvailable")}
        </p>
      ) : null}

      <MarkdownBody
        text={showArabic ? article.body_ar : article.body_en}
        className="mt-4 max-w-[600px] text-[13px] leading-[1.75] text-ink-2"
        {...(showArabic ? { dir: "rtl" as const } : {})}
      />

      <p className="mt-4 text-[11px] text-faint">{formatDate(article.updated_at)}</p>
    </div>
  );
}

export default function PortalKB() {
  const { t } = useTranslation();
  const { slug } = useParams();
  const [search, setSearch] = useSearchParams();
  const q = search.get("q") ?? "";

  const apiParams = React.useMemo(() => {
    const params = new URLSearchParams({ page_size: "50" });
    if (q) params.set("q", q);
    return params;
  }, [q]);

  const { data, isPending } = usePortalArticles(apiParams);
  const rows = data?.results ?? [];

  const { data: article, isPending: articlePending, isError: articleError } = usePortalArticle(slug ?? null);

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[420px] overflow-hidden rounded-[9px] border border-line bg-background">
      <section className="w-[300px] flex-none overflow-y-auto border-e border-line">
        <div className="p-3.5">
          <input
            type="search"
            value={q}
            onChange={(event) => setSearch(event.target.value ? { q: event.target.value } : {})}
            placeholder={t("kb.search")}
            aria-label={t("kb.search")}
            data-testid="portal-kb-list-search"
            className="h-9 w-full rounded-lg border border-line bg-background px-3 text-[13px] outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="h-px bg-line-2" />
        {isPending ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={t("kb.noArticles")} description="" />
        ) : (
          rows.map((article) => <ArticleRow key={article.id} article={article} selected={article.slug === slug} />)
        )}
      </section>

      {slug === undefined ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState icon={Inbox} title={t("kb.selectTitle")} description={t("kb.selectBody")} />
        </div>
      ) : articlePending ? (
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : articleError || !article ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState title={t("kb.notFound")} description="" />
        </div>
      ) : (
        <PortalReader article={article} />
      )}
    </div>
  );
}
