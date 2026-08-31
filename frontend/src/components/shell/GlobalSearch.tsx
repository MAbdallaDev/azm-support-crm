import { Search, SearchIcon, X } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useGlobalSearchResults } from "@/api/search";
import type { CustomerListRow, TicketListRow } from "@/api/types";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";

/**
 * The chrome's search field, plus its results dropdown.
 *
 * Story 06 shipped the field inert and flagged the dropdown as this story's
 * job. It queries the same `q` filters the ticket queue and customer list
 * already expose (`TicketFilterSet`/`CustomerFilterSet`), so "search" here
 * means exactly what it means everywhere else in the app — no separate
 * search index, no separate scope.
 *
 * The panel's width is `clamp()`-based rather than a fixed pixel value on
 * purpose: a fixed width anchored to either edge of the field runs out of
 * room on a narrower — but still `lg`-and-above — window (a laptop at
 * non-maximized width, a scaled display). Scaling with the viewport means
 * there is no width at which the panel can claim more room than the header
 * actually has.
 */

const DEBOUNCE_MS = 300;
const FIELD_WIDTH = "w-[clamp(200px,20vw,300px)]";
const PANEL_WIDTH = "w-[clamp(280px,26vw,480px)]";

const TIER_CLASS: Record<string, string> = {
  standard: "bg-surface-3 text-slate-600",
  premium: "bg-tier-bg text-tier",
  enterprise: "bg-tier-bg text-tier",
};

type ResultRow =
  | { kind: "ticket"; item: TicketListRow }
  | { kind: "customer"; item: CustomerListRow };

function TicketRow({
  ticket,
  active,
  onSelect,
}: {
  ticket: TicketListRow;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={`global-search-result-ticket-${ticket.id}`}
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col items-start gap-[3px] rounded-md px-[10px] py-[8px] text-start",
        active && "bg-surface-2",
      )}
    >
      <span className="flex items-center gap-[7px]">
        <PriorityBadge priority={ticket.priority} />
        <span dir="ltr" className="font-mono text-[11px] text-muted-foreground">
          {ticket.number}
        </span>
        <span className="truncate text-[12.5px] font-semibold">{ticket.subject}</span>
      </span>
      <span className="text-[11px] text-muted-foreground">{ticket.customer_name}</span>
    </button>
  );
}

function CustomerRow({
  customer,
  active,
  onSelect,
}: {
  customer: CustomerListRow;
  active: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      data-testid={`global-search-result-customer-${customer.id}`}
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col items-start gap-[3px] rounded-md px-[10px] py-[8px] text-start",
        active && "bg-surface-2",
      )}
    >
      <span className="flex w-full items-center gap-[9px]">
        <span className="flex h-[24px] w-[24px] flex-none items-center justify-center rounded-full bg-ink text-[10px] font-semibold text-white">
          {customer.name.slice(0, 2).toUpperCase()}
        </span>
        <span className="flex-1 truncate text-[12.5px] font-semibold">{customer.name}</span>
        <Pill className={TIER_CLASS[customer.tier]}>{t(`customers.tier.${customer.tier}`)}</Pill>
      </span>
      <span className="truncate ps-[33px] text-[11px] text-muted-foreground">{customer.company}</span>
    </button>
  );
}

function ResultsList({
  tickets,
  customers,
  isLoading,
  query,
  activeIndex,
  onSelect,
  onSeeAll,
}: {
  tickets: TicketListRow[];
  customers: CustomerListRow[];
  isLoading: boolean;
  query: string;
  activeIndex: number;
  onSelect: (row: ResultRow) => void;
  onSeeAll: () => void;
}) {
  const { t } = useTranslation();
  const rows: ResultRow[] = [
    ...tickets.map((item): ResultRow => ({ kind: "ticket", item })),
    ...customers.map((item): ResultRow => ({ kind: "customer", item })),
  ];

  if (isLoading) {
    return <div className="px-[14px] py-[16px] text-[12.5px] text-muted-foreground">…</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="px-[20px] py-[26px] text-center">
        <p className="text-[12.5px] font-semibold">{t("nav.searchNoResults", { query })}</p>
        <p className="mt-1 text-[11.5px] text-muted-foreground">{t("nav.searchNoResultsHint")}</p>
      </div>
    );
  }

  return (
    <div>
      {tickets.length > 0 ? (
        <>
          <div className="px-[14px] pb-[6px] pt-[10px] text-[10px] font-semibold uppercase tracking-[.09em] text-faint">
            {t("nav.searchSectionTickets")}
          </div>
          {tickets.map((ticket, index) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              active={index === activeIndex}
              onSelect={() => onSelect({ kind: "ticket", item: ticket })}
            />
          ))}
        </>
      ) : null}

      {customers.length > 0 ? (
        <>
          <div className="px-[14px] pb-[6px] pt-[10px] text-[10px] font-semibold uppercase tracking-[.09em] text-faint">
            {t("nav.searchSectionCustomers")}
          </div>
          {customers.map((customer, index) => (
            <CustomerRow
              key={customer.id}
              customer={customer}
              active={tickets.length + index === activeIndex}
              onSelect={() => onSelect({ kind: "customer", item: customer })}
            />
          ))}
        </>
      ) : null}

      <button
        type="button"
        data-testid="global-search-see-all"
        onClick={onSeeAll}
        className={cn(
          "w-full border-t border-line-2 px-[14px] py-[9px] text-start text-[12px] font-medium text-brand hover:bg-surface-2",
          activeIndex === rows.length && "bg-surface-2",
        )}
      >
        {t("nav.searchSeeAll", { query })}
      </button>
    </div>
  );
}

