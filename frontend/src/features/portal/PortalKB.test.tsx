import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { tokenStore } from "@/api/tokenStore";
import type { PortalKBArticle } from "@/api/types";
import PortalKB from "@/features/portal/PortalKB";
import { installApiMock, page } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { makeQueryClient, renderWithDataRouter } from "@/test/utils";

import "@/i18n";

let mock: ApiMock;

const article = (over: Partial<PortalKBArticle> = {}): PortalKBArticle => ({
  id: 1,
  slug: "billing-article",
  title_en: "Understanding your monthly statement",
  title_ar: "",
  body_en: "Body",
  body_ar: "",
  category: "Billing & Invoices",
  updated_at: "2026-08-20T09:00:00Z",
  ...over,
});

const setup = (route: string) =>
  renderWithDataRouter(<PortalKB />, {
    queryClient: makeQueryClient(),
    path: "/kb",
    route,
  });

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "customer" });
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
});

describe("category filtering", () => {
  it("sends the category slug from the URL straight through to the API", async () => {
    mock.on("/portal/kb/articles/", () => page([article()]));
    setup("/kb?category=billing");

    await waitFor(() =>
      expect(mock.urls().some((u) => u.includes("category=billing"))).toBe(true),
    );
  });

  it("shows a clearable label naming the active category", async () => {
    mock.on("/portal/kb/articles/", () => page([article()]));
    setup("/kb?category=billing");

    expect(await screen.findByText("Billing & Invoices")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("portal-kb-clear-category"));

    await waitFor(() => {
      const urls = mock.urls();
      expect(urls[urls.length - 1]?.includes("category=")).toBe(false);
    });
  });

  it("combines a category with a text search rather than one replacing the other", async () => {
    mock.on("/portal/kb/articles/", () => page([]));
    setup("/kb?category=billing");

    fireEvent.change(screen.getByTestId("portal-kb-list-search"), { target: { value: "refund" } });

    await waitFor(() => {
      const urls = mock.urls();
      const last = urls[urls.length - 1] ?? "";
      expect(last).toContain("category=billing");
      expect(last).toContain("q=refund");
    });
  });

  it("no category param when browsing without a shortcut", async () => {
    mock.on("/portal/kb/articles/", () => page([article()]));
    setup("/kb");

    await waitFor(() => expect(mock.urls().length).toBeGreaterThan(0));
    expect(mock.urls().every((u) => !u.includes("category="))).toBe(true);
    expect(screen.queryByTestId("portal-kb-clear-category")).not.toBeInTheDocument();
  });
});
