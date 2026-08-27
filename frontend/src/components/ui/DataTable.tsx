import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

/**
 * The table every list screen uses.
 *
 * **Sorting and pagination are controlled, not internal.** The rows handed in
 * are one server page; re-sorting them in the browser would sort twenty-five
 * of two hundred rows and look, convincingly, like sorting. `onSortChange`
 * hands the caller a new sort so it can re-run its query, and the component
 * renders whatever comes back.
 *
 * Alignment is `text-start`/`text-end` throughout — the whole table mirrors in
 * Arabic with no per-column direction logic.
 */

export type SortDirection = "asc" | "desc";
export type SortState = { key: string; direction: SortDirection } | null;

export type Column<T> = {
  /** Matches the API's ordering field, so `onSortChange` needs no mapping. */
  key: string;
  /** Already translated by the caller — the table does not own their keys. */
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  /** `end` for numeric/right-hand columns. Mirrors automatically in Arabic. */
  align?: "start" | "end";
  className?: string;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  isLoading?: boolean;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  page?: number;
  pageCount?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  skeletonRows?: number;
  className?: string;
};

/** asc → desc → unsorted. The third state is what lets a user undo a sort. */
const nextSort = (current: SortState, key: string): SortState => {
  if (current?.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return null;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  sort = null,
  onSortChange,
  page = 1,
  pageCount = 1,
  totalCount,
  onPageChange,
  onRowClick,
  empty,
  skeletonRows = 6,
  className,
}: DataTableProps<T>) {
  const { t } = useTranslation();

  const showEmpty = !isLoading && rows.length === 0;
  const showPager = onPageChange !== undefined && pageCount > 1;

  return (
    <div className={cn("rounded-[9px] border border-line bg-background", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.key;
                const alignment = column.align === "end" ? "text-end" : "text-start";

                if (!column.sortable || !onSortChange) {
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      className={cn(
                        "whitespace-nowrap border-b border-line px-3 py-[9px] text-[11px]",
                        "font-semibold text-muted-foreground",
                        alignment,
                        column.className,
                      )}
                    >
                      {column.header}
                    </th>
                  );
                }

                const SortIcon = !active
                  ? ChevronsUpDown
                  : sort.direction === "asc"
                    ? ChevronUp
                    : ChevronDown;

                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      active
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={cn(
                      "whitespace-nowrap border-b border-line px-3 py-[9px] text-[11px]",
                      "font-semibold text-muted-foreground",
                      alignment,
                      column.className,
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSortChange(nextSort(sort, column.key))}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground",
                        active && "text-foreground",
                      )}
                      title={
                        active && sort.direction === "asc"
                          ? t("table.sortDescending")
                          : t("table.sortAscending")
                      }
                    >
                      {column.header}
                      <SortIcon aria-hidden className="h-3 w-3" />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {isLoading
              ? Array.from({ length: skeletonRows }, (_, rowIndex) => (
                  <tr key={`skeleton-${rowIndex}`} data-testid="table-skeleton-row">
                    {columns.map((column) => (
                      <td key={column.key} className="border-b border-line-2 px-3 py-[11px]">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "border-b border-line-2",
                      onRowClick && "cursor-pointer hover:bg-surface-2",
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-3 py-[11px] text-[12.5px]",
                          column.align === "end" ? "text-end" : "text-start",
                          column.className,
                        )}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {showEmpty ? <div data-testid="table-empty">{empty ?? <EmptyState />}</div> : null}

      {showPager ? (
        <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2">
          <span className="text-[11.5px] text-muted-foreground">
            {totalCount === undefined
              ? t("table.page", { page, pages: pageCount })
              : t("table.rowCount", { count: totalCount })}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] text-muted-foreground">
              {t("table.page", { page, pages: pageCount })}
            </span>
            {/*
              The chevrons point at the *previous* and *next* page, which in
              Arabic is the opposite screen edge. `rtl:-scale-x-100` flips the
              glyph with the document rather than swapping the two components.
            */}
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
              title={t("table.previous")}
            >
              <ChevronLeft aria-hidden className="h-4 w-4 rtl:-scale-x-100" />
              <span className="sr-only">{t("table.previous")}</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page >= pageCount}
              onClick={() => onPageChange?.(page + 1)}
              title={t("table.next")}
            >
              <ChevronRight aria-hidden className="h-4 w-4 rtl:-scale-x-100" />
              <span className="sr-only">{t("table.next")}</span>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
