import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tokenStore } from "@/api/tokenStore";
import type { Me } from "@/api/types";
import { ProtectedRoute } from "@/components/shell/ProtectedRoute";
import i18n from "@/i18n";
import { makeQueryClient } from "@/test/utils";

/**
 * `useMe` is mocked here on purpose: what is under test is the *decision* the
 * guard makes from a given query state, not the fetching. The fetch itself is
 * covered by the interceptor tests.
 */
const useMe = vi.hoisted(() => vi.fn());
vi.mock("@/api/auth", () => ({ useMe, useLogout: () => () => {} }));

const me = (over: Partial<Me> = {}): Me => ({
  id: 1,
  username: "agent@demo",
  email: "agent@demo.local",
  full_name: "Yousef Al-Qahtani",
  role: "agent",
  phone: "",
  department: "technical",
  branch: "riyadh",
  tier: 2,
  language: "en",
  is_available: true,
  ...over,
});

const resolved = (user: Me) => ({ data: user, isPending: false, isError: false, error: null, refetch: vi.fn() });
const pending = { data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() };
const failed = (status?: number) => ({
  data: undefined,
  isPending: false,
  isError: true,
  error: new AxiosError("nope", "ERR", {} as InternalAxiosRequestConfig, null, {
    status: status ?? 500,
    statusText: "",
    data: {},
    headers: new AxiosHeaders(),
    config: {} as InternalAxiosRequestConfig,
  }),
  refetch: vi.fn(),
});

/** Prints wherever the router ended up, plus the state it carried. */
function Probe() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  return (
    <div>
      <span data-testid="path">{location.pathname}</span>
      <span data-testid="from">{from ?? ""}</span>
    </div>
  );
}

const renderAt = (path: string, audience: "staff" | "customer") =>
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/login" element={<Probe />} />
            <Route path="/portal/login" element={<Probe />} />
            <Route path="/portal" element={<Probe />} />
            <Route
              path={audience === "staff" ? "/app/dashboard" : "/portal/home"}
              element={
                <ProtectedRoute audience={audience}>
                  <div data-testid="protected">inside</div>
                </ProtectedRoute>
              }
            />
            <Route path="/app/dashboard" element={<Probe />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );

beforeEach(() => tokenStore.clear());
afterEach(() => vi.clearAllMocks());

describe("ProtectedRoute", () => {
  it("sends an unauthenticated visitor to /login, preserving where they were going", () => {
    useMe.mockReturnValue(pending);

    renderAt("/app/dashboard", "staff");

    expect(screen.getByTestId("path")).toHaveTextContent("/login");
    expect(screen.getByTestId("from")).toHaveTextContent("/app/dashboard");
  });

  it("sends an unauthenticated visitor to the PORTAL login when that is the subtree", () => {
    useMe.mockReturnValue(pending);

    renderAt("/portal/home", "customer");

    // Chosen from the subtree, not from a cached role — a first-time visitor
    // pasting a portal link has no cached role, and would otherwise be shown
    // the agent sign-in page.
    expect(screen.getByTestId("path")).toHaveTextContent("/portal/login");
    expect(screen.getByTestId("from")).toHaveTextContent("/portal/home");
  });

  it("shows a skeleton while the profile loads — never a flash of the login page", () => {
    tokenStore.set({ access: "a", refresh: "r", role: "agent" });
    useMe.mockReturnValue(pending);

    renderAt("/app/dashboard", "staff");

    expect(screen.getByTestId("session-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("path")).not.toBeInTheDocument();
  });

  it("renders the shell for the right role", () => {
    tokenStore.set({ access: "a", refresh: "r", role: "agent" });
    useMe.mockReturnValue(resolved(me()));

    renderAt("/app/dashboard", "staff");

    expect(screen.getByTestId("protected")).toBeInTheDocument();
  });

  it("bounces a customer off /app to the portal — not to login", () => {
    tokenStore.set({ access: "a", refresh: "r", role: "customer" });
    useMe.mockReturnValue(resolved(me({ role: "customer" })));

    renderAt("/app/dashboard", "staff");

    expect(screen.getByTestId("path")).toHaveTextContent("/portal");
  });

  it("bounces an agent off /portal to the dashboard", () => {
    tokenStore.set({ access: "a", refresh: "r", role: "agent" });
    useMe.mockReturnValue(resolved(me()));

    renderAt("/portal/home", "customer");

    expect(screen.getByTestId("path")).toHaveTextContent("/app/dashboard");
  });

  it("treats a 401 as logged out — the interceptor already tried and lost", () => {
    tokenStore.set({ access: "a", refresh: "r", role: "agent" });
    useMe.mockReturnValue(failed(401));

    renderAt("/app/dashboard", "staff");

    expect(screen.getByTestId("path")).toHaveTextContent("/login");
    expect(tokenStore.hasToken()).toBe(false);
  });

  it("offers a retry — not a logout — when the backend hiccups", () => {
    tokenStore.set({ access: "a", refresh: "r", role: "agent" });
    useMe.mockReturnValue(failed(500));

    renderAt("/app/dashboard", "staff");

    expect(screen.getByTestId("session-error")).toBeInTheDocument();
    expect(tokenStore.hasToken()).toBe(true);
  });
});
