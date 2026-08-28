import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { KBArticleReader } from "@/features/kb/KBArticleReader";
import { installApiMock } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { kbArticle } from "@/test/fixtures";
import { makeQueryClient, renderWithProviders } from "@/test/utils";

import i18n from "@/i18n";

import "@/i18n";

let mock: ApiMock;

const setup = (article = kbArticle()) =>
  renderWithProviders(<KBArticleReader article={article} />, { queryClient: makeQueryClient() });

afterEach(async () => {
  mock?.restore();
  await i18n.changeLanguage("en");
});

describe("the language-fallback notice", () => {
  it("shows the English body with an explicit notice when Arabic content is missing", async () => {
    mock = installApiMock();
    await i18n.changeLanguage("ar");

    setup(kbArticle({ title_ar: "", body_ar: "", has_arabic: false }));

    // Never an empty page: the notice AND the English body both render.
    expect(screen.getByTestId("language-fallback-notice")).toBeInTheDocument();
    expect(screen.getByText("Why are my SMS notifications delayed?")).toBeInTheDocument();
    expect(
      screen.getByText(/Delivery delays on the SMS channel/),
    ).toBeInTheDocument();
  });

  it("shows the Arabic title and body with NO notice when Arabic content exists", async () => {
    mock = installApiMock();
    await i18n.changeLanguage("ar");

    setup(kbArticle({ has_arabic: true }));

    expect(screen.queryByTestId("language-fallback-notice")).not.toBeInTheDocument();
    expect(screen.getByText("لماذا تتأخر إشعارات الرسائل النصية؟")).toBeInTheDocument();
  });

  it("shows the English version with no notice when the interface is English", () => {
    mock = installApiMock();
    setup(kbArticle({ title_ar: "", body_ar: "", has_arabic: false }));

    expect(screen.queryByTestId("language-fallback-notice")).not.toBeInTheDocument();
    expect(screen.getByText("Why are my SMS notifications delayed?")).toBeInTheDocument();
  });
});

describe("available-in pills", () => {
  it("shows only English when Arabic is missing", () => {
    mock = installApiMock();
    setup(kbArticle({ title_ar: "", body_ar: "", has_arabic: false }));
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.queryByText("العربية")).not.toBeInTheDocument();
  });

  it("shows both when the article is fully bilingual", () => {
    mock = installApiMock();
    setup(kbArticle({ has_arabic: true }));

    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("العربية")).toBeInTheDocument();
  });
});
