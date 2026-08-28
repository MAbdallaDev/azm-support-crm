import { Inbox } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useKBArticle, useKBArticles, useKBCategories } from "@/api/kb";
import type { KBArticleListRow } from "@/api/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatRelative } from "@/lib/format";
import { useUrlFilters } from "@/lib/urlFilters";
import { cn } from "@/lib/utils";
import { KBArticleReader } from "@/features/kb/KBArticleReader";

/**
 * `/app/kb` and `/app/kb/:slug` — one component, the same pattern story 07's
 * `Tickets.tsx` used for the queue and detail. The sidebar and list must not
 * unmount and refetch when an article opens, and the selected row comes from
 * the route param rather than local state.
 *
 * Category filter (`?category=`) and status filter (`?status=`) are server
 * filters, sent straight to `kb/articles/`. **"Missing عربي" is the one
 * exception** — filtered client-side on `has_arabic`, because the API has no
 * such filter and adding one for a ten-article list is not worth a fifth
 * backend task.
 */

const FILTER_KEYS = ["category", "status", "q"] as const;

export default function KBBrowse() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { slug } = useParams();
  const isArabic = i18n.language.startsWith("ar");

  const filters = useUrlFilters({ keys: FILTER_KEYS });
  const { data: categories } = useKBCategories();

  const [missingArabicOnly, setMissingArabicOnly] = React.useState(false);

  const apiParams = React.useMemo(() => {
    const params = new URLSearchParams();
    const category = filters.value("category");
    const status = filters.value("status");
    const q = filters.value("q");
    if (category) params.set("category", category);
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    params.set("page_size", "50");
    return params;
  }, [filters]);

  const { data, isPending } = useKBArticles(apiParams);
  const rows = (data?.results ?? []).filter((row) => !missingArabicOnly || !row.has_arabic);

  const { data: article, isPending: articlePending, isError: articleError } = useKBArticle(slug ?? null);

  const totalCount = data?.count ?? 0;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0">
      {/* ============ CATEGORY SIDEBAR ============ */}
      <aside className="w-[236px] flex-none overflow-y-auto border-e border-line bg-background p-4">
        <p className="text-[15px] font-bold">{t("kb.categories")}</p>
        <div className="mt-3.5 flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => filters.setFilter("category", null)}
            className={cn(
              "flex items-center justify-between rounded-[7px] px-2.5 py-2 text-[12.5px]",
              !filters.value("category") ? "bg-ink font-semibold text-white" : "hover:bg-surface-3",
            )}
          >
            <span>{t("kb.allArticles")}</span>
            <span className="text-[11px] opacity-70">{totalCount}</span>
          </button>
          {(categories ?? []).map((category) => (
            <button
              key={category.slug}
              type="button"
              onClick={() => filters.setFilter("category", category.slug)}
              className={cn(
                "flex items-center justify-between rounded-[7px] px-2.5 py-2 text-[12.5px]",
                filters.value("category") === category.slug
                  ? "bg-ink font-semibold text-white"
                  : "hover:bg-surface-3",
              )}
            >
              <span>{isArabic ? category.name_ar : category.name_en}</span>
              <span className="text-[11px] text-faint">{category.article_count}</span>
            </button>
          ))}
        </div>

        <div className="my-4 h-px bg-line-2" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-faint">{t("kb.filter")}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => filters.setFilter("status", filters.value("status") === "published" ? null : "published")}
            aria-pressed={filters.value("status") === "published"}
            className={cn(
              "flex h-7 items-center rounded-full px-2.5 text-[12px]",
              filters.value("status") === "published"
                ? "bg-ink font-semibold text-white"
                : "border border-line text-ink-2 hover:bg-surface-2",
            )}
          >
            {t("kb.status.published")}
          </button>
          <button
            type="button"
            onClick={() => filters.setFilter("status", filters.value("status") === "draft" ? null : "draft")}
            aria-pressed={filters.value("status") === "draft"}
            data-testid="filter-drafts"
            className={cn(
              "flex h-7 items-center rounded-full px-2.5 text-[12px]",
              filters.value("status") === "draft"
                ? "bg-ink font-semibold text-white"
                : "border border-line text-ink-2 hover:bg-surface-2",
            )}
          >
            {t("kb.status.draft")}
          </button>
          <button
            type="button"
            onClick={() => setMissingArabicOnly((v) => !v)}
            aria-pressed={missingArabicOnly}
            data-testid="filter-missing-arabic"
            className={cn(
              "flex h-7 items-center rounded-full px-2.5 text-[12px]",
              missingArabicOnly ? "bg-ink font-semibold text-white" : "border border-line text-ink-2 hover:bg-surface-2",
            )}
          >
            {t("kb.missingArabic")}
          </button>
        </div>
      </aside>

      {/* ============ ARTICLE LIST ============ */}
      <section className="w-[420px] flex-none overflow-y-auto border-e border-line bg-background">
        <div className="p-4 pb-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">{t("kb.title")}</span>
            <Button size="sm" onClick={() => navigate("/app/kb/new")}>
              {t("kb.newArticle")}
            </Button>
          </div>
          <input
            type="search"
            value={filters.value("q")}
            onChange={(event) => filters.setFilter("q", event.target.value || null)}
            placeholder={t("kb.search")}
            aria-label={t("kb.search")}
            data-testid="kb-search"
            className="mt-3 h-9 w-full rounded-lg border border-line bg-background px-3 text-[13px] outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="h-px bg-line-2" />

        {isPending ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={t("kb.noArticles")} description="" />
        ) : (
          rows.map((row) => (
            <ArticleRow key={row.id} row={row} selected={row.slug === slug} />
          ))
        )}
      </section>

      {/* ============ READER ============ */}
      {slug === undefined ? (
        <div className="flex flex-1 items-center justify-center bg-background">
          <EmptyState icon={Inbox} title={t("kb.selectTitle")} description={t("kb.selectBody")} />
        </div>
      ) : articlePending ? (
        <div className="flex-1 space-y-4 bg-background p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : articleError || !article ? (
        <div className="flex flex-1 items-center justify-center bg-background">
          <EmptyState title={t("kb.notFound")} description="" />
        </div>
      ) : (
        <KBArticleReader
          article={article}
          onEdit={() => navigate(`/app/kb/${article.slug}/edit`)}
        />
      )}
    </div>
  );
}

