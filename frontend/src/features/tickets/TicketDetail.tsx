import { AxiosError } from "axios";
import * as React from "react";
import { useTranslation } from "react-i18next";

import {
  useChangeStatus,
  useEscalate,
  useResolve,
  useTicketEvents,
  useTicketMessages,
} from "@/api/tickets";
import type { TicketDetail as Ticket, TicketMessage, TicketStatus } from "@/api/types";
import { ActivityLog } from "@/features/tickets/ActivityLog";
import { AiSummaryBanner } from "@/features/tickets/AiSummaryBanner";
import { Composer } from "@/features/tickets/Composer";
import { SuggestedSolutions } from "@/features/tickets/SuggestedSolutions";
import { Button } from "@/components/ui/button";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/toast";
import { formatRelative } from "@/lib/format";
import { cn, initials } from "@/lib/utils";

/** The centre pane: header, three tabs, the thread, and the composer. */

type DetailTab = "conversation" | "internal" | "activity";

function MessageBubble({ message }: { message: TicketMessage }) {
  return (
    <li className="flex gap-[11px]">
      <span
        aria-hidden
        className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#3f5a7d] text-[11px] font-semibold text-white"
      >
        {initials(message.author_name || "?")}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-semibold">{message.author_name}</span>
          <ChannelBadge channel={message.channel} />
          <span className="text-[11.5px] text-faint">
            {formatRelative(message.created_at)}
          </span>
        </div>
        <div
          className={cn(
            "mt-[7px] max-w-[560px] rounded-[9px] px-3.5 py-[11px] text-[13px] leading-[1.6] whitespace-pre-wrap",
            message.is_internal
              ? "bg-priority-high-bg text-priority-high"
              : "bg-surface-3 text-ink-2",
          )}
        >
          {message.body}
        </div>
      </div>
    </li>
  );
}

