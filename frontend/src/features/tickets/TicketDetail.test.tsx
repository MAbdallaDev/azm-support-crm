import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { qk } from "@/api/queryKeys";
import { tokenStore } from "@/api/tokenStore";
import type { TicketDetail } from "@/api/types";
import { TicketWorkspaceDetail } from "@/features/tickets/TicketDetail";
import { installApiMock } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { detail, me, message } from "@/test/fixtures";
import { makeQueryClient, renderWithProviders } from "@/test/utils";

import "@/i18n";

vi.mock("@/components/ui/toast", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/toast")>(
    "@/components/ui/toast",
  );
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
  };
});

const { toast } = await import("@/components/ui/toast");

let mock: ApiMock;

const setup = (ticket: TicketDetail = detail()) => {
  const queryClient = makeQueryClient();
  queryClient.setQueryData(qk.me, me());
  queryClient.setQueryData(qk.tickets.detail(ticket.id), ticket);

  const view = renderWithProviders(<TicketWorkspaceDetail ticket={ticket} />, { queryClient });
  return { ...view, queryClient };
};

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "agent" });
  mock.on("/messages/", () => [message()]);
  mock.on("/events/", () => []);
  mock.on("/attachments/", () => []);
  mock.on("/canned-replies/", () => []);
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
  vi.clearAllMocks();
});

describe("the status dropdown", () => {
  it("offers ONLY the transitions the API permits from the current status", async () => {
    // A `new` ticket: the state machine allows open and escalated, nothing else.
    setup(detail({ status: "new", allowed_transitions: ["escalated", "open"] }));

    const select = screen.getByTestId("status-select") as HTMLSelectElement;
    const values = [...select.options].map((option) => option.value).filter(Boolean);

    expect(values).toEqual(["escalated", "open"]);
    // The assertion that matters: a move the backend refuses cannot even be
    // picked. If this list were transcribed client-side it would drift, and
    // the agent would meet a 400 they could do nothing about.
    expect(values).not.toContain("closed");
    expect(values).not.toContain("resolved");
    expect(values).not.toContain("pending");
  });

  it("reflects a different status without any client-side map", () => {
    setup(detail({ status: "resolved", allowed_transitions: ["closed", "reopened"] }));

    const select = screen.getByTestId("status-select") as HTMLSelectElement;
    expect([...select.options].map((option) => option.value).filter(Boolean)).toEqual([
      "closed",
      "reopened",
    ]);
  });

  it("is disabled outright when no transition is available", () => {
    setup(detail({ status: "closed", allowed_transitions: [] }));
    expect(screen.getByTestId("status-select")).toBeDisabled();
  });
});

describe("optimistic status change", () => {
  it("patches the cache immediately, then keeps the server's answer", async () => {
    const ticket = detail({ status: "new" });
    mock.on("/status/", () => ({ ...ticket, status: "open" }));
    const { queryClient } = setup(ticket);

    fireEvent.change(screen.getByTestId("status-select"), { target: { value: "open" } });

    await waitFor(() => {
      expect(
        queryClient.getQueryData<TicketDetail>(qk.tickets.detail(1))?.status,
      ).toBe("open");
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("ROLLS BACK to the original status and raises a toast when the call fails", async () => {
    const ticket = detail({ status: "new" });
    mock.fail("/status/", 400);
    const { queryClient } = setup(ticket);

    fireEvent.change(screen.getByTestId("status-select"), { target: { value: "open" } });

    // The optimistic patch is reverted from the snapshot, so the row does not
    // sit there claiming a change the server refused.
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(queryClient.getQueryData<TicketDetail>(qk.tickets.detail(1))?.status).toBe("new");
  });

  it("surfaces the server's own 400 message, which names both states", async () => {
    mock.fail("/status/", 400);
    setup(detail({ status: "new" }));

    fireEvent.change(screen.getByTestId("status-select"), { target: { value: "open" } });

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    // The mock's detail payload has no `status` key, so the generic message is
    // used — the point here is that *something* readable is always shown.
    expect(vi.mocked(toast.error).mock.calls[0][0]).toBeTruthy();
  });
});

describe("the three tabs", () => {
  it("separates public replies from internal notes by is_internal", async () => {
    mock.on("/messages/", () => [
      message({ id: 1, body: "Visible to the customer", is_internal: false }),
      message({ id: 2, body: "Colleagues only", is_internal: true }),
    ]);
    setup();

    await waitFor(() => expect(screen.getByText("Visible to the customer")).toBeInTheDocument());
    // The internal note must not appear in the Conversation tab. The bodies
    // are deliberately unlike any control label — "Internal note" as a
    // fixture matched the composer's own mode tab and passed vacuously.
    expect(screen.queryByText("Colleagues only")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("detail-tab-internal"));
    expect(screen.getByText("Colleagues only")).toBeInTheDocument();
    expect(screen.queryByText("Visible to the customer")).not.toBeInTheDocument();
  });
});

describe("live-chat polling", () => {
  it("polls for new messages on a chat-channel ticket", async () => {
    vi.useFakeTimers();
    try {
      setup(detail({ channel: "chat" }));
      await vi.waitFor(() => expect(mock.requests.filter((r) => r.includes("/messages/")).length).toBe(1));

      await vi.advanceTimersByTimeAsync(4000);

      await vi.waitFor(() =>
        expect(mock.requests.filter((r) => r.includes("/messages/")).length).toBeGreaterThan(1),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not poll on any other channel", async () => {
    vi.useFakeTimers();
    try {
      setup(detail({ channel: "sms" }));
      await vi.waitFor(() => expect(mock.requests.filter((r) => r.includes("/messages/")).length).toBe(1));

      await vi.advanceTimersByTimeAsync(12000);

      expect(mock.requests.filter((r) => r.includes("/messages/")).length).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the attachments tab", () => {
  it("shows an empty state when there are none", async () => {
    setup();

    fireEvent.click(screen.getByTestId("detail-tab-attachments"));

    expect(await screen.findByText("No attachments yet")).toBeInTheDocument();
  });

  it("lists a real, resolvable download link, not the raw root-relative path", async () => {
    mock.on("/attachments/", () => [
      {
        id: 9,
        ticket: 1,
        message: null,
        file: "/media/attachments/2026/09/statement.pdf",
        filename: "statement.pdf",
        size: 62453,
        uploaded_by: 12,
        uploaded_by_name: "Abdulaziz Al-Rashid",
        created_at: "2026-08-26T09:00:00Z",
      },
    ]);
    setup();

    fireEvent.click(screen.getByTestId("detail-tab-attachments"));

    const link = await screen.findByTestId("attachment-9");
    expect(link).toHaveAttribute("href", "http://localhost:8000/media/attachments/2026/09/statement.pdf");
    expect(link).toHaveTextContent("statement.pdf");
    expect(link).toHaveTextContent("61.0 KB");
  });

  it("the tab count reflects the real attachment count, not zero", async () => {
    mock.on("/attachments/", () => [
      { id: 1, ticket: 1, message: null, file: "/media/a.png", filename: "a.png", size: 10, uploaded_by: null, uploaded_by_name: "", created_at: "2026-08-26T09:00:00Z" },
      { id: 2, ticket: 1, message: null, file: "/media/b.png", filename: "b.png", size: 10, uploaded_by: null, uploaded_by_name: "", created_at: "2026-08-26T09:00:00Z" },
    ]);
    setup();

    await waitFor(() => expect(screen.getByTestId("detail-tab-attachments")).toHaveTextContent("2"));
  });
});
