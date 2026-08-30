import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useMe } from "@/api/auth";
import { useCategories, useTicketCount, useTicketList } from "@/api/tickets";
import { CHANNELS, PRIORITIES, STATUSES } from "@/api/types";
import { QueueRow } from "@/features/tickets/QueueRow";
import { TABS, tabParams, useTicketFilters } from "@/features/tickets/useTicketFilters";
import type { FilterKey, QueueTab } from "@/features/tickets/useTicketFilters";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

/**
 * The 300px left pane from Main.dc.html: four tabs, a filter row, the rows,
 * and server-side paging.
 *
 * **Every tab is a server filter.** Each badge count is its own
 * `page_size=1` query built from the *same* `tabParams` the list uses, so a
 * badge and the list it labels can never describe different sets.
 */

const TAB_LABEL: Record<QueueTab, string> = {
  all: "tickets.tabAll",
  mine: "tickets.tabMine",
  escalated: "tickets.tabEscalated",
  breaching: "tickets.tabBreaching",
};

function TabButton({
  tab,
  active,
  meId,
  onSelect,
}: {
  tab: QueueTab;
  active: boolean;
  meId: number | undefined;
  onSelect: (tab: QueueTab) => void;
}) {
  const { t } = useTranslation();
  const { data: count } = useTicketCount(tabParams(tab, meId));

  return (
    <button
      type="button"
      onClick={() => onSelect(tab)}
      aria-pressed={active}
      data-testid={`queue-tab-${tab}`}
      className={cn(
        "flex h-7 flex-none items-center gap-1.5 rounded-full border px-3 text-[12px]",
        active
          ? "border-ink bg-ink font-semibold text-white"
          : "border-line bg-background text-ink-2 hover:bg-surface-2",
      )}
    >
      {t(TAB_LABEL[tab])}
      {count !== undefined ? (
        <span
          className={cn(
            "text-[10px] font-semibold",
            active ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

/** A `<select>` bound to one URL parameter. */
function FilterSelect({
  name,
  value,
  placeholder,
  options,
  onChange,
}: {
  name: FilterKey;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (key: FilterKey, value: string | null) => void;
}) {
  return (
    <select
      aria-label={placeholder}
      data-testid={`queue-filter-${name}`}
      value={value}
      onChange={(event) => onChange(name, event.target.value || null)}
      className={cn(
        "h-7 min-w-0 flex-1 rounded-md border border-line bg-background px-2 text-[11.5px]",
        value ? "font-semibold text-ink" : "text-muted-foreground",
      )}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function TicketQueue({
  selectedId,
  className,
}: {
  selectedId: number | null;
  /** Below `md`, `Tickets.tsx` toggles this between full-width (nothing
   *  selected) and `hidden` (a ticket is open) — a fixed 300px column has no
   *  honest mobile rendering next to a detail pane, so the two panes become
   *  two full-width "pages" instead below that width. */
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const { data: me } = useMe();
  const filters = useTicketFilters(me?.id);
  const { data: categories } = useCategories();

  // Collapsed by default, open automatically when a filter is already active
  // (e.g. a shared/bookmarked filtered link) so restoring from the URL is
  // visible without an extra click. Measured before this change: the four
  // always-visible filter <select>s plus the pagination footer left only 63%
  // of the 300px panel's height for the actual ticket list.
  const [filtersOpen, setFiltersOpen] = useState(filters.activeFilterCount > 0);

  const { data, isPending, isError } = useTicketList(filters.apiParams);

  const rows = data?.results ?? [];
  const pageCount = data ? Math.max(1, Math.ceil(data.count / 25)) : 1;
  const isArabic = i18n.language.startsWith("ar");

  const linkFor = (id: number) => `/app/tickets/${id}?${filters.search.toString()}`;

  return (
    <aside className={cn("flex w-full flex-col border-e border-line bg-background md:w-[300px] md:flex-none", className)}>
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold">{t("tickets.queue")}</h2>
          {data ? (
            <span className="text-[12px] text-muted-foreground">
              {t("tickets.openCount", { count: data.count })}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <TabButton
              key={tab}
              tab={tab}
              active={filters.tab === tab}
              meId={me?.id}
              onSelect={filters.setTab}
            />
          ))}
        </div>

        <div className="mb-3 mt-2.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            data-testid="queue-filters-toggle"
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11.5px]",
              filtersOpen || filters.activeFilterCount > 0
                ? "border-ink-2 bg-surface-2 font-semibold text-ink"
                : "border-line text-muted-foreground hover:bg-surface-2",
            )}
          >
            <SlidersHorizontal aria-hidden className="h-3 w-3 flex-none" />
            {t("tickets.filters")}
            {filters.activeFilterCount > 0 ? (
              <span className="rounded-full bg-ink px-1.5 text-[10px] font-semibold text-white">
                {filters.activeFilterCount}
              </span>
            ) : null}
          </button>
          {filters.activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={filters.clearFilters}
              title={t("tickets.clearFilters")}
              data-testid="queue-clear-filters"
              className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-line text-muted-foreground hover:bg-surface-2"
            >
              <X aria-hidden className="h-3 w-3" />
              <span className="sr-only">{t("tickets.clearFilters")}</span>
            </button>
          ) : null}
        </div>

        {filtersOpen ? (
          <div className="mb-3 space-y-1.5" data-testid="queue-filters-panel">
            <div className="flex items-center gap-1.5">
              <FilterSelect
                name="status"
                value={filters.value("status")}
                placeholder={t("tickets.anyStatus")}
                onChange={filters.setFilter}
                options={STATUSES.map((status) => ({
                  value: status,
                  label: t(`status.${status}`),
                }))}
              />
              <FilterSelect
                name="priority"
                value={filters.value("priority")}
                placeholder={t("tickets.anyPriority")}
                onChange={filters.setFilter}
                options={PRIORITIES.map((priority) => ({
                  value: priority,
                  label: t(`priority.${priority}`),
                }))}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <FilterSelect
                name="channel"
                value={filters.value("channel")}
                placeholder={t("tickets.anyChannel")}
                onChange={filters.setFilter}
                options={CHANNELS.map((channel) => ({
                  value: channel,
                  label: t(`channel.${channel}`),
                }))}
              />
              <FilterSelect
                name="category"
                value={filters.value("category")}
                placeholder={t("tickets.anyCategory")}
                onChange={filters.setFilter}
                options={(categories ?? []).map((category) => ({
                  value: String(category.id),
                  label: isArabic ? category.name_ar : category.name_en,
                }))}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="h-px bg-line-2" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isPending ? (
          <div className="space-y-3 p-4" data-testid="queue-skeleton">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <EmptyState title={t("tickets.loadError")} description="" />
        ) : rows.length === 0 ? (
          <EmptyState
            title={t("tickets.emptyTitle")}
            description={t("tickets.emptyBody")}
            action={
              filters.activeFilterCount > 0 ? (
                <Button variant="outline" size="sm" onClick={filters.clearFilters}>
                  {t("tickets.clearFilters")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          rows.map((ticket) => (
            <QueueRow
              key={ticket.id}
              ticket={ticket}
              selected={ticket.id === selectedId}
              to={linkFor(ticket.id)}
            />
          ))
        )}
      </div>

      {pageCount > 1 ? (
        <div className="flex flex-none items-center justify-between gap-2 border-t border-line px-3 py-2">
          <span className="text-[11.5px] text-muted-foreground">
            {t("table.page", { page: filters.page, pages: pageCount })}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={filters.page <= 1}
              onClick={() => filters.setPage(filters.page - 1)}
              title={t("table.previous")}
            >
              {/* rtl:-scale-x-100 flips the glyph with the document, rather
                  than swapping which component renders on which side. */}
              <ChevronLeft aria-hidden className="h-4 w-4 rtl:-scale-x-100" />
              <span className="sr-only">{t("table.previous")}</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={filters.page >= pageCount}
              onClick={() => filters.setPage(filters.page + 1)}
              title={t("table.next")}
            >
              <ChevronRight aria-hidden className="h-4 w-4 rtl:-scale-x-100" />
              <span className="sr-only">{t("table.next")}</span>
            </Button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
