import { ExternalLink, MessageSquare, Send } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useLiveChatInbox, useSendMessage, useTicketMessages } from "@/api/tickets";
import type { LiveChatConversation } from "@/api/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/toast";
import { formatRelative } from "@/lib/format";
import { cn, initials } from "@/lib/utils";

/**
 * A dedicated messaging-app screen for `channel: "chat"` tickets — deliberately
 * separate from `Tickets.tsx`'s three-pane ticket workspace. No priority, SLA,
 * category or internal-note chrome anywhere here: a live chat is a
 * conversation, not a case to manage. The underlying data is still an
 * ordinary ticket (reusing `useTicketMessages`/`useSendMessage` as-is), so a
 * small "View ticket record" link is the only bridge back to that world, kept
 * deliberately secondary.
 */

function ConversationRow({
  conversation,
  active,
}: {
  conversation: LiveChatConversation;
  active: boolean;
}) {
  return (
    <Link
      to={`/app/live-chat/${conversation.id}`}
      data-testid={`live-chat-row-${conversation.id}`}
      className={cn(
        "flex items-start gap-2.5 border-b border-line-2 px-4 py-3",
        active
          ? "border-s-[3px] border-s-channel-chat bg-surface-3 ps-[13px]"
          : "hover:bg-surface-2",
      )}
    >
      <span
        aria-hidden
        className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-channel-chat-bg text-[13px] font-bold text-channel-chat"
      >
        {initials(conversation.customer_name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[13.5px] font-bold">{conversation.customer_name}</span>
          <span className="flex-none text-[11px] text-muted-foreground">
            {formatRelative(conversation.last_message_at)}
          </span>
        </div>
        <p
          className={cn(
            "mt-0.5 truncate text-[12.5px]",
            conversation.awaiting_reply ? "font-semibold text-ink" : "text-ink-2",
          )}
        >
          {conversation.last_message || conversation.number}
        </p>
      </div>
    </Link>
  );
}

export default function LiveChat() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const selectedId = id ? Number(id) : null;

  const { data: conversations, isPending } = useLiveChatInbox();
  const { data: messages, isPending: messagesPending } = useTicketMessages(selectedId, true);
  const sendMessage = useSendMessage();
  const [body, setBody] = React.useState("");

  const selected = (conversations ?? []).find((c) => c.id === selectedId) ?? null;

  // Land on the first open conversation rather than an empty pane, matching
  // the messaging-app convention this screen follows — but only once, so
  // sending a reply that reorders the list doesn't yank the agent elsewhere.
  const landedRef = React.useRef(false);
  React.useEffect(() => {
    if (!landedRef.current && selectedId === null && (conversations?.length ?? 0) > 0) {
      landedRef.current = true;
      navigate(`/app/live-chat/${conversations![0].id}`, { replace: true });
    }
  }, [conversations, selectedId, navigate]);

  const onSend = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedId || !body.trim()) return;
    sendMessage.mutate(
      { id: selectedId, body, is_internal: false },
      {
        onSuccess: () => setBody(""),
        onError: () => toast.error(t("liveChat.sendFailed")),
      },
    );
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0">
      <aside className="flex w-[320px] flex-none flex-col border-e border-line bg-background">
        <div className="flex-none px-4 pb-3 pt-4">
          <h1 className="text-[17px] font-bold tracking-[-0.01em]">{t("liveChat.title")}</h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {t("liveChat.activeCount", { count: conversations?.length ?? 0 })}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isPending ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : (conversations ?? []).length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={t("liveChat.noConversations")}
              description={t("liveChat.noConversationsBody")}
            />
          ) : (
            (conversations ?? []).map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === selectedId}
              />
            ))
          )}
        </div>
      </aside>

      {selected === null ? (
        <section className="flex min-w-0 flex-1 items-center justify-center bg-surface-2">
          <EmptyState
            icon={MessageSquare}
            title={t("liveChat.selectTitle")}
            description={t("liveChat.selectBody")}
          />
        </section>
      ) : (
        <section className="flex min-w-0 flex-1 flex-col bg-surface-2">
          <header className="flex flex-none items-center gap-2.5 border-b border-line bg-background px-[22px] py-3.5">
            <span
              aria-hidden
              className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-channel-chat-bg text-[12.5px] font-bold text-channel-chat"
            >
              {initials(selected.customer_name)}
            </span>
            <div className="min-w-0">
              <div className="text-[14px] font-bold">{selected.customer_name}</div>
              <div className="text-[11.5px] text-muted-foreground">
                {t("liveChat.startedRelative", { when: formatRelative(selected.created_at) })}
              </div>
            </div>
            <span className="flex-1" />
            <Link
              to={`/app/tickets/${selected.id}`}
              data-testid="view-ticket-record"
              className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground hover:text-ink-2"
            >
              <ExternalLink aria-hidden className="h-3 w-3" />
              {t("liveChat.viewTicketRecord", { number: selected.number })}
            </Link>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-7 py-[22px]">
            {messagesPending ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="h-14 w-2/3" />
                ))}
              </div>
            ) : (
              <ul className="flex flex-col gap-3.5">
                {(messages ?? [])
                  .filter((message) => !message.is_internal)
                  .map((message) => {
                    const fromCustomer = message.author_role === "customer";
                    return (
                      <li
                        key={message.id}
                        className={cn("flex flex-col gap-1", fromCustomer ? "items-start" : "items-end")}
                      >
                        <div
                          className={cn(
                            "max-w-[480px] rounded-[10px] px-[15px] py-[11px] text-[13.5px] leading-[1.55] whitespace-pre-wrap",
                            fromCustomer
                              ? "rounded-es-[3px] bg-surface-3 text-ink"
                              : "rounded-ee-[3px] bg-ink text-white",
                          )}
                        >
                          {message.body}
                        </div>
                        <span className="px-[3px] text-[10.5px] text-faint">
                          {formatRelative(message.created_at)}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>

          <form onSubmit={onSend} className="flex flex-none items-center gap-2.5 border-t border-line bg-background px-[22px] py-3.5">
            <input
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t("liveChat.typeMessage")}
              data-testid="live-chat-composer"
              className="h-10 flex-1 rounded-[10px] border border-line bg-surface-2 px-3.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={sendMessage.isPending || !body.trim()}
              data-testid="live-chat-send"
              className="flex h-10 flex-none items-center gap-1.5 rounded-[10px] bg-brand px-[18px] text-[13px] font-semibold text-white disabled:opacity-60"
            >
              {t("liveChat.send")}
              <Send aria-hidden className="h-3.5 w-3.5" />
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
