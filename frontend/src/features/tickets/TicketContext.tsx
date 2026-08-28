import { AxiosError } from "axios";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useMe } from "@/api/auth";
import { useAddCustomerNote, useCustomer, useCustomerNotes } from "@/api/customers";
import { useAssign, useTicketList } from "@/api/tickets";
import type { TicketDetail } from "@/api/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { SlaBar } from "@/components/ui/SlaBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { cn, initials } from "@/lib/utils";

/** The 336px right pane: Customer / History / Notes, plus SLA and assignment. */

type ContextTab = "customer" | "history" | "notes";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 border-b border-line-2 py-[9px] text-[12.5px] last:border-b-0">
    <span className="flex-none text-muted-foreground">{label}</span>
    <span className="min-w-0 truncate text-end font-medium">{children}</span>
  </div>
);

const Caps = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-[18px] text-[10px] font-semibold uppercase tracking-[0.09em] text-faint">
    {children}
  </p>
);

function CustomerTab({ ticket }: { ticket: TicketDetail }) {
  const { t } = useTranslation();
  const { data: customer, isPending } = useCustomer(ticket.customer);

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-[11px]">
        <span
          aria-hidden
          className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[9px] bg-[#3f5a7d] text-[13px] font-semibold text-white"
        >
          {initials(ticket.customer_name)}
        </span>
        <div className="min-w-0 flex-1 leading-[1.35]">
          <p className="truncate text-[14px] font-bold">{ticket.customer_name}</p>
          <p className="truncate text-[11.5px] text-muted-foreground">
            {ticket.customer_company}
          </p>
        </div>
        {ticket.customer_tier ? (
          <Pill className="bg-tier-bg uppercase tracking-[0.07em] text-tier">
            {ticket.customer_tier}
          </Pill>
        ) : null}
      </div>

      <div className="mt-3.5">
        {/* Emails and phone numbers are .mono-ltr: they must read
            left-to-right even inside an Arabic layout. */}
        <Row label={t("context.email")}>
          <a className="mono-ltr text-brand" href={`mailto:${customer?.email ?? ""}`}>
            {customer?.email}
          </a>
        </Row>
        <Row label={t("context.phone")}>
          <span className="mono-ltr">{customer?.phone || "—"}</span>
        </Row>
        <Row label={t("context.whatsapp")}>
          <span className="mono-ltr">{customer?.whatsapp || "—"}</span>
        </Row>
        <Row label={t("context.branch")}>{customer?.branch_name || "—"}</Row>
        <Row label={t("context.language")}>
          {customer ? t(customer.preferred_language === "ar" ? "common.arabic" : "common.english") : "—"}
        </Row>
        <Row label={t("context.openTickets")}>{customer?.open_ticket_count ?? 0}</Row>
      </div>

      {/*
        Story 08 builds /app/customers/:id. Linking now anyway: story 06's
        in-layout catch-all renders "not built yet" with the chrome standing,
        which is exactly why it was built that way.
      */}
      <Link
        to={`/app/customers/${ticket.customer}`}
        className="mt-3 inline-block text-[12px] font-semibold text-brand hover:text-brand-strong"
      >
        {t("context.viewCustomer")}
      </Link>
    </>
  );
}

