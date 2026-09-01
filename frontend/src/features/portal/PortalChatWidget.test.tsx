import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { tokenStore } from "@/api/tokenStore";
import type { PortalTicket } from "@/api/types";
import { ChatWidgetProvider } from "@/features/portal/ChatWidgetContext";
import { PortalChatWidget } from "@/features/portal/PortalChatWidget";
import { installApiMock, page } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { makeQueryClient, renderWithProviders } from "@/test/utils";

import "@/i18n";

let mock: ApiMock;

const chatTicket = (over: Partial<PortalTicket> = {}): PortalTicket => ({
  id: 7,
  number: "TK-0151",
  subject: "Live chat",
  status: "open",
  category: "",
  channel: "chat",
  created_at: "2026-09-01T09:00:00Z",
  target_date: null,
  resolved_at: null,
  message_count: 1,
  csat: null,
  ...over,
});

const setup = () =>
  renderWithProviders(
    <ChatWidgetProvider>
      <PortalChatWidget />
    </ChatWidgetProvider>,
    { queryClient: makeQueryClient() },
  );

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "customer" });
  localStorage.clear();
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
});

describe("closed — the launcher", () => {
  it("shows no unread badge when there is no chat ticket yet", async () => {
    mock.on("/portal/tickets/", () => page([]));
    setup();

    await screen.findByTestId("chat-widget-launcher");
    expect(screen.queryByTestId("chat-widget-unread-badge")).not.toBeInTheDocument();
  });

  it("shows an unread badge when the last message is from support and unseen", async () => {
    mock.on("/portal/tickets/", () => page([chatTicket()]));
    mock.on("/portal/tickets/7/messages/", () => [
      { id: 1, body: "Hi, how can we help?", author_kind: "support", created_at: "2026-09-01T09:05:00Z" },
    ]);
    setup();

    expect(await screen.findByTestId("chat-widget-unread-badge")).toBeInTheDocument();
  });

  it("shows no badge when the customer sent the last message themselves", async () => {
    mock.on("/portal/tickets/", () => page([chatTicket()]));
    mock.on("/portal/tickets/7/messages/", () => [
      { id: 1, body: "Hello?", author_kind: "you", created_at: "2026-09-01T09:05:00Z" },
    ]);
    setup();

    await waitFor(() => expect(mock.requests.some((r) => r.includes("/messages/"))).toBe(true));
    expect(screen.queryByTestId("chat-widget-unread-badge")).not.toBeInTheDocument();
  });

  it("creates a new ticket on click when none exists, then opens the panel", async () => {
    mock.on("/portal/tickets/", (config) =>
      (config.method ?? "get").toLowerCase() === "post" ? { id: 7, number: "TK-0151" } : page([]),
    );
    mock.on("/portal/tickets/7/messages/", () => []);
    setup();

    fireEvent.click(await screen.findByTestId("chat-widget-launcher"));

    await waitFor(() => expect(mock.requests.some((r) => r === "POST /portal/tickets/")).toBe(true));
    expect(await screen.findByTestId("chat-widget-panel")).toBeInTheDocument();
  });
});

describe("open — the panel", () => {
  const openIt = async () => {
    mock.on("/portal/tickets/", () => page([chatTicket()]));
    mock.on("/portal/tickets/7/messages/", () => [
      { id: 1, body: "Hi, how can we help?", author_kind: "support", created_at: "2026-09-01T09:05:00Z" },
    ]);
    setup();
    fireEvent.click(await screen.findByTestId("chat-widget-launcher"));
    return screen.findByTestId("chat-widget-panel");
  };

  it("shows the conversation and marks it seen (clearing the badge once closed again)", async () => {
    await openIt();

    expect(await screen.findByText("Hi, how can we help?")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("chat-widget-close"));

    await screen.findByTestId("chat-widget-launcher");
    expect(screen.queryByTestId("chat-widget-unread-badge")).not.toBeInTheDocument();
  });

  it("sends a reply and clears the composer", async () => {
    await openIt();
    mock.on("/portal/tickets/7/messages/", (config) =>
      (config.method ?? "get").toLowerCase() === "post"
        ? { id: 2, body: "Thanks!", author_kind: "you", created_at: "2026-09-01T09:06:00Z" }
        : [{ id: 1, body: "Hi, how can we help?", author_kind: "support", created_at: "2026-09-01T09:05:00Z" }],
    );

    fireEvent.change(screen.getByTestId("chat-widget-composer"), { target: { value: "Thanks!" } });
    fireEvent.click(screen.getByTestId("chat-widget-send"));

    await waitFor(() =>
      expect(mock.requests.some((r) => r === "POST /portal/tickets/7/messages/")).toBe(true),
    );
    await waitFor(() =>
      expect((screen.getByTestId("chat-widget-composer") as HTMLInputElement).value).toBe(""),
    );
  });
});