function ArticleRow({
  row,
  selected,
}: {
  row: KBArticleListRow;
  selected: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Link
      to={`/app/kb/${row.slug}`}
      data-testid={`kb-row-${row.slug}`}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "block border-b border-line-2 px-4 py-[13px] hover:bg-surface-2",
        selected && "border-s-[3px] border-s-ink bg-surface-3 ps-[13px]",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[13.5px] font-semibold leading-[1.4]">{row.title_en}</span>
        {row.status === "draft" ? (
          <Pill className="bg-priority-high-bg text-priority-high" data-testid="draft-badge">
            {t("kb.status.draft")}
          </Pill>
        ) : (
          <Pill className="bg-priority-low-bg text-priority-low">{t("kb.status.published")}</Pill>
        )}
      </div>
      {row.title_ar ? (
        <p dir="rtl" className="mt-1 text-[12.5px] text-muted-foreground">
          {row.title_ar}
        </p>
      ) : null}
      <div className="mt-2 flex items-center gap-2.5 text-[11px] text-faint">
        <span>{row.category_name}</span>
        <span>·</span>
        <span>{t("kb.views", { count: row.view_count })}</span>
        <span>·</span>
        <span>{t("kb.updated", { when: formatRelative(row.updated_at) })}</span>
        {!row.has_arabic ? (
          <>
            <span>·</span>
            <span className="text-priority-high">{t("kb.noArabic")}</span>
          </>
        ) : null}
      </div>
    </Link>
  );
}
