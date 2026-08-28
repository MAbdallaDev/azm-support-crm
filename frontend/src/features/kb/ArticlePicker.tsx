import * as React from "react";
import { useTranslation } from "react-i18next";

import { useKBArticles } from "@/api/kb";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Criterion 9: insert a knowledge-base link into a reply.
 *
 * A search dialog over `kb/articles/?q=`, opened from the composer. Picking a
 * result hands the caller a Markdown link — the caller (the composer) inserts
 * it via its own `insertAtCursor`, which is what actually guarantees the rest
 * of the draft survives untouched. This component does not know how the link
 * gets inserted; it only produces one.
 */
export function ArticlePicker({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (markdownLink: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = React.useState("");
  const isArabic = i18n.language.startsWith("ar");

  const params = React.useMemo(() => {
    const p = new URLSearchParams({ page_size: "10", status: "published" });
    if (query) p.set("q", query);
    return p;
  }, [query]);

  const { data, isPending } = useKBArticles(params);

  const pick = (slug: string, title: string) => {
    onPick(`[${title}](/app/kb/${slug})`);
    onOpenChange(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="article-picker">
        <DialogHeader>
          <DialogTitle>{t("kb.pickerTitle")}</DialogTitle>
        </DialogHeader>

        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("kb.search")}
          data-testid="article-picker-search"
          className="h-9 w-full rounded-lg border border-line bg-background px-3 text-[13px] outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-ring"
        />

        <div className="max-h-[320px] overflow-y-auto">
          {isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : (data?.results ?? []).length === 0 ? (
            <EmptyState title={t("kb.noArticles")} description="" />
          ) : (
            <ul className="divide-y divide-line-2">
              {(data?.results ?? []).map((article) => (
                <li key={article.id}>
                  <button
                    type="button"
                    onClick={() =>
                      pick(article.slug, isArabic && article.title_ar ? article.title_ar : article.title_en)
                    }
                    data-testid={`article-picker-result-${article.slug}`}
                    className="w-full px-1 py-2.5 text-start text-[13px] font-medium hover:text-brand"
                  >
                    {article.title_en}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
