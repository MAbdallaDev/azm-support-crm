import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { STATUSES } from "@/api/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import i18n from "@/i18n";
import en from "@/i18n/en.json";

import "@/i18n";

describe("StatusBadge", () => {
  it.each(STATUSES)("renders %s with its own colour pair and translated label", (status) => {
    render(<StatusBadge status={status} />);

    const badge = screen.getByTestId(`status-${status}`);
    expect(badge).toHaveTextContent(en.status[status]);
    // The class pair has to be literal for Tailwind to emit it; asserting on
    // it here is what catches a `bg-status-${status}-bg` template creeping in.
    expect(badge.className).toContain(`bg-status-${status}-bg`);
    expect(badge.className).toContain(`text-status-${status}`);
  });

  it("translates when the language flips", async () => {
    await i18n.changeLanguage("ar");
    render(<StatusBadge status="escalated" />);
    expect(screen.getByTestId("status-escalated")).toHaveTextContent("مُصعّدة");
    await i18n.changeLanguage("en");
  });
});
