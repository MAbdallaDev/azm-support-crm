import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { qk } from "@/api/queryKeys";
import { tokenStore } from "@/api/tokenStore";
import type { TicketDetail } from "@/api/types";
import { TicketContext } from "@/features/tickets/TicketContext";
import { installApiMock, page } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { customer, detail, listRow, me } from "@/test/fixtures";
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

const setup = (ticket: TicketDetail = detail(), meOver: Partial<ReturnType<typeof me>> = {}) => {
  const queryClient = makeQueryClient();
  queryClient.setQueryData(qk.me, me(meOver));
  return renderWithProviders(<TicketContext ticket={ticket} />, { queryClient });
};

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "agent" });
  mock.on("/customers/10/", () => customer());
  mock.on("/customers/10/notes/", () => []);
  mock.on("/tickets/?", () => page([]));
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
  vi.clearAllMocks();
});

describe("the Customer tab", () => {
  it("is the default tab and shows the customer's own record, not the ticket's", async () => {
    setup();

    expect(await screen.findByText("k.omari@omaricon.sa")).toBeInTheDocument();
    expect(screen.getByText("Riyadh")).toBeInTheDocument();
    expect(screen.getByTestId("context-tab-customer")).toHaveAttribute("aria-pressed", "true");
  });

  it("links to the customer's own 360 page", async () => {
    setup();
    await screen.findByText("k.omari@omaricon.sa");

    const link = screen.getByText("View customer").closest("a");
    expect(link).toHaveAttribute("href", "/app/customers/10");
  });
});

describe("the History tab", () => {
  it("shows other tickets for the same customer, excluding this one", async () => {
    mock.on("/tickets/?", () =>
      page([listRow({ id: 1 }), listRow({ id: 2, number: "TK-0002", subject: "A second issue" })]),
    );
    setup(detail({ id: 1 }));

    fireEvent.click(screen.getByTestId("context-tab-history"));

    expect(await screen.findByText("A second issue")).toBeInTheDocument();
    // The current ticket (id 1) must never list itself as its own history.
    expect(screen.queryByText("SMS notifications arriving hours late")).not.toBeInTheDocument();
  });

  it("shows an empty state when the customer has no other tickets", async () => {
    mock.on("/tickets/?", () => page([listRow({ id: 1 })]));
    setup(detail({ id: 1 }));

    fireEvent.click(screen.getByTestId("context-tab-history"));

    expect(await screen.findByText("No other tickets")).toBeInTheDocument();
  });
});

describe("the Notes tab", () => {
  it("lists existing customer notes", async () => {
    mock.on("/customers/10/notes/", () => [
      { id: 1, author_name: "Sara Otaibi", body: "Prefers a callback over email.", created_at: "2026-08-20T09:00:00Z" },
    ]);
    setup();

    fireEvent.click(screen.getByTestId("context-tab-notes"));

    expect(await screen.findByText("Prefers a callback over email.")).toBeInTheDocument();
  });

  it("adds a note and clears the textarea on success", async () => {
    mock.on("/customers/10/notes/", (config) =>
      (config.method ?? "get").toLowerCase() === "post"
        ? { id: 9, author_name: "Mostafa Abdalla agent", body: "Called back, resolved.", created_at: "2026-08-27T09:00:00Z" }
        : [],
    );
    setup();

    fireEvent.click(screen.getByTestId("context-tab-notes"));
    const textarea = await screen.findByPlaceholderText("Add a note…");
    fireEvent.change(textarea, { target: { value: "Called back, resolved." } });
    fireEvent.click(screen.getByRole("button", { name: /save note/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });

  it("never submits a blank note", async () => {
    setup();
    fireEvent.click(screen.getByTestId("context-tab-notes"));

    await screen.findByPlaceholderText("Add a note…");
    expect(screen.getByRole("button", { name: /save note/i })).toBeDisabled();
  });
});

describe("the Assignment block", () => {
  it("offers 'Assign to me' when the ticket is not already the caller's", async () => {
    setup(detail({ assignee: null }), { id: 42 });

    expect(await screen.findByTestId("assign-to-me")).toBeInTheDocument();
  });

  it("hides 'Assign to me' once the ticket is already assigned to the caller", async () => {
    setup(
      detail({
        assignee: { id: 42, username: "mostafa_ag", full_name: "Mostafa Abdalla agent", role: "agent" },
      }),
      { id: 42 },
    );

    await screen.findByText("Mostafa Abdalla agent");
    expect(screen.queryByTestId("assign-to-me")).not.toBeInTheDocument();
  });

  it("assigns to the caller and confirms on success", async () => {
    const ticket = detail({ id: 1, assignee: null });
    mock.on("/assign/", () => ({
      ...ticket,
      assignee: { id: 42, username: "mostafa_ag", full_name: "Mostafa Abdalla agent", role: "agent" },
    }));
    setup(ticket, { id: 42 });

    fireEvent.click(await screen.findByTestId("assign-to-me"));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(mock.requests.some((r) => r === "POST /tickets/1/assign/")).toBe(true);
  });

  it("shows a distinct message when auto-assign finds no eligible agent (409), not a generic failure", async () => {
    const ticket = detail({ id: 1, assignee: null });
    mock.fail("/assign/", 409);
    setup(ticket, { id: 42 });

    fireEvent.click(screen.getByTitle("Auto-assign"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "No agent in this department is available right now.",
      ),
    );
  });

  it("shows a generic failure message for any other assign error", async () => {
    const ticket = detail({ id: 1, assignee: null });
    mock.fail("/assign/", 500);
    setup(ticket, { id: 42 });

    fireEvent.click(screen.getByTitle("Auto-assign"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("The ticket could not be assigned."),
    );
  });

  it("shows tags, department and branch as pills", async () => {
    setup(
      detail({
        department: "technical",
        branch: "riyadh",
        tags: [{ id: 1, name_en: "VIP", name_ar: "بارز", color: "#000" }],
      }),
    );

    expect(await screen.findByText("technical")).toBeInTheDocument();
    expect(screen.getByText("riyadh")).toBeInTheDocument();
    expect(screen.getByText("VIP")).toBeInTheDocument();
  });
});
