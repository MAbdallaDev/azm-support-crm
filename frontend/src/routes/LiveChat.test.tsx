import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { tokenStore } from "@/api/tokenStore";
import LiveChat from "@/routes/LiveChat";
import { installApiMock } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { makeQueryClient, renderWithDataRouter } from "@/test/utils";

import "@/i18n";

let mock: ApiMock;

const conversation = (over: Record<string, unknown> = {}) => ({
  id: 1,
  number: "TK-0151",
  customer_name: "Hind Al-Subaie",
  last_message: "Could you confirm roughly when this will be looked at?",
  last_message_at: "2026-09-01T12:09:00Z",
  awaiting_reply: true,
  created_at: "2026-09-01T09:00:00Z",
  ...over,
});

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "agent" });
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
});

describe("the inbox", () => {
  it("shows an empty state when there are no active conversations", async () => {
    mock.on("/tickets/live-chat/", () => []);
    renderWithDataRouter(<LiveChat />, { queryClient: makeQueryClient() });

    expect(await screen.findByText("No active conversations")).toBeInTheDocument();
    expect(screen.getByText("Select a conversation")).toBeInTheDocument();
  });

  it("lists a conversation by customer name and last message, not a ticket card", async () => {
    // Landed directly on the conversation (rather than the bare index route)
    // so the "auto-select the first open conversation" effect has nothing to
    // do — this test is about the row's own content, not that effect.
    mock.on("/tickets/live-chat/", () => [conversation()]);
    mock.on("/tickets/1/messages/", () => []);
    renderWithDataRouter(<LiveChat />, {
      queryClient: makeQueryClient(),
      path: "/live-chat/:id",
      route: "/live-chat/1",
    });

    const row = await screen.findByTestId("live-chat-row-1");
    expect(row).toHaveTextContent("Hind Al-Subaie");
    expect(row).toHaveTextContent("Could you confirm roughly when this will be looked at?");
    // The whole point of this screen: no priority/SLA/category chrome.
    expect(screen.queryByText(/breach/i)).not.toBeInTheDocument();
  });
});

describe("an open conversation", () => {
  const setup = () => {
    mock.on("/tickets/live-chat/", () => [conversation(), conversation({ id: 2, customer_name: "Salman Al-Anzi" })]);
    mock.on("/tickets/1/messages/", () => [
      { id: 10, ticket: 1, author: 7, author_name: "Hind Al-Subaie", author_role: "customer", body: "Hi there", is_internal: false, channel: "chat", created_at: "2026-09-01T12:00:00Z" },
      { id: 11, ticket: 1, author: 2, author_name: "Mostafa Abdalla", author_role: "agent", body: "How can I help?", is_internal: false, channel: "chat", created_at: "2026-09-01T12:01:00Z" },
    ]);
    return renderWithDataRouter(<LiveChat />, {
      queryClient: makeQueryClient(),
      path: "/live-chat/:id",
      route: "/live-chat/1",
    });
  };

  it("renders the thread with the customer's messages on one side and the agent's on the other", async () => {
    setup();

    expect(await screen.findByText("Hi there")).toBeInTheDocument();
    expect(screen.getByText("How can I help?")).toBeInTheDocument();
  });

  it("has no SLA bar, category, priority, or internal-note toggle anywhere", async () => {
    setup();
    await screen.findByText("Hi there");

    for (const forbidden of [/priority/i, /category/i, /internal note/i, /sending via/i]) {
      expect(screen.queryByText(forbidden)).not.toBeInTheDocument();
    }
  });

  it("carries a secondary link back to the underlying ticket record", async () => {
    setup();
    await screen.findByText("Hi there");

    const link = screen.getByTestId("view-ticket-record");
    expect(link).toHaveAttribute("href", "/app/tickets/1");
    expect(link).toHaveTextContent("TK-0151");
  });

  it("carries a mobile-only back-to-inbox link, hidden at md and up", async () => {
    // The inbox list and the open conversation are a fixed 320px + flex-1 row
    // that only fits from `md` up — below that, opening a conversation must
    // be a genuine "back" flow, not a squeeze. Found live at 375px: the list
    // and thread rendered side by side with no way back, both unreadable.
    setup();
    await screen.findByText("Hi there");

    const back = screen.getByTestId("back-to-inbox");
    expect(back).toHaveAttribute("href", "/app/live-chat");
    expect(back.className).toContain("md:hidden");

    // The inbox list itself hides below `md` once a conversation is open —
    // it stays in the DOM (so desktop's side-by-side layout still works),
    // it's just not shown as a second column on a phone.
    expect(screen.getByTestId("live-chat-inbox").className).toContain("hidden");
  });

  it("sends a reply and clears the composer", async () => {
    mock.on("/tickets/1/messages/", (config) =>
      (config.method ?? "get").toLowerCase() === "post"
        ? { id: 12, ticket: 1, author: 2, author_name: "Mostafa Abdalla", author_role: "agent", body: "On it", is_internal: false, channel: "chat", created_at: "2026-09-01T12:05:00Z" }
        : [],
    );
    setup();
    await screen.findByTestId("live-chat-composer");

    fireEvent.change(screen.getByTestId("live-chat-composer"), { target: { value: "On it" } });
    fireEvent.click(screen.getByTestId("live-chat-send"));

    await waitFor(() =>
      expect(mock.requests.some((r) => r === "POST /tickets/1/messages/")).toBe(true),
    );
    await waitFor(() => expect((screen.getByTestId("live-chat-composer") as HTMLInputElement).value).toBe(""));
  });
});
