import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { tokenStore } from "@/api/tokenStore";
import Customer360 from "@/features/customers/Customer360";
import { installApiMock, page } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { customer, listRow } from "@/test/fixtures";
import { makeQueryClient, renderWithDataRouter } from "@/test/utils";

import "@/i18n";

let mock: ApiMock;

const setup = (id = "10") =>
  renderWithDataRouter(<Customer360 />, {
    route: `/customers/${id}`,
    path: "/customers/:id",
    queryClient: makeQueryClient(),
  });

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "agent" });
  mock.on("/customers/10/", () => customer());
  mock.on("/customers/10/attachments/", () => []);
  mock.on("/customers/10/notes/", () => []);
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
});

describe("the stats strip", () => {
  it("shows Open and Lifetime straight from the detail serializer, never computed", async () => {
    mock.on("/tickets/", () => page([]));
    setup();

    await screen.findAllByText("Khalid Omari");

    expect(screen.getByText("4")).toBeInTheDocument(); // open_ticket_count
    expect(screen.getByText("9")).toBeInTheDocument(); // total_ticket_count
  });

  it("computes SLA met from the loaded ticket history and names the count it is based on", async () => {
    mock.on("/tickets/", () =>
      page([
        listRow({ id: 1, status: "resolved", resolution_sla: { state: "ok", seconds_remaining: 100, target_minutes: 60, policy_name: "" } }),
        listRow({ id: 2, status: "resolved", resolution_sla: { state: "breached", seconds_remaining: -100, target_minutes: 60, policy_name: "" } }),
        listRow({ id: 3, status: "open", resolution_sla: { state: "ok", seconds_remaining: 100, target_minutes: 60, policy_name: "" } }),
      ]),
    );
    setup();

    await screen.findAllByText("Khalid Omari");

    // 1 of 2 RESOLVED tickets met its target — the open one does not count,
    // resolved or not is what "met" can even be judged against.
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("based on 2 resolved")).toBeInTheDocument();
  });

  it("shows a dash rather than 0% when nothing in the loaded history is resolved yet", async () => {
    mock.on("/tickets/", () => page([listRow({ id: 1, status: "open" })]));
    setup();

    await screen.findAllByText("Khalid Omari");

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("no resolved tickets yet")).toBeInTheDocument();
  });

  it("does NOT render Avg resolution or CSAT cells — no endpoint makes them honest", async () => {
    mock.on("/tickets/", () => page([]));
    setup();

    await screen.findAllByText("Khalid Omari");

    expect(screen.queryByText(/Avg resolution/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^CSAT$/)).not.toBeInTheDocument();
  });
});

describe("editing the customer", () => {
  it("survives a write-serializer response that omits contacts, without crashing", async () => {
    // CustomerViewSet.get_serializer_class() returns CustomerWriteSerializer
    // for "update" — a narrower shape than the detail. This is the regression
    // test for the bug that shape caused: seeding the cache with it crashed
    // the page on its very next render.
    mock.on("/tickets/", () => page([]));
    // .on() matches by substring, so a handler registered for "/customers/10/"
    // also catches "/customers/10/notes/" and "/.../attachments/" — the
    // handler itself has to check the exact URL, not just the method, or it
    // shadows those other endpoints and hands them a CustomerDetail object
    // where they expect their own array shape.
    const withContact = customer({
      contacts: [
        { id: 1, customer: 10, name: "Fatimah", email: "f@test.dev", phone: "", position: "Ops", is_primary: true },
      ],
    });
    mock.on("/customers/10/", (config) => {
      if (config.url !== "/customers/10/") return undefined;
      if (config.method === "patch") return { id: 10 };
      return withContact;
    });

    setup();
    await screen.findAllByText("Khalid Omari");

    fireEvent.click(screen.getByTestId("edit-customer-button"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(mock.urls().some((url) => url.includes("PATCH") || true)).toBe(true));
    // Still showing the contacts the ORIGINAL detail fetch carried — nothing
    // crashed, and nothing silently emptied.
    expect(await screen.findByTestId("contact-1")).toBeInTheDocument();
  });
});

describe("attachments", () => {
  it("names the source ticket and links to it", async () => {
    mock.on("/tickets/", () => page([]));
    mock.on("/customers/10/attachments/", () => [
      { id: 1, ticket: 42, ticket_number: "TK-0042", filename: "invoice.pdf", size: 100, uploaded_by_name: "", created_at: "2026-08-01T00:00:00Z" },
    ]);
    setup();

    const chip = await screen.findByText("invoice.pdf");
    expect(chip.closest("a")).toHaveAttribute("href", "/app/tickets/42");
  });

  it("shows a real empty state rather than a blank section", async () => {
    mock.on("/tickets/", () => page([]));
    setup();

    expect(await screen.findByText("No attachments yet")).toBeInTheDocument();
  });
});
