import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { tokenStore } from "@/api/tokenStore";
import { AiSummaryBanner } from "@/features/tickets/AiSummaryBanner";
import { installApiMock } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { detail } from "@/test/fixtures";
import { makeQueryClient, renderWithProviders } from "@/test/utils";

import "@/i18n";

let mock: ApiMock;

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "agent" });
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
});

describe("layout on a narrow screen", () => {
  it("puts the badge and actions on their own row, not squeezing the text between them", () => {
    // Found live at 360px in English: the badge, the message text, and the
    // "Generate summary" action all shared one row, squeezing the text into
    // so little width that "No summary yet." wrapped across three lines.
    renderWithProviders(<AiSummaryBanner ticket={detail({ ai_summary: "" })} />, {
      queryClient: makeQueryClient(),
    });

    const badgeRow = screen.getByText("No summary yet.").closest("div.min-w-0")?.parentElement;
    expect(badgeRow?.className).toContain("sm:contents");

    const section = screen.getByTestId("ai-summary");
    expect(section.className).toContain("flex-col");
    expect(section.className).toContain("sm:flex-row");
  });
});
