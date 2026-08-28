import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { qk } from "@/api/queryKeys";
import { tokenStore } from "@/api/tokenStore";
import KBBrowse from "@/features/kb/KBBrowse";
import { installApiMock, page } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { me } from "@/test/fixtures";
import { makeQueryClient, renderWithDataRouter, renderWithProviders } from "@/test/utils";

import "@/i18n";

let mock: ApiMock;

const article = (over: Partial<{
  id: number; slug: string; title_en: string; title_ar: string; status: "draft" | "published";
  has_arabic: boolean; view_count: number; helpful_count: number; updated_at: string;
  category: string | null; category_name: string;
}> = {}) => ({
  id: 1,
  slug: "sample",
  title_en: "Sample article",
  title_ar: "مقالة عينة",
  category: null,
  category_name: "",
  status: "published" as const,
  has_arabic: true,
  view_count: 10,
  helpful_count: 1,
  updated_at: "2026-08-24T09:00:00Z",
  ...over,
});

const setup = () => {
  const queryClient = makeQueryClient();
  queryClient.setQueryData(qk.me, me());
  return renderWithProviders(<KBBrowse />, { queryClient, route: "/app/kb" });
};

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "agent" });
  mock.on("/kb/categories/", () => []);
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
});

describe("draft visibility, by role", () => {
  it("marks a draft article with a visible badge in the list", async () => {
    mock.on("/kb/articles/", () =>
      page([article({ id: 1, status: "draft" }), article({ id: 2, status: "published" })]),
    );

    setup();

    // Story 08 narrows draft visibility server-side (Backend Task 1); this is
    // the frontend half of criterion 4 — what the API *does* return for this
    // caller must be clearly marked as a draft, so an agent seeing their own
    // unfinished article never mistakes it for something already published.
    await waitFor(() => expect(screen.getAllByTestId("draft-badge")).toHaveLength(1));
  });

  it("shows no draft badge when the API returns only published articles", async () => {
    mock.on("/kb/articles/", () => page([article({ status: "published" })]));

    setup();

    await screen.findByTestId("kb-row-sample");
    expect(screen.queryByTestId("draft-badge")).not.toBeInTheDocument();
  });
});

describe("the missing-Arabic filter", () => {
  it("filters client-side on has_arabic, since the API has no such filter", async () => {
    mock.on("/kb/articles/", () =>
      page([
        article({ id: 1, slug: "has-arabic", has_arabic: true }),
        article({ id: 2, slug: "no-arabic", has_arabic: false }),
      ]),
    );

    setup();
    await screen.findByTestId("kb-row-has-arabic");
    expect(screen.getByTestId("kb-row-no-arabic")).toBeInTheDocument();

    screen.getByTestId("filter-missing-arabic").click();

    await waitFor(() => {
      expect(screen.queryByTestId("kb-row-has-arabic")).not.toBeInTheDocument();
      expect(screen.getByTestId("kb-row-no-arabic")).toBeInTheDocument();
    });

    // No new server request — the filter never touched the API.
    expect(mock.urls().filter((url) => url.startsWith("/kb/articles/")).length).toBe(1);
  });
});

describe("selection", () => {
  it("highlights the row matching the :slug route param", async () => {
    mock.on("/kb/articles/", () => page([article({ id: 1, slug: "a" }), article({ id: 2, slug: "b" })]));
    mock.on("/kb/articles/b/", () => article({ id: 2, slug: "b" }));

    const queryClient = makeQueryClient();
    queryClient.setQueryData(qk.me, me());
    // KBBrowse reads `:slug` via useParams() itself, so this needs a route
    // that actually supplies the param — the plain MemoryRouter wrapper
    // renders children directly with no <Route> to match against.
    renderWithDataRouter(<KBBrowse />, {
      queryClient,
      route: "/kb/b",
      path: "/kb/:slug",
    });

    await waitFor(() => expect(screen.getByTestId("kb-row-b")).toHaveAttribute("aria-current", "true"));
    expect(screen.getByTestId("kb-row-a")).not.toHaveAttribute("aria-current");
  });
});
