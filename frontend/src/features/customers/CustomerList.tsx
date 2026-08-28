import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useBranches, useCustomerList } from "@/api/customers";
import type { CustomerListRow } from "@/api/types";
import { buildListParams, useUrlFilters } from "@/lib/urlFilters";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/DataTable";
import type { Column, SortState } from "@/components/ui/DataTable";
import { Pill } from "@/components/ui/pill";
import { formatDate } from "@/lib/format";
import * as React from "react";

/**
 * `/app/customers` — the searchable, filterable customer table.
 *
 * Filter state lives in the URL via `useUrlFilters`, the pattern story 07's
 * `useTicketFilters` established: a filtered list is a link, survives a
 * reload, and the back button undoes a change. `tier` is multi-valued
 * (`?tier=standard&tier=enterprise`), so it goes through `setMultiFilter`
 * rather than the single-value `setFilter`.
 */

const TIERS = ["standard", "premium", "enterprise"] as const;
const FILTER_KEYS = ["tier", "branch", "q", "ordering"] as const;

const TIER_CLASS: Record<string, string> = {
  standard: "bg-surface-3 text-slate-600",
  premium: "bg-tier-bg text-tier",
  enterprise: "bg-tier-bg text-tier",
};

export default function CustomerList() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language.startsWith("ar");
  const filters = useUrlFilters({ keys: FILTER_KEYS });
  const { data: branches } = useBranches();

  const [sort, setSort] = React.useState<SortState>(null);
  const apiParams = React.useMemo(() => {
    const params = buildListParams(filters.search, { keys: FILTER_KEYS });
    if (sort) params.set("ordering", sort.direction === "asc" ? sort.key : `-${sort.key}`);
    return params;
  }, [filters.search, sort]);

  const { data, isPending, isError, refetch } = useCustomerList(apiParams);
  const rows = data?.results ?? [];
  const pageCount = data ? Math.max(1, Math.ceil(data.count / 25)) : 1;

  const selectedTiers = filters.values("tier");
  const toggleTier = (tier: string) => {
    const next = selectedTiers.includes(tier)
      ? selectedTiers.filter((value) => value !== tier)
      : [...selectedTiers, tier];
    filters.setMultiFilter("tier", next);
  };

  const columns: Column<CustomerListRow>[] = [
    {
      key: "name",
      header: t("customers.colName"),
      sortable: true,
      cell: (row) => (
        <Link to={`/app/customers/${row.id}`} className="font-semibold text-brand hover:text-brand-strong">
          {row.name}
        </Link>
      ),
    },
    { key: "company", header: t("customers.colCompany"), cell: (row) => row.company || "—" },
    {
      key: "tier",
      header: t("customers.colTier"),
      cell: (row) => <Pill className={TIER_CLASS[row.tier]}>{t(`customers.tier.${row.tier}`)}</Pill>,
    },
    { key: "branch_name", header: t("customers.colBranch"), cell: (row) => row.branch_name || "—" },
    {
      key: "open_ticket_count",
      header: t("customers.colOpen"),
      align: "end",
      sortable: true,
      cell: (row) => row.open_ticket_count,
    },
    {
      key: "last_activity",
      header: t("customers.colLastActivity"),
      align: "end",
      sortable: true,
      cell: (row) => (row.last_activity ? formatDate(row.last_activity) : "—"),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[22px] font-bold tracking-[-0.01em]">{t("customers.title")}</h1>
      </div>

      {isError ? (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-priority-urgent/30 bg-priority-urgent-bg px-3.5 py-2.5 text-[12.5px] font-medium text-priority-urgent"
        >
          <span>{t("customers.loadFailed")}</span>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t("auth.retry")}
          </Button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={filters.value("q")}
          onChange={(event) => filters.setFilter("q", event.target.value || null)}
          placeholder={t("customers.search")}
          aria-label={t("customers.search")}
          data-testid="customer-search"
          className="h-9 w-64 rounded-lg border border-line bg-background px-3 text-[13px] outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-ring"
        />

        <div className="flex items-center gap-1.5" role="group" aria-label={t("customers.colTier")}>
          {TIERS.map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => toggleTier(tier)}
              aria-pressed={selectedTiers.includes(tier)}
              data-testid={`tier-filter-${tier}`}
              className={
                selectedTiers.includes(tier)
                  ? "flex h-8 items-center rounded-full bg-ink px-3 text-[12px] font-semibold text-white"
                  : "flex h-8 items-center rounded-full border border-line px-3 text-[12px] text-ink-2 hover:bg-surface-2"
              }
            >
              {t(`customers.tier.${tier}`)}
            </button>
          ))}
        </div>

        <select
          aria-label={t("customers.colBranch")}
          value={filters.value("branch")}
          onChange={(event) => filters.setFilter("branch", event.target.value || null)}
          data-testid="branch-filter"
          className="h-8 rounded-md border border-line bg-background px-2 text-[12px] text-ink-2"
        >
          <option value="">{t("customers.anyBranch")}</option>
          {(branches ?? []).map((branch) => (
            <option key={branch.id} value={branch.id}>
              {isArabic ? branch.name_ar : branch.name_en}
            </option>
          ))}
        </select>

        {filters.activeFilterCount > 0 ? (
          <Button variant="ghost" size="sm" onClick={filters.clearFilters}>
            <X aria-hidden className="h-3.5 w-3.5" />
            {t("tickets.clearFilters")}
          </Button>
        ) : null}
      </div>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          isLoading={isPending}
          sort={sort}
          onSortChange={setSort}
          page={filters.page}
          pageCount={pageCount}
          totalCount={data?.count}
          onPageChange={filters.setPage}
        />
      </div>
    </div>
  );
}
