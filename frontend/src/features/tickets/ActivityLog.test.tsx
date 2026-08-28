import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TicketEvent } from "@/api/types";
import { ActivityLog } from "@/features/tickets/ActivityLog";
import i18n from "@/i18n";

import "@/i18n";

const event = (over: Partial<TicketEvent> = {}): TicketEvent => ({
  id: 1,
  ticket: 1,
  actor: 3,
  actor_name: "Omar Malki",
  event_type: "status_changed",
  field: "status",
  old_value: "new",
  new_value: "escalated",
  created_at: "2026-08-26T09:00:00Z",
  ...over,
});

const show = (events: TicketEvent[]) =>
  render(<ActivityLog events={events} isPending={false} />);

describe("the activity log renders sentences, not field diffs", () => {
  it("translates BOTH enum values through the status namespace", () => {
    show([event()]);

    // Not "status: new → escalated". And not "changed the status from new to
    // escalated" either — the enum keys go through status.* like everything
    // else, or the UI leaks a database value.
    expect(
      screen.getByText("Omar Malki changed the status from New to Escalated"),
    ).toBeInTheDocument();
  });

  it("uses the priority namespace for a priority change", () => {
    show([event({ event_type: "priority_changed", field: "priority", old_value: "normal", new_value: "high" })]);

    expect(
      screen.getByText("Omar Malki changed the priority from Normal to High"),
    ).toBeInTheDocument();
  });

  it("names the system when there is no actor", () => {
    show([event({ event_type: "created", actor: null, actor_name: "", old_value: "", new_value: "new" })]);

    expect(screen.getByText("The system created the ticket")).toBeInTheDocument();
  });

  it("falls back to a generic sentence for an unknown event type", () => {
    show([event({ event_type: "something_new_from_a_later_story" })]);

    // A blank row reads as data loss; a generic sentence reads as history.
    expect(screen.getByText("Omar Malki updated the ticket")).toBeInTheDocument();
  });

  it("prints an unrecognised enum value as itself rather than as its key", () => {
    show([event({ new_value: "hypothetical_future_status" })]);

    expect(screen.getByText(/hypothetical_future_status/)).toBeInTheDocument();
    // i18next echoes a missing key back; that must never reach the screen.
    expect(screen.queryByText(/status\.hypothetical/)).not.toBeInTheDocument();
  });

  it("keeps the API's newest-first order", () => {
    show([
      event({ id: 2, event_type: "escalated", created_at: "2026-08-27T09:00:00Z" }),
      event({ id: 1, event_type: "created", new_value: "new" }),
    ]);

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("escalated the ticket");
    expect(rows[1]).toHaveTextContent("created the ticket");
  });

  it("shows a real empty state rather than a blank panel", () => {
    show([]);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("translates the whole sentence into Arabic", async () => {
    await i18n.changeLanguage("ar");
    show([event()]);

    // The enum values flip too — "من جديدة إلى مُصعّدة", not "from new to escalated".
    expect(screen.getByText("Omar Malki غيّر الحالة من جديدة إلى مُصعّدة")).toBeInTheDocument();
    await i18n.changeLanguage("en");
  });
});