function HistoryTab({ ticket }: { ticket: TicketDetail }) {
  const { t } = useTranslation();
  const params = new URLSearchParams({
    customer: String(ticket.customer),
    ordering: "-created_at",
    page_size: "10",
  });
  const { data, isPending } = useTicketList(params);

  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const others = (data?.results ?? []).filter((row) => row.id !== ticket.id);

  if (others.length === 0) {
    return <EmptyState title={t("context.noHistory")} description={t("context.noHistoryBody")} />;
  }

  return (
    <ul className="space-y-2">
      {others.map((row) => (
        <li key={row.id}>
          <Link
            to={`/app/tickets/${row.id}`}
            className="block rounded-lg border border-line-2 p-2.5 hover:bg-surface-2"
          >
            <div className="flex items-center gap-1.5">
              <span className="mono-ltr text-[11px] text-muted-foreground">{row.number}</span>
              <StatusBadge status={row.status} />
              <span className="flex-1" />
              <span className="text-[11px] text-faint">{formatDate(row.created_at)}</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-[12.5px] font-medium">{row.subject}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NotesTab({ ticket }: { ticket: TicketDetail }) {
  const { t } = useTranslation();
  const [body, setBody] = React.useState("");
  const { data: notes, isPending } = useCustomerNotes(ticket.customer);
  const addNote = useAddCustomerNote();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    addNote.mutate(
      { id: ticket.customer, body: body.trim() },
      {
        onSuccess: () => {
          setBody("");
          toast.success(t("context.noteSaved"));
        },
        onError: () => toast.error(t("tickets.actionFailed")),
      },
    );
  };

  return (
    <>
      <form onSubmit={submit} className="space-y-2">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={t("context.addNote")}
          rows={3}
          className="w-full resize-y rounded-lg border border-line bg-background px-3 py-2 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="sm" disabled={!body.trim() || addNote.isPending}>
          {addNote.isPending ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : null}
          {t("context.saveNote")}
        </Button>
      </form>

      <div className="mt-4">
        {isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : (notes ?? []).length === 0 ? (
          <EmptyState title={t("context.noNotes")} description={t("context.noNotesBody")} />
        ) : (
          <ul className="space-y-2.5">
            {(notes ?? []).map((note) => (
              <li key={note.id} className="rounded-lg border border-line-2 p-2.5">
                <p className="whitespace-pre-wrap text-[12.5px] leading-[1.55]">{note.body}</p>
                <p className="mt-1.5 text-[11px] text-faint">
                  {note.author_name} · {formatDate(note.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function AssignmentBlock({ ticket }: { ticket: TicketDetail }) {
  const { t, i18n } = useTranslation();
  const { data: me } = useMe();
  const assign = useAssign();

  const isArabic = i18n.language.startsWith("ar");
  const mine = me !== undefined && ticket.assignee?.id === me.id;

  const run = (assignee?: number | null) =>
    assign.mutate(
      { id: ticket.id, assignee },
      {
        onSuccess: () => toast.success(t("context.assigned")),
        onError: (error) => {
          // 409 is not a failure — the request was valid and the roster simply
          // cannot satisfy it. Saying "could not be assigned" would send the
          // agent looking for a bug that is not there.
          const status = error instanceof AxiosError ? error.response?.status : undefined;
          toast.error(t(status === 409 ? "context.noEligibleAgent" : "context.assignFailed"));
        },
      },
    );

  return (
    <div className="mt-2.5 rounded-[9px] border border-line p-3">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#2f3a56] text-[11px] font-semibold text-white"
        >
          {ticket.assignee ? initials(ticket.assignee.full_name) : "—"}
        </span>
        <div className="min-w-0 flex-1 leading-[1.35]">
          <p className="truncate text-[12.5px] font-semibold">
            {ticket.assignee?.full_name ?? t("context.unassigned")}
          </p>
          {/* assignment_reason verbatim — the design shows
              "Owner · auto-assigned by rule R-12", and the server's own
              sentence is more accurate than anything reconstructed here. */}
          {ticket.assignment_reason ? (
            <p className="truncate text-[11px] text-muted-foreground">
              {ticket.assignment_reason}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ticket.department ? <Pill className="bg-surface-3 text-slate-600">{ticket.department}</Pill> : null}
        {ticket.branch ? <Pill className="bg-surface-3 text-slate-600">{ticket.branch}</Pill> : null}
        <Pill className="bg-surface-3 text-slate-600">
          {t("context.watchers", { count: ticket.watcher_count })}
        </Pill>
        {ticket.tags.map((tag) => (
          <Pill key={tag.id} className="bg-surface-3 text-slate-600">
            {isArabic ? tag.name_ar : tag.name_en}
          </Pill>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        {!mine ? (
          <Button
            variant="outline"
            size="sm"
            data-testid="assign-to-me"
            disabled={assign.isPending || me === undefined}
            onClick={() => run(me?.id)}
          >
            {assign.isPending ? (
              <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {t("context.assignToMe")}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          disabled={assign.isPending}
          onClick={() => run(null)}
          title={t("context.autoAssign")}
        >
          {t("context.autoAssign")}
        </Button>
      </div>
    </div>
  );
}

export function TicketContext({ ticket }: { ticket: TicketDetail }) {
  const { t } = useTranslation();
  const [tab, setTab] = React.useState<ContextTab>("customer");

  const tabButton = (value: ContextTab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      aria-pressed={tab === value}
      data-testid={`context-tab-${value}`}
      className={cn(
        "border-b-2 pb-2.5 text-[13px]",
        tab === value
          ? "border-brand font-semibold text-ink"
          : "border-transparent font-medium text-muted-foreground hover:text-ink-2",
      )}
    >
      {label}
    </button>
  );

  return (
    <aside className="hidden w-[336px] flex-none flex-col overflow-y-auto border-s border-line bg-background xl:flex">
      <div className="flex flex-none gap-5 px-[18px] pt-4">
        {tabButton("customer", t("context.customer"))}
        {tabButton("history", t("context.history"))}
        {tabButton("notes", t("context.notes"))}
      </div>
      <div className="h-px bg-line-2" />

      <div className="px-[18px] py-4">
        {tab === "customer" ? <CustomerTab ticket={ticket} /> : null}
        {tab === "history" ? <HistoryTab ticket={ticket} /> : null}
        {tab === "notes" ? <NotesTab ticket={ticket} /> : null}

        {tab === "customer" ? (
          <>
            <Caps>{t("context.sla")}</Caps>
            <div className="mt-2.5 space-y-4 rounded-[9px] border border-line p-3">
              {/* The prop is the API object, verbatim — no adapter. */}
              <SlaBar sla={ticket.response_sla} label={t("context.firstResponse")} />
              <SlaBar sla={ticket.resolution_sla} label={t("context.resolution")} />
            </div>

            <Caps>{t("context.assignment")}</Caps>
            <AssignmentBlock ticket={ticket} />
          </>
        ) : null}
      </div>
    </aside>
  );
}