export function TicketWorkspaceDetail({ ticket }: { ticket: Ticket }) {
  const { t } = useTranslation();
  const [tab, setTab] = React.useState<DetailTab>("conversation");
  const [confirm, setConfirm] = React.useState<"escalate" | "resolve" | null>(null);
  const [reason, setReason] = React.useState("");

  const { data: messages, isPending: messagesPending } = useTicketMessages(
    ticket.id,
    ticket.channel === "chat",
  );
  const { data: events, isPending: eventsPending } = useTicketEvents(ticket.id);

  const changeStatus = useChangeStatus();
  const escalate = useEscalate();
  const resolve = useResolve();

  const publicMessages = (messages ?? []).filter((message) => !message.is_internal);
  const internalMessages = (messages ?? []).filter((message) => message.is_internal);

  /** Every action shares one failure story: rollback already happened, say so. */
  const onActionError = (error: unknown) => {
    const status = error instanceof AxiosError ? error.response?.status : undefined;
    const detail =
      error instanceof AxiosError
        ? (error.response?.data as { status?: string[] | string } | undefined)?.status
        : undefined;
    // A 400 from the transition endpoint names both states; that message is
    // more useful than anything generic we could substitute for it.
    toast.error(
      status === 400 && detail ? String(detail) : t("tickets.actionFailed"),
    );
  };

  const onStatusChange = (next: string) => {
    if (!next) return;
    changeStatus.mutate(
      { id: ticket.id, status: next as TicketStatus },
      {
        onSuccess: () =>
          toast.success(t("tickets.statusChanged", { status: t(`status.${next}`) })),
        onError: onActionError,
      },
    );
  };

  const tabButton = (value: DetailTab, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      aria-pressed={tab === value}
      data-testid={`detail-tab-${value}`}
      className={cn(
        "flex items-center gap-1.5 border-b-2 pb-2.5 text-[13px]",
        tab === value
          ? "border-brand font-semibold text-ink"
          : "border-transparent font-medium text-muted-foreground hover:text-ink-2",
      )}
    >
      {label}
      <span className="rounded-full bg-surface-3 px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
        {count}
      </span>
    </button>
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <header className="flex-none px-[22px] pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono-ltr text-[12px] text-muted-foreground">{ticket.number}</span>
          <PriorityBadge priority={ticket.priority} />
          <ChannelBadge channel={ticket.channel} />
          <span className="text-[12px] text-faint">
            {t("tickets.opened", { when: formatRelative(ticket.created_at) })}
          </span>

          <span className="flex-1" />

          {/*
            Built from `allowed_transitions`, which the API computes from the
            state machine. Transcribing that map client-side would offer moves
            the API then refuses with a 400 the agent cannot act on.
          */}
          <select
            aria-label={t("tickets.statusLabel")}
            data-testid="status-select"
            value=""
            disabled={ticket.allowed_transitions.length === 0 || changeStatus.isPending}
            onChange={(event) => onStatusChange(event.target.value)}
            className="h-[34px] rounded-[7px] border border-line px-2.5 text-[13px] font-medium text-ink-2 disabled:opacity-60"
          >
            <option value="">{t(`status.${ticket.status}`)}</option>
            {ticket.allowed_transitions.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            size="sm"
            data-testid="escalate-button"
            disabled={escalate.isPending}
            onClick={() => {
              setReason("");
              setConfirm("escalate");
            }}
          >
            {t("tickets.escalate")}
          </Button>
          <Button
            size="sm"
            data-testid="resolve-button"
            disabled={resolve.isPending}
            onClick={() => {
              setReason("");
              setConfirm("resolve");
            }}
          >
            {t("tickets.resolve")}
          </Button>
        </div>

        <h1 className="mt-3 text-[20px] font-bold tracking-[-0.01em]">{ticket.subject}</h1>

        <nav className="mt-4 flex gap-5">
          {tabButton("conversation", t("tickets.tabConversation"), publicMessages.length)}
          {tabButton("internal", t("tickets.tabInternal"), internalMessages.length)}
          {tabButton("activity", t("tickets.tabActivity"), events?.length ?? 0)}
        </nav>
      </header>

      <div className="h-px bg-line-2" />

      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] py-[18px]">
        {tab !== "activity" ? (
          <div className="space-y-3">
            <AiSummaryBanner ticket={ticket} />
            <SuggestedSolutions ticket={ticket} />
          </div>
        ) : null}

        {tab === "activity" ? (
          eventsPending ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <ActivityLog events={events ?? []} isPending={eventsPending} />
          )
        ) : messagesPending ? (
          <div className="mt-5 space-y-4">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : (tab === "conversation" ? publicMessages : internalMessages).length === 0 ? (
          <EmptyState
            title={t(tab === "conversation" ? "tickets.noMessages" : "tickets.noNotes")}
            description={t(
              tab === "conversation" ? "tickets.noMessagesBody" : "tickets.noNotesBody",
            )}
          />
        ) : (
          <ul className="mt-5 space-y-5">
            {(tab === "conversation" ? publicMessages : internalMessages).map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </ul>
        )}
      </div>

      <div className="flex-none px-[22px] pb-5">
        <Composer ticket={ticket} />
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => setConfirm(open ? confirm : null)}
        destructive={confirm === "escalate"}
        title={t(confirm === "resolve" ? "tickets.resolveTitle" : "tickets.escalateTitle")}
        description={t(confirm === "resolve" ? "tickets.resolveBody" : "tickets.escalateBody")}
        confirmLabel={t(confirm === "resolve" ? "tickets.resolve" : "tickets.escalate")}
        onConfirm={() => {
          if (confirm === "escalate") {
            escalate.mutate(
              { id: ticket.id, reason },
              {
                onSuccess: () => toast.success(t("tickets.escalated")),
                onError: onActionError,
              },
            );
          } else if (confirm === "resolve") {
            resolve.mutate(
              { id: ticket.id, resolution_note: reason },
              {
                onSuccess: () => toast.success(t("tickets.resolved")),
                onError: onActionError,
              },
            );
          }
        }}
      >
        <label className="block">
          <span className="text-[12px] font-semibold">
            {t(confirm === "resolve" ? "tickets.resolveNote" : "tickets.escalateReason")}
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            data-testid="confirm-reason"
            className="mt-1.5 w-full rounded-lg border border-line bg-background px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </ConfirmDialog>
    </section>
  );
}
