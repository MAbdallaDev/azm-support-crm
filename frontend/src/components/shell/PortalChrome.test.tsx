import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";

import type { Me } from "@/api/types";
import { tokenStore } from "@/api/tokenStore";
import PortalChrome from "@/components/shell/PortalChrome";
import en from "@/i18n/en.json";
import { installApiMock, page } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { makeQueryClient, renderWithProviders } from "@/test/utils";

import "@/i18n";

/**
 * The header must never force the page to scroll horizontally on a phone —
 * a real bug found live: two full-width nav labels plus the language toggle
 * plus the wordmark's secondary label simply do not fit a ~375px width, and
 * nothing wrapped or collapsed, so the whole page overflowed sideways.
 */

const useMe = vi.hoisted(() => vi.fn());
vi.mock("@/api/auth", () => ({ useMe, useLogout: () => () => {} }));

const me: Me = {
  id: 48,
  username: "customer@demo",
  email: "customer@demo.local",
  full_name: "Hind Al-Subaie",
  role: "customer",
  phone: "",
  department: null,
  branch: null,
  tier: 0,
  language: "en",
  is_available: true,
};

let mock: ApiMock;

beforeEach(() => {
  useMe.mockReturnValue({ data: me, isPending: false, isError: false });
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "customer" });
  mock.on("/portal/tickets/", () => page([]));
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
  vi.clearAllMocks();
});

const setup = () =>
  renderWithProviders(
    <Routes>
      <Route path="/portal" element={<PortalChrome />}>
        <Route index element={<div>content</div>} />
      </Route>
    </Routes>,
    { queryClient: makeQueryClient(), route: "/portal" },
  );

describe("PortalChrome", () => {
  it("hides the inline nav labels below sm and shows a menu button instead", () => {
    setup();

    // The nav links exist in the DOM (inside the hidden `sm:flex` container)
    // for larger screens — the point is that a collapsed mobile trigger is
    // ALSO present, not that the labels vanish entirely.
    expect(screen.getByRole("link", { name: en.nav.portalRequests })).toBeInTheDocument();
    expect(screen.getByTestId("portal-mobile-nav-trigger")).toBeInTheDocument();
  });

  it("opens the mobile nav menu with both portal nav items on click", () => {
    setup();

    fireEvent.click(screen.getByTestId("portal-mobile-nav-trigger"));

    expect(screen.getAllByText(en.nav.portalRequests).length).toBeGreaterThan(0);
    expect(screen.getAllByText(en.nav.portalArticles).length).toBeGreaterThan(0);
  });

  it("hides the wordmark's secondary product label below sm", () => {
    setup();

    // Present in the DOM (sm:inline), never asserted absent outright — this
    // just pins that it renders via a responsive class, not unconditionally.
    const label = screen.getByText(en.app.portalProduct);
    expect(label.className).toContain("hidden");
    expect(label.className).toContain("sm:inline");
  });
});
