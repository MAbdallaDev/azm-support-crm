import { MessageSquare, Send, X } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { usePortalMessages, useSendPortalMessage } from "@/api/portal";
import { useChatWidget } from "@/features/portal/ChatWidgetContext";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";

/**
 * A floating launcher + chat panel, mounted once in `PortalChrome` so it
 * persists across every portal route — the customer never leaves whatever
 * page they were on to talk to support. Still backed by an ordinary
 * `channel: "chat"` ticket underneath (reusing `usePortalMessages`/
 * `useSendPortalMessage` as-is, and `ChatWidgetContext` for which ticket and
 * whether the panel is open); only the presentation is a widget, not a page.
 */

const SEEN_KEY = (ticketId: number) => `crm.chatWidget.seen.${ticketId}`;

export function PortalChatWidget() {
  const { t } = useTranslation();
  const { open, ticketId, launching, openChat, closeChat } = useChatWidget();
  const [body, setBody] = React.useState("");

  // Enabled whenever a chat ticket exists, regardless of `open` — so a badge
  // can reflect a support reply that arrived while the panel was closed.
  // Only the poll *rate* changes with `open` (this codebase's existing
  // live/not-live convention), not whether it fetches at all.
  const { data: messages } = usePortalMessages(ticketId, open);
  const sendMessage = useSendPortalMessage();

  const seenKey = ticketId ? SEEN_KEY(ticketId) : null;
  const seenCount = seenKey ? Number(localStorage.getItem(seenKey) ?? "0") : 0;
  const lastMessage = messages && messages.length > 0 ? messages[messages.length - 1] : null;
  const hasUnread = !open && (messages?.length ?? 0) > seenCount && lastMessage?.author_kind === "support";

  React.useEffect(() => {
    if (open && seenKey && messages) {
      localStorage.setItem(seenKey, String(messages.length));
    }
  }, [open, seenKey, messages]);

  const onSend = (event: React.FormEvent) => {
    event.preventDefault();
    if (!ticketId || !body.trim()) return;
    sendMessage.mutate(
      { id: ticketId, body, attachments: [] },
      {
        onSuccess: () => setBody(""),
        onError: () => toast.error(t("portal.replyFailed")),
      },
    );
  };

  return (
    <>
      {open ? (
        <div
          data-testid="chat-widget-panel"
          className="fixed bottom-5 z-50 flex h-[520px] w-[360px] flex-col overflow-hidden rounded-2xl bg-background shadow-2xl"
          style={{ insetInlineEnd: "20px" }}
        >
          <div className="flex flex-none items-start gap-2.5 bg-ink px-4 pb-3.5 pt-4">
            <span
              aria-hidden
              className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-channel-chat"
            >
              <MessageSquare className="h-[17px] w-[17px] text-white" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="text-[14px] font-bold text-white">{t("portal.chatWidgetTitle")}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-white/65">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {t("portal.chatWidgetSubtitle")}
              </div>
            </div>
            <button
              type="button"
              onClick={closeChat}
              aria-label={t("common.close")}
              data-testid="chat-widget-close"
              className="flex-none pt-0.5 text-white/70 hover:text-white"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2 p-4">
            {!ticketId ? (
              <div className="flex h-full items-center justify-center text-[12.5px] text-muted-foreground">
                {t("portal.chatWidgetStarting")}
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {(messages ?? []).map((message) => (
                  <li
                    key={message.id}
                    className={cn("flex flex-col gap-0.5", message.author_kind === "you" ? "items-end" : "items-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[240px] whitespace-pre-wrap rounded-[10px] px-3 py-2.5 text-[13px] leading-[1.5]",
                        message.author_kind === "you"
                          ? "rounded-ee-[3px] bg-ink text-white"
                          : "rounded-es-[3px] bg-surface-3 text-ink",
                      )}
                    >
                      {message.body}
                    </div>
                    <span className="px-[3px] text-[10px] text-faint">{formatRelative(message.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={onSend} className="flex flex-none items-center gap-2 border-t border-line bg-background p-3">
            <input
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t("portal.replyPlaceholder")}
              disabled={!ticketId}
              data-testid="chat-widget-composer"
              className="h-[38px] flex-1 rounded-[10px] border border-line bg-surface-2 px-3 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={!ticketId || sendMessage.isPending || !body.trim()}
              data-testid="chat-widget-send"
              className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-brand text-white disabled:opacity-60"
              aria-label={t("portal.send")}
            >
              <Send aria-hidden className="h-[15px] w-[15px]" />
            </button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={openChat}
          disabled={launching}
          data-testid="chat-widget-launcher"
          aria-label={t("portal.startLiveChat")}
          className="fixed bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-channel-chat text-white shadow-lg hover:brightness-110 disabled:opacity-70"
          style={{ insetInlineEnd: "24px" }}
        >
          <MessageSquare aria-hidden className="h-6 w-6" />
          {hasUnread ? (
            <span
              data-testid="chat-widget-unread-badge"
              className="absolute -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-background bg-priority-urgent px-1 text-[10px] font-bold text-white"
              style={{ insetInlineEnd: "-2px" }}
            >
              1
            </span>
          ) : null}
        </button>
      )}
    </>
  );
}
