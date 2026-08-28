import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/ui/EmptyState";
import en from "@/i18n/en.json";

import "@/i18n";

describe("EmptyState", () => {
  it("falls back to its own translated copy", () => {
    render(<EmptyState />);
    expect(screen.getByText(en.empty.title)).toBeInTheDocument();
    expect(screen.getByText(en.empty.body)).toBeInTheDocument();
  });

  it("prefers the caller's strings and renders an action", () => {
    render(<EmptyState title="No tickets" description="Try another filter" action={<button>New</button>} />);
    expect(screen.getByText("No tickets")).toBeInTheDocument();
    expect(screen.getByText("Try another filter")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });
});
