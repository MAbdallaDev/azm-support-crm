import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton } from "@/components/ui/Skeleton";

describe("Skeleton", () => {
  it("renders a pulsing, screen-reader-invisible block", () => {
    render(<Skeleton className="h-4 w-20" />);

    const node = screen.getByTestId("skeleton");
    expect(node).toHaveClass("animate-pulse");
    expect(node).toHaveAttribute("aria-hidden", "true");
    expect(node).toHaveClass("h-4", "w-20");
  });
});
