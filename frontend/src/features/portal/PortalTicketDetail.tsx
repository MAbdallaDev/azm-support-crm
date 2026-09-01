import { Paperclip, Send, Star, X } from "lucide-react";
import * as React from "react";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { ATTACHMENT_ACCEPT, validateAttachment } from "@/api/attachments";
import { usePortalMessages, usePortalTicket, useSendPortalMessage, useSubmitCSAT } from "@/api/portal";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/toast";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * `/portal/tickets/:id`. Subject, number, status, category, created date,
 * target date, the public conversation, a reply box with attachments, and the
 * CSAT widget once the ticket is finished.
 *
 * **Nothing from the forbidden set appears here** — no assignee, no
 * department, no SLA policy, no escalation state. `PortalTicketSerializer`
 * already cannot supply them; this component does not work around that by
 * calling an agent endpoint to fill the gap, which is precisely what
 * criterion 14's portal-endpoint-only test exists to catch.
 */

const RATEABLE = new Set(["resolved", "closed"]);

function CsatWidget({ ticketId, existing }: { ticketId: number; existing: { score: number; comment: string } | null }) {
  const { t } = useTranslation();
  const submit = useSubmitCSAT();
  const [hover, setHover] = React.useState(0);
  const [alreadyRated, setAlreadyRated] = React.useState(false);

  if (existing || alreadyRated) {
    const score = existing?.score ?? 0;
    return (
      <div className="mt-4 rounded-[9px] border border-line bg-surface-2 p-3.5" data-testid="csat-readonly">
        <p className="text-[12px] font-semibold text-muted-foreground">{t("portal.yourRating")}</p>
        <div className="mt-1.5 flex items-center gap-1" aria-label={t("portal.yourRating")}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Star
              key={value}
              aria-hidden
              className={cn("h-4 w-4", value <= score ? "fill-priority-urgent text-priority-urgent" : "text-line")}
            />
          ))}
        </div>
        {existing?.comment ? <p className="mt-2 text-[12.5px] text-ink-2">{existing.comment}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-[9px] border border-line bg-surface-2 p-3.5" data-testid="csat-input">
      <p className="text-[12px] font-semibold text-muted-foreground">{t("portal.rateThisTicket")}</p>
      <div className="mt-1.5 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-label={t("portal.starRating", { count: value })}
            data-testid={`csat-star-${value}`}
            onMouseEnter={() => setHover(value)}
            onMouseLeave={() => setHover(0)}
            onClick={() =>
              submit.mutate(
                { ticket: ticketId, score: value },
                {
                  onError: (error) => {
                    // A 409 means someone already rated it — e.g. two open tabs
                    // racing. Treated as "already rated", not as a failure.
                    if (error instanceof AxiosError && error.response?.status === 409) {
                      setAlreadyRated(true);
                      return;
                    }
                    toast.error(t("portal.ratingFailed"));
                  },
                },
              )
            }
          >
            <Star
              aria-hidden
              className={cn("h-5 w-5", value <= hover ? "fill-priority-urgent text-priority-urgent" : "text-line")}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PortalTicketDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const ticketId = id ? Number(id) : null;

  const { data: ticket, isPending } = usePortalTicket(ticketId);
  const { data: messages, isPending: messagesPending } = usePortalMessages(
    ticketId,
    ticket?.channel === "chat",
  );
  const sendMessage = useSendPortalMessage();

  const [body, setBody] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);

  const onFilesChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    for (const file of picked) {
      const check = validateAttachment(file);
      if (!check.ok) {
        toast.error(
          check.reason === "too_large"
            ? t("composer.tooLarge", { limit: check.limitMb })
            : t("composer.wrongType", { type: check.type }),
        );
        continue;
      }
      setFiles((previous) => [...previous, file]);
    }
  };

  const onReply = (event: React.FormEvent) => {
    event.preventDefault();
    if (!ticketId || !body.trim()) return;
    sendMessage.mutate(
      { id: ticketId, body, attachments: files },
      {
        onSuccess: () => {
          setBody("");
          setFiles([]);
        },
        onError: () => toast.error(t("portal.replyFailed")),
      },
    );
  };

  if (isPending || !ticket) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div>
      <Link to="/portal" className="text-[12px] font-semibold text-brand hover:text-brand-strong">
        {t("portal.backToRequests")}
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <h1 className="text-[19px] font-bold tracking-[-0.01em]">{ticket.subject}</h1>
        <Pill className="bg-surface-3 text-slate-600">{t(`status.${ticket.status}`)}</Pill>
      </div>
      <p className="mono-ltr mt-1 text-[12px] text-muted-foreground">{ticket.number}</p>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-[9px] border border-line bg-background p-3.5 text-[12.5px] sm:grid-cols-4">
        <div>
          <dt className="text-faint">{t("portal.category")}</dt>
          <dd className="mt-0.5 font-medium">{ticket.category || "—"}</dd>
        </div>
        <div>
          <dt className="text-faint">{t("newTicket.channel")}</dt>
          <dd className="mt-0.5 font-medium">{t(`channel.${ticket.channel}`)}</dd>
        </div>
        <div>
          <dt className="text-faint">{t("portal.createdOn")}</dt>
          <dd className="mt-0.5 font-medium">{formatDate(ticket.created_at)}</dd>
        </div>
        <div>
          <dt className="text-faint">{t("portal.targetDate")}</dt>
          <dd className="mt-0.5 font-medium">{ticket.target_date ? formatDate(ticket.target_date) : "—"}</dd>
        </div>
      </dl>

      {RATEABLE.has(ticket.status) ? <CsatWidget ticketId={ticket.id} existing={ticket.csat} /> : null}

      <div className="mt-5 rounded-[9px] border border-line bg-background">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[13.5px] font-bold">{t("portal.conversation")}</h2>
        </div>

        {messagesPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 2 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {(messages ?? []).map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[80%] rounded-[10px] px-3 py-2 text-[13px]",
                  message.author_kind === "you" ? "ms-auto bg-ink text-white" : "bg-surface-2 text-ink",
                )}
              >
                <p>{message.body}</p>
                <p className={cn("mt-1 text-[10.5px]", message.author_kind === "you" ? "text-white/60" : "text-faint")}>
                  {formatDateTime(message.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={onReply} className="border-t border-line p-3.5">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            placeholder={t("portal.replyPlaceholder")}
            data-testid="portal-reply-body"
            className="w-full resize-y rounded-lg border border-line bg-background px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 text-[11.5px] text-ink-2 hover:bg-surface-2">
              <Paperclip aria-hidden className="h-3.5 w-3.5" />
              {t("portal.addAttachment")}
              <input type="file" multiple accept={ATTACHMENT_ACCEPT} className="hidden" onChange={onFilesChosen} data-testid="reply-attachments-input" />
            </label>
            <Button type="submit" size="sm" disabled={sendMessage.isPending || !body.trim()} data-testid="send-reply">
              <Send aria-hidden className="h-3.5 w-3.5" />
              {t("portal.send")}
            </Button>
          </div>
          {files.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center gap-1.5 rounded-full border border-line-2 px-2.5 py-1 text-[11px]">
                  <span className="max-w-[140px] truncate">{file.name}</span>
                  <button type="button" onClick={() => setFiles((previous) => previous.filter((_, i) => i !== index))} aria-label={t("common.remove")}>
                    <X aria-hidden className="h-3 w-3 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </form>
      </div>
    </div>
  );
}
