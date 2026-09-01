import * as React from "react";
import { useTranslation } from "react-i18next";

import { usePortalTickets, useSubmitPortalTicket } from "@/api/portal";
import { toast } from "@/components/ui/toast";

/**
 * Owns the one piece of state the floating chat widget and every page that
 * can launch it (currently just `PortalHome`'s "Start a live chat" button)
 * both need: which ticket backs the conversation, and whether the panel is
 * open. Living here rather than inside `PortalChatWidget` itself means a
 * launch button elsewhere in the portal never needs to duplicate the
 * find-or-create logic — it just calls `openChat()`.
 */

const OPEN_CHAT_STATUSES_EXCLUDING = new Set(["resolved", "closed"]);

type ChatWidgetContextValue = {
  open: boolean;
  ticketId: number | null;
  launching: boolean;
  openChat: () => void;
  closeChat: () => void;
};

const ChatWidgetContext = React.createContext<ChatWidgetContextValue | null>(null);

export function ChatWidgetProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  const { data: ticketsPage } = usePortalTickets(new URLSearchParams({ page_size: "100" }));
  const existingTicket = (ticketsPage?.results ?? []).find(
    (ticket) => ticket.channel === "chat" && !OPEN_CHAT_STATUSES_EXCLUDING.has(ticket.status),
  ) ?? null;

  const submitChat = useSubmitPortalTicket();

  const openChat = () => {
    if (existingTicket) {
      setOpen(true);
      return;
    }
    submitChat.mutate(
      {
        subject: t("portal.liveChatSubject"),
        description: t("portal.liveChatSubject"),
        category: null,
        channel: "chat",
        attachments: [],
      },
      {
        onSuccess: () => setOpen(true),
        onError: () => toast.error(t("portal.submitFailed")),
      },
    );
  };

  const value = React.useMemo<ChatWidgetContextValue>(
    () => ({
      open,
      ticketId: existingTicket?.id ?? null,
      launching: submitChat.isPending,
      openChat,
      closeChat: () => setOpen(false),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, existingTicket?.id, submitChat.isPending],
  );

  return <ChatWidgetContext.Provider value={value}>{children}</ChatWidgetContext.Provider>;
}

export function useChatWidget(): ChatWidgetContextValue {
  const context = React.useContext(ChatWidgetContext);
  if (!context) {
    throw new Error("useChatWidget must be used within a ChatWidgetProvider");
  }
  return context;
}
