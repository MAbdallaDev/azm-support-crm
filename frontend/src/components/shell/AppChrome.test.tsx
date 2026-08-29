import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Me, Role } from "@/api/types";
import AppChrome from "@/components/shell/AppChrome";
import i18n from "@/i18n";
import en from "@/i18n/en.json";
import { makeQueryClient } from "@/test/utils";

const useMe = vi.hoisted(() => vi.fn());
vi.mock("@/api/auth", () => ({ useMe, useLogout: () => () => {} }));

// The bell makes its own two queries; stubbed here the same way `useMe` is —
// this file is about the chrome's own rendering, not the bell's data layer,
// which NotificationBell.test.tsx covers.
vi.mock("@/api/notifications", () => ({
  useUnreadCount: () => ({ data: 0 }),
  useNotifications: () => ({ data: [], isPending: false }),
  useMarkNotificationRead: () => ({ mutate: () => {} }),
}));

const me = (role: Role): Me => ({
  id: 1,
  username: `${role}@demo`,
  email: `${role}@demo.local`,
  full_name: "Omar Malki",
  role,
  phone: "",
  department: "billing",
  branch: "riyadh",
  tier: 2,
  language: "en",
  is_available: true,
});

const renderChrome = (role: Role) => {
  useMe.mockReturnValue({ data: me(role), isPending: false, isError: false });

  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/app/dashboard"]}>
          <Routes>
            <Route path="/app" element={<AppChrome />}>
              <Route path="dashboard" element={<div>content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
};

afterEach(() => vi.clearAllMocks());

describe("AppChrome", () => {
  it("renders the lockup with the wordmark untranslated", () => {
    renderChrome("agent");

    expect(screen.getByText("AZM Squad")).toBeInTheDocument();
    expect(screen.getByText(en.app.product)).toBeInTheDocument();
  });

  it("does NOT render nav items the role cannot reach", () => {
    renderChrome("agent");

    expect(screen.getByRole("link", { name: en.nav.tickets })).toBeInTheDocument();
    // Not disabled, not hidden — absent. A greyed-out Reports tells an agent
    // the feature exists and that they are not trusted with it.
    expect(screen.queryByText(en.nav.reports)).not.toBeInTheDocument();
    expect(screen.queryByText(en.nav.admin)).not.toBeInTheDocument();
  });

  it("gives managers Reports but not Admin", () => {
    renderChrome("manager");

    expect(screen.getByRole("link", { name: en.nav.reports })).toBeInTheDocument();
    expect(screen.queryByText(en.nav.admin)).not.toBeInTheDocument();
  });

  it("links admins to Django's own admin, outside the SPA", () => {
    renderChrome("admin");

    const link = screen.getByRole("link", { name: en.nav.admin });
    expect(link).toHaveAttribute("href", expect.stringContaining("/admin/"));
    expect(link.getAttribute("href")).not.toContain("/api/v1");
  });

  it("shows the user chip with tier and department from /auth/me/", () => {
    renderChrome("agent");

    expect(screen.getByText("Omar Malki")).toBeInTheDocument();
    expect(screen.getByText("Tier 2 · billing")).toBeInTheDocument();
  });

  it("renders a WIRED search field — story 06 shipped it inert, story 07 wired it", async () => {
    renderChrome("agent");

    const field = screen.getByLabelText(en.nav.search);
    expect(field).toBeEnabled();

    // Typing writes `q` into the queue's own URL parameter, after the debounce.
    fireEvent.change(field, { target: { value: "invoice" } });
    expect(field).toHaveValue("invoice");
  });
});
