import * as React from "react";
import { I18nextProvider, useTranslation } from "react-i18next";

import { CHANNELS, PRIORITIES, STATUSES } from "@/api/types";
import type { Sla } from "@/api/types";
import i18n from "@/i18n";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import type { Column, SortState } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { SlaBar } from "@/components/ui/SlaBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/**
 * Every shared component in every documented state, in both languages.
 *
 * Routed at `/app/_kitchen-sink` **inside** the protected tree, and gated on
 * `import.meta.env.DEV` at router-construction time (see main.tsx) so the
 * production bundle never contains it. A runtime role check would still ship
 * the code, which is a different thing from not shipping it.
 */

const SLAS: Sla[] = [
  { state: "ok", seconds_remaining: 14700, target_minutes: 360, policy_name: "Gold response" },
  {
    state: "approaching",
    seconds_remaining: 2280,
    target_minutes: 240,
    policy_name: "Silver response",
  },
  {
    state: "breached",
    seconds_remaining: -840,
    target_minutes: 120,
    policy_name: "Bronze resolution",
  },
];

type Row = { id: number; number: string; subject: string; priority: (typeof PRIORITIES)[number] };

const ROWS: Row[] = [
  { id: 1, number: "TK-4821", subject: "Payment failed on renewal invoice", priority: "urgent" },
  { id: 2, number: "TK-4818", subject: "Cannot add a second branch", priority: "high" },
  { id: 3, number: "TK-4796", subject: "SMS notifications arriving late", priority: "normal" },
];

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-7">
    <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-faint">{title}</p>
    <div className="mt-3">{children}</div>
  </section>
);

/** The panel rendered once per language, side by side. */
function Gallery() {
  const { t } = useTranslation();
  const [sort, setSort] = React.useState<SortState>({ key: "number", direction: "asc" });
  const [page, setPage] = React.useState(1);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const columns: Column<Row>[] = [
    {
      key: "number",
      header: t("kitchen.colNumber"),
      sortable: true,
      cell: (row) => <span className="mono-ltr text-[11px] text-muted-foreground">{row.number}</span>,
    },
    { key: "subject", header: t("kitchen.colSubject"), cell: (row) => row.subject },
    {
      key: "priority",
      header: t("kitchen.colPriority"),
      align: "end",
      cell: (row) => <PriorityBadge priority={row.priority} />,
    },
  ];

  return (
    <div className="rounded-[9px] border border-line bg-background p-5">
      <h2 className="text-[15px] font-bold">{t("kitchen.title")}</h2>
      <p className="mt-1 text-[12.5px] text-muted-foreground">{t("kitchen.subtitle")}</p>

      <Section title={t("kitchen.statuses")}>
        <div className="flex flex-wrap gap-[7px]">
          {STATUSES.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
      </Section>

      <Section title={t("kitchen.priorities")}>
        <div className="flex flex-wrap gap-[7px]">
          {PRIORITIES.map((priority) => (
            <PriorityBadge key={priority} priority={priority} />
          ))}
        </div>
      </Section>

      <Section title={t("kitchen.channels")}>
        <div className="flex flex-wrap gap-[7px]">
          {CHANNELS.map((channel) => (
            <ChannelBadge key={channel} channel={channel} />
          ))}
        </div>
      </Section>

      <Section title={t("kitchen.sla")}>
        <div className="space-y-4 rounded-[9px] border border-line p-3.5">
          {SLAS.map((sla) => (
            <SlaBar key={sla.state} sla={sla} label={t(`sla.${sla.state}`)} />
          ))}
        </div>
      </Section>

      <Section title={`${t("kitchen.table")} — ${t("kitchen.populated")}`}>
        <DataTable
          columns={columns}
          rows={ROWS}
          rowKey={(row) => row.id}
          sort={sort}
          onSortChange={setSort}
          page={page}
          pageCount={3}
          totalCount={ROWS.length}
          onPageChange={setPage}
        />
      </Section>

      <Section title={`${t("kitchen.table")} — ${t("kitchen.loading")}`}>
        <DataTable columns={columns} rows={[]} rowKey={(row) => row.id} isLoading skeletonRows={3} />
      </Section>

      <Section title={`${t("kitchen.table")} — ${t("kitchen.emptyState")}`}>
        <DataTable columns={columns} rows={[]} rowKey={(row) => row.id} />
      </Section>

      <Section title={t("kitchen.states")}>
        <div className="space-y-4">
          <EmptyState className="rounded-[9px] border border-line" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(true)}>
              {t("kitchen.openDialog")}
            </Button>
            <Button variant="secondary" onClick={() => toast.success(t("kitchen.toastMessage"))}>
              {t("kitchen.toast")}
            </Button>
          </div>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            destructive
            title={t("kitchen.confirmTitle")}
            description={t("kitchen.confirmBody")}
            onConfirm={() => toast.success(t("kitchen.toastMessage"))}
          />
        </div>
      </Section>
    </div>
  );
}

/**
 * The Arabic column runs on its own i18next instance with `dir="rtl"` on its
 * wrapper, so both languages render at once without either one fighting the
 * document's own direction. The real toggle in the chrome is unaffected.
 */
const english = i18n.cloneInstance({ lng: "en" });
const arabic = i18n.cloneInstance({ lng: "ar" });

export default function KitchenSink() {
  return (
    <div className="p-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <div dir="ltr">
          <I18nextProvider i18n={english}>
            <Gallery />
          </I18nextProvider>
        </div>
        <div dir="rtl">
          <I18nextProvider i18n={arabic}>
            <Gallery />
          </I18nextProvider>
        </div>
      </div>
    </div>
  );
}
