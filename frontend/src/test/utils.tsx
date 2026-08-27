import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import * as React from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";

import i18n from "@/i18n";

/**
 * Render with the three providers every screen assumes: the query client, the
 * router and i18next.
 *
 * A **fresh** QueryClient per render, with retries off — a shared one would
 * leak a resolved `qk.me` from one test into the next, and retries turn a
 * deliberate 500 into a three-second test.
 */
export const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
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
