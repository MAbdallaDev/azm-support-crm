import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import * as React from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, createMemoryRouter, RouterProvider } from "react-router-dom";

import i18n from "@/i18n";

/**
 * Render with the three providers every screen assumes: the query client, the
 * router and i18next.
 *
 * A **fresh** QueryClient per render, with retries off — a shared one would
 * leak a resolved `qk.me` from one test into the next, and retries turn a
 * deliberate 500 into a three-second test.
 *
 * `gcTime: Infinity` rather than 0: a test that seeds the cache with
 * `setQueryData` and then asserts on it has no *observer* for that key, so a
 * zero gc time collects the entry between the write and the assertion — which
 * reads as "the mutation did not update the cache" and is nothing of the kind.
 * Freshness per test comes from a new client, not from collection.
 */
export const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

export type RenderWithProvidersOptions = RenderOptions & {
  route?: string;
  queryClient?: QueryClient;
};

export function renderWithProviders(
  ui: React.ReactElement,
  { route = "/", queryClient = makeQueryClient(), ...options }: RenderWithProvidersOptions = {},
) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>
  );

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}


/**
 * Render inside a **data** router rather than the declarative `<MemoryRouter>`
 * above. `useBlocker` (KBEditor's unsaved-changes guard) throws outside a data
 * router — this is a real capability the plain wrapper cannot provide, not a
 * style choice.
 */
export type RenderWithDataRouterOptions = {
  route?: string;
  path?: string;
  queryClient?: QueryClient;
};

export function renderWithDataRouter(
  element: React.ReactElement,
  { route = "/", path = "/", queryClient = makeQueryClient() }: RenderWithDataRouterOptions = {},
) {
  const router = createMemoryRouter(
    [
      { path, element },
      // A second, explicit route so a blocked/unblocked navigation has
      // somewhere recognisable to land, plus a catch-all so navigating to
      // wherever the component under test *actually* redirects on success
      // (its own real absolute path, e.g. "/app/kb/:slug") does not crash
      // the test router with an unmatched-route error.
      { path: "/elsewhere", element: <div>elsewhere</div> },
      { path: "*", element: <div>navigated</div> },
    ],
    { initialEntries: [route] },
  );

  const Wrapper = () => (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <RouterProvider router={router} />
      </I18nextProvider>
    </QueryClientProvider>
  );

  return { queryClient, router, ...render(<Wrapper />) };
}
