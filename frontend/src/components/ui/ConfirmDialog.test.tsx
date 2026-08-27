import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import en from "@/i18n/en.json";

import "@/i18n";

describe("ConfirmDialog", () => {
  it("renders nothing while closed", () => {
    render(
      <ConfirmDialog open={false} onOpenChange={() => {}} title="Delete?" onConfirm={() => {}} />,
    );
    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
  });

  it("renders the title, body and both translated actions when open", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Delete this ticket?"
        description="This cannot be undone."
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByText("Delete this ticket?")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.common.confirm })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.common.cancel })).toBeInTheDocument();
  });

  it("confirms once and closes itself", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog open onOpenChange={onOpenChange} title="Delete?" onConfirm={onConfirm} />,
    );

    fireEvent.click(screen.getByRole("button", { name: en.common.confirm }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
