import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useMe } from "@/api/auth";
import { getHealth } from "@/api/client";
import { qk } from "@/api/queryKeys";
import { useMySummary } from "@/api/reports";
import { useTicketList } from "@/api/tickets";
import { OPEN_STATUSES } from "@/features/tickets/useTicketFilters";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { SlaBar } from "@/components/ui/SlaBar";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The agent dashboard — `Dashboard.dc.html`.
 *
 * **Every tile links to a queue filtered to the same set it counts.** The
 * filters are built from the same helpers the queue itself uses, and
 * `test_my_summary.py` asserts the agreement on the API side, because a tile
 * showing 7 that opens a list of 5 is worse than no tile: it teaches the agent
 * not to trust the numbers.
 */

/** Midnight today, in the ISO form `resolved_after` expects. */
const startOfToday = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
};

const openStatusQuery = () =>
  OPEN_STATUSES.map((status) => `status=${status}`).join("&");

function Tile({
  id,
  label,
  value,
  sub,
  to,
  alarm = false,
  loading,
}: {
  /** Stable key, not the translated label — a testid that changes with the
   *  UI language is a testid that breaks the moment someone flips to Arabic. */
  id: string;
  label: string;
  value: number | undefined;
  sub: string;
  to: string;
  alarm?: boolean;
  loading: boolean;
}) {
  return (
    <Link
      to={to}
      data-testid={`tile-${id}`}
      className={cn(
        "block rounded-[10px] border p-4 transition-colors",
        alarm
          ? "border-[#f0c9c9] bg-[#fffafa] hover:bg-[#fff5f5]"
          : "border-line bg-background hover:bg-surface-2",
      )}
    >
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.09em]",
          alarm ? "text-priority-urgent" : "text-faint",
        )}
      >
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-12" />
      ) : (
        <p
          className={cn(
            "mt-1.5 text-[26px] font-bold tracking-[-0.02em]",
            alarm && "text-priority-urgent",
          )}
        >
          {formatNumber(value ?? 0)}
        </p>
      )}
      <p className="mt-1.5 text-[11px] text-faint">{sub}</p>
    </Link>
  );
}

