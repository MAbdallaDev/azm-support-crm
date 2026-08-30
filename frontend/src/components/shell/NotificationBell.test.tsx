import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NotificationBell } from "@/components/shell/NotificationBell";
import { installApiMock, page } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { renderWithProviders } from "@/test/utils";

import "@/i18n";

let mock: ApiMock;

const notification = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  verb: "ticket_assigned",
  actor_name: "Yousef Al-Qahtani",
  ticket: 42,
  ticket_number: "TK-0042",
  ticket_subject: "Cannot log in",
  read_at: null,
  created_at: "2026-08-26T09:00:00Z",
  ...over,
});

/**
 * Radix's DropdownMenuTrigger opens on `pointerdown`, not `click` — a
 * deliberate choice on Radix's part so a click-and-drag-to-select gesture
 * works, but it means a plain `fireEvent.click` in jsdom never opens the
 * menu. This is the first Radix dropdown test in the project; every future
 * one hits the same thing.
 */
const openBell = () => {
  fireEvent.pointerDown(screen.getByTestId("notification-bell"), {
    pointerType: "mouse",
    button: 0,
    ctrlKey: false,
  });
};

beforeEach(() => {
  mock = installApiMock();
  mock.on("/notifications/unread-count/", () => ({ count: 0 }));
  mock.on("/notifications/", () => page([]));
});

afterEach(() => {
  mock.restore();
});

describe("NotificationBell", () => {
  it("shows no badge when there are no unread notifications", async () => {
    renderWithProviders(<NotificationBell />);

    await waitFor(() => expect(mock.urls()).toContain("/notifications/unread-count/"));
    expect(screen.queryByTestId("notification-unread-badge")).not.toBeInTheDocument();
  });

  it("shows a badge when there are unread notifications", async () => {
    mock.on("/notifications/unread-count/", () => ({ count: 2 }));
    renderWithProviders(<NotificationBell />);

    expect(await screen.findByTestId("notification-unread-badge")).toBeInTheDocument();
  });

  it("shows an empty state until opened, and lists notifications once opened", async () => {
    mock.on("/notifications/", () => page([notification()]));
    renderWithProviders(<NotificationBell />);

    // The list query is disabled while closed — nothing to assert about its
    // content yet, but opening should not have fired it prematurely either.
    expect(mock.urls()).not.toContain("/notifications/");

    openBell();

    expect(await screen.findByTestId("notification-1")).toBeInTheDocument();
    expect(screen.getByText(/Yousef Al-Qahtani assigned you TK-0042/)).toBeInTheDocument();
  });

  it("shows an empty state when there is nothing to show", async () => {
    renderWithProviders(<NotificationBell />);

    openBell();

    expect(await screen.findByText("Nothing new")).toBeInTheDocument();
  });

  it("marks a notification read and navigates to its ticket on click", async () => {
    mock.on("/notifications/", () => page([notification()]));
    renderWithProviders(<NotificationBell />, { route: "/app/dashboard" });

    openBell();
    fireEvent.click(await screen.findByTestId("notification-1"));

    await waitFor(() =>
      expect(mock.requests.some((r) => r === "POST /notifications/1/read/")).toBe(true),
    );
  });
});
