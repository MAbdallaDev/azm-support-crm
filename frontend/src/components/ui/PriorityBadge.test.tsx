import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PRIORITIES } from "@/api/types";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import en from "@/i18n/en.json";

import "@/i18n";

describe("PriorityBadge", () => {
  it.each(PRIORITIES)("renders %s with its priority-* token pair", (priority) => {
    render(<PriorityBadge priority={priority} />);

    const badge = screen.getByTestId(`priority-${priority}`);
    expect(badge).toHaveTextContent(en.priority[priority]);
    expect(badge.className).toContain(`bg-priority-${priority}-bg`);
    expect(badge.className).toContain(`text-priority-${priority}`);
  });
});