function CsatCard({ summary, loading }: { summary?: ReturnType<typeof useMySummary>["data"]; loading: boolean }) {
  const { t } = useTranslation();
  const total = summary?.csat_count ?? 0;
  const max = Math.max(1, ...(summary?.csat_distribution ?? []).map((bucket) => bucket.count));

  return (
    <div className="rounded-[9px] border border-line bg-background p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-faint">
        {t("dashboard.csat")}
      </p>

      {loading ? (
        <Skeleton className="mt-3 h-10 w-24" />
      ) : summary?.csat_average === null || total === 0 ? (
        <p className="mt-3 text-[12.5px] text-muted-foreground">{t("dashboard.csatNone")}</p>
      ) : (
        <>
          <div className="mt-2.5 flex items-end gap-2.5">
            <span className="text-[34px] font-bold leading-none tracking-[-0.02em]">
              {summary?.csat_average}
            </span>
            <span className="pb-1 text-[12px] leading-[1.5] text-muted-foreground">
              {t("dashboard.csatOutOf")}
              <br />
              {t("dashboard.csatFrom", { count: total })}
            </span>
          </div>

          <div className="mt-3.5 flex flex-col gap-[7px]">
            {[...(summary?.csat_distribution ?? [])].reverse().map((bucket) => (
              <div key={bucket.score} className="flex items-center gap-2.5">
                <span className="w-3 text-[11px] text-muted-foreground">{bucket.score}</span>
                <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      bucket.score >= 4
                        ? "bg-sla-ok-fill"
                        : bucket.score === 3
                          ? "bg-sla-approaching-fill"
                          : "bg-priority-urgent",
                    )}
                    style={{ width: `${(bucket.count / max) * 100}%` }}
                  />
                </div>
                <span className="mono-ltr w-5 text-end text-[11px] text-muted-foreground">
                  {bucket.count}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const { data: summary, isPending, isError } = useMySummary();

  /** The health card from story 01, kept as the API client's smoke test. */
  const { data: health } = useQuery({ queryKey: qk.health, queryFn: getHealth });

  const urgentParams = new URLSearchParams({
    assignee: String(me?.id ?? ""),
    ordering: "sla_resolution_due_at",
    page_size: "5",
  });
  const { data: urgent, isPending: urgentPending } = useTicketList(urgentParams);

  const mine = `assignee=${me?.id ?? ""}`;
  const links = {
    myOpen: `/app/tickets?tab=mine&${openStatusQuery()}`,
    breaching: `/app/tickets?tab=mine&due_within_minutes=60`,
    unassigned: `/app/tickets?unassigned=true&department_code=${me?.department ?? ""}&${openStatusQuery()}`,
    resolvedToday: `/app/tickets?${mine}&resolved_after=${encodeURIComponent(startOfToday())}`,
  };

  return (
    <div className="p-6 lg:px-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.01em]">
            {t("dashboard.greeting", { name: me?.full_name ?? "" })}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {t("dashboard.subtitle", {
              department: me?.department ?? "—",
              branch: me?.branch ?? "—",
              date: formatDate(new Date()),
            })}
          </p>
        </div>
        {/* The story-01 smoke test, kept but unobtrusive: it is still the one
            signal that the whole chain from axios to Postgres is alive. */}
        <span
          data-testid="health-status"
          title={`${t("health.api")}: ${health?.status ?? "—"} · ${t("health.database")}: ${health?.database ?? "—"}`}
          className={cn(
            "mt-1 flex-none rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.07em]",
            health?.database === "ok"
              ? "bg-priority-low-bg text-priority-low"
              : "bg-priority-urgent-bg text-priority-urgent",
          )}
        >
          {health?.status ?? t("health.checking")}
        </span>
      </div>

      {isError ? (
        <p role="alert" className="mt-5 text-[13px] text-priority-urgent">
          {t("dashboard.loadFailed")}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          id="myOpen"
          label={t("dashboard.myOpen")}
          value={summary?.my_open}
          sub={t("dashboard.myOpenSub", { count: summary?.awaiting_first_reply ?? 0 })}
          to={links.myOpen}
          loading={isPending}
        />
        <Tile
          alarm
          id="breaching"
          label={t("dashboard.breaching")}
          value={summary?.breaching_within_hour}
          sub={t("dashboard.breachingSub", { count: summary?.already_breached ?? 0 })}
          to={links.breaching}
          loading={isPending}
        />
        <Tile
          id="unassigned"
          label={t("dashboard.unassigned", { department: me?.department ?? "" })}
          value={summary?.unassigned_in_department}
          sub={t("dashboard.unassignedSub")}
          to={links.unassigned}
          loading={isPending}
        />
        <Tile
          id="resolvedToday"
          label={t("dashboard.resolvedToday")}
          value={summary?.resolved_by_me_today}
          sub={t("dashboard.resolvedTodaySub")}
          to={links.resolvedToday}
          loading={isPending}
        />
      </div>

      <div className="mt-5 flex flex-col gap-4 xl:flex-row">
        <section className="min-w-0 flex-1 rounded-[9px] border border-line bg-background">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h2 className="text-[14px] font-bold">{t("dashboard.mostUrgent")}</h2>
            <Link
              to={links.myOpen}
              className="text-[12px] font-semibold text-brand hover:text-brand-strong"
            >
              {t("dashboard.openQueue")}
            </Link>
          </div>

          {urgentPending ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-6 w-full" />
              ))}
            </div>
          ) : (urgent?.results ?? []).length === 0 ? (
            <EmptyState title={t("dashboard.noUrgent")} description={t("dashboard.noUrgentBody")} />
          ) : (
            <ul>
              {(urgent?.results ?? []).map((row) => (
                <li key={row.id}>
                  <Link
                    to={`/app/tickets/${row.id}`}
                    className="flex items-center gap-2.5 border-b border-line-2 px-4 py-3 hover:bg-surface-2"
                  >
                    <PriorityBadge priority={row.priority} />
                    <span className="mono-ltr w-[62px] flex-none text-[11px] text-muted-foreground">
                      {row.number}
                    </span>
                    <ChannelBadge channel={row.channel} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                      {row.subject}
                    </span>
                    <span className="hidden w-[110px] flex-none truncate text-[12px] text-muted-foreground lg:block">
                      {row.customer_name}
                    </span>
                    <span className="w-[88px] flex-none text-end">
                      <SlaBar sla={row.resolution_sla} compact />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="w-full flex-none xl:w-[320px]">
          <CsatCard summary={summary} loading={isPending} />
        </div>
      </div>
    </div>
  );
}
