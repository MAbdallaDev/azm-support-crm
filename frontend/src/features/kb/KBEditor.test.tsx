import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tokenStore } from "@/api/tokenStore";
import KBEditor from "@/features/kb/KBEditor";
import { installApiMock } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { kbArticle } from "@/test/fixtures";
import { renderWithDataRouter } from "@/test/utils";

import "@/i18n";

vi.mock("@/components/ui/toast", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/toast")>(
    "@/components/ui/toast",
  );
  return { ...actual, toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } };
});

let mock: ApiMock;

const change = (testId: string, value: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value } });

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "agent" });
  mock.on("/kb/categories/", () => []);
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
  vi.clearAllMocks();
});

describe("the completeness indicator", () => {
  it("reads Complete only when BOTH title and body are present", () => {
    renderWithDataRouter(<KBEditor />, { route: "/kb/new", path: "/kb/new" });

    change("title-en", "A title");
    // Title alone: not complete.
    expect(screen.getByText("Title only")).toBeInTheDocument();

    change("body-en", "A body");
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("reads Title only for an article with a title but no body — not Complete", async () => {
    mock.on("/kb/articles/half-translated/", () =>
      kbArticle({
        slug: "half-translated",
        title_ar: "عنوان فقط",
        body_ar: "",
        has_arabic: false,
      }),
    );

    renderWithDataRouter(<KBEditor />, {
      route: "/kb/half-translated/edit",
      path: "/kb/:slug/edit",
    });

    // `title-ar` is an <input>, so its Arabic text lives in `.value`, not in
    // any element's text content — waiting on the value is what proves the
    // fixture actually loaded before checking the pill beside it.
    await waitFor(() => expect(screen.getByTestId("title-ar")).toHaveValue("عنوان فقط"));

    // Two "Title only" pills would both match; the Arabic one is what this
    // criterion is actually about, so scope to its column.
    const arabicColumn = screen.getByText("العربية").closest("div")!.parentElement!;
    expect(arabicColumn).toHaveTextContent("Title only");
    expect(arabicColumn).not.toHaveTextContent("Complete");
  });

  it("reads Empty when neither title nor body is present", () => {
    renderWithDataRouter(<KBEditor />, { route: "/kb/new", path: "/kb/new" });
    // Both columns start empty on a brand-new article.
    expect(screen.getAllByText("Empty")).toHaveLength(2);
  });
});

describe("slug behaviour", () => {
  it("auto-generates the slug from the English title while creating", () => {
    renderWithDataRouter(<KBEditor />, { route: "/kb/new", path: "/kb/new" });

    change("title-en", "How to Reset a Password!");

    expect(screen.getByTestId("slug-input")).toHaveValue("how-to-reset-a-password");
  });

  it("freezes the slug once an article exists", async () => {
    mock.on("/kb/articles/existing-article/", () => kbArticle({ slug: "existing-article" }));

    renderWithDataRouter(<KBEditor />, {
      route: "/kb/existing-article/edit",
      path: "/kb/:slug/edit",
    });

    await waitFor(() => expect(screen.getByTestId("slug-input")).toHaveValue("existing-article"));
    expect(screen.getByTestId("slug-input")).toBeDisabled();
  });
});

describe("publishing with an empty language", () => {
  it("warns and does NOT publish immediately when Arabic is empty", () => {
    mock.on("/kb/articles/", () => ({ slug: "new-article" }));
    renderWithDataRouter(<KBEditor />, { route: "/kb/new", path: "/kb/new" });

    change("title-en", "English only");
    change("body-en", "English body");
    fireEvent.click(screen.getByTestId("publish-button"));

    expect(screen.getByText("Publish without an Arabic translation?")).toBeInTheDocument();
    expect(mock.urls().some((url) => url === "/kb/articles/")).toBe(false);
  });

  it("publishes immediately, without a warning, when both languages are complete", async () => {
    mock.on("/kb/articles/", () => ({ slug: "new-article" }));
    renderWithDataRouter(<KBEditor />, { route: "/kb/new", path: "/kb/new" });

    change("title-en", "English title");
    change("body-en", "English body");
    change("title-ar", "عنوان عربي");
    fireEvent.click(screen.getByTestId("copy-english"));
    fireEvent.click(screen.getByTestId("publish-button"));

    expect(screen.queryByText("Publish without an Arabic translation?")).not.toBeInTheDocument();
    await waitFor(() => expect(mock.urls().some((url) => url === "/kb/articles/")).toBe(true));
  });
});

describe("the unsaved-changes guard", () => {
  it("blocks navigation away from a dirty form", async () => {
    const { router } = renderWithDataRouter(<KBEditor />, { route: "/kb/new", path: "/kb/new" });

    change("title-en", "Half-written");
    void router.navigate("/elsewhere");

    await waitFor(() => expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument());
    expect(screen.queryByText("elsewhere")).not.toBeInTheDocument();
  });

  it("does NOT block after a successful save — the save that resolves the guard must not re-trigger it", async () => {
    mock.on("/kb/articles/", () => ({ slug: "saved-article" }));
    renderWithDataRouter(<KBEditor />, { route: "/kb/new", path: "/kb/new" });

    change("title-en", "Will be saved");
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    // The save itself navigates (to the real "/app/kb/:slug", which this test
    // router has no matching route for — the catch-all renders "navigated").
    // Getting there at all, with no guard dialog in the way, is the assertion:
    // the very save that resolved the dirty flag must not immediately
    // re-trigger the guard against its own navigation.
    await waitFor(() => expect(screen.getByText("navigated")).toBeInTheDocument());
    expect(screen.queryByText("Discard unsaved changes?")).not.toBeInTheDocument();
  });

  it("does not block a form that was never touched", async () => {
    const { router } = renderWithDataRouter(<KBEditor />, { route: "/kb/new", path: "/kb/new" });

    void router.navigate("/elsewhere");

    await waitFor(() => expect(screen.getByText("elsewhere")).toBeInTheDocument());
    expect(screen.queryByText("Discard unsaved changes?")).not.toBeInTheDocument();
  });
});