export function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [value, setValue] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (value === query) return;
    const timer = window.setTimeout(() => setQuery(value), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value, query]);

  const { tickets, customers, isLoading } = useGlobalSearchResults(query);
  const rowCount = tickets.length + customers.length;

  React.useEffect(() => {
    setActiveIndex(-1);
  }, [tickets, customers]);

  React.useEffect(() => {
    if (!open) return;
    const onOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const goToQueue = (term: string) => {
    const params = new URLSearchParams();
    if (term) params.set("q", term);
    navigate(`/app/tickets?${params.toString()}`);
  };

  const selectRow = (row: ResultRow) => {
    if (row.kind === "ticket") navigate(`/app/tickets/${row.item.id}`);
    else navigate(`/app/customers/${row.item.id}`);
    setOpen(false);
    setMobileOpen(false);
    setValue("");
    setQuery("");
  };

  const seeAll = () => {
    goToQueue(value.trim());
    setOpen(false);
    setMobileOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open || value.trim().length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, rowCount));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex < 0) {
        seeAll();
      } else if (activeIndex < tickets.length) {
        selectRow({ kind: "ticket", item: tickets[activeIndex] });
      } else if (activeIndex < rowCount) {
        selectRow({ kind: "customer", item: customers[activeIndex - tickets.length] });
      } else {
        seeAll();
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const showPanel = open && value.trim().length > 0;

  return (
    <>
      {/* Desktop — hidden below `lg`, same as before. */}
      <div ref={containerRef} className="relative hidden lg:block">
        <div
          className={cn(
            "flex h-[34px] items-center gap-2 rounded-lg border border-line bg-surface-2 px-3",
            FIELD_WIDTH,
          )}
        >
          <Search aria-hidden className="h-3.5 w-3.5 flex-none text-faint" />
          <input
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={t("nav.search")}
            aria-label={t("nav.search")}
            data-testid="global-search"
            className="h-full w-full min-w-0 bg-transparent text-[12.5px] outline-none placeholder:text-faint"
          />
          {value ? (
            <button
              type="button"
              onClick={() => {
                setValue("");
                setQuery("");
              }}
              title={t("tickets.clearFilters")}
              className="flex-none text-faint hover:text-ink-2"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
              <span className="sr-only">{t("tickets.clearFilters")}</span>
            </button>
          ) : null}
        </div>

        {showPanel ? (
          <div
            data-testid="global-search-results"
            className={cn(
              "absolute top-[42px] end-0 z-20 rounded-lg border border-line bg-background py-[6px] shadow-lg",
              PANEL_WIDTH,
            )}
          >
            <ResultsList
              tickets={tickets}
              customers={customers}
              isLoading={isLoading}
              query={value.trim()}
              activeIndex={activeIndex}
              onSelect={selectRow}
              onSeeAll={seeAll}
            />
          </div>
        ) : null}
      </div>

      {/* Mobile — an icon that opens a full-screen takeover instead of a
          floating panel: below `lg` there is no width to anchor a dropdown
          against in the first place. */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label={t("nav.searchOpenMobile")}
        data-testid="global-search-mobile-trigger"
        className="flex h-8 w-8 flex-none items-center justify-center rounded-lg hover:bg-surface-3 lg:hidden"
      >
        <SearchIcon aria-hidden className="h-4 w-4" />
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden" data-testid="global-search-mobile">
          <div className="flex h-[52px] flex-none items-center gap-[10px] border-b border-line px-[10px]">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label={t("nav.searchClose")}
              className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg hover:bg-surface-3"
            >
              <X aria-hidden className="h-[17px] w-[17px]" />
            </button>
            <div className="flex h-[36px] flex-1 items-center gap-2 rounded-lg border border-brand px-[10px]">
              <Search aria-hidden className="h-3.5 w-3.5 flex-none text-faint" />
              <input
                autoFocus
                type="search"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") seeAll();
                  if (event.key === "Escape") setMobileOpen(false);
                }}
                placeholder={t("nav.search")}
                aria-label={t("nav.search")}
                data-testid="global-search-mobile-input"
                className="h-full w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-faint"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {value.trim().length === 0 ? null : (
              <ResultsList
                tickets={tickets}
                customers={customers}
                isLoading={isLoading}
                query={value.trim()}
                activeIndex={-1}
                onSelect={selectRow}
                onSeeAll={seeAll}
              />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
