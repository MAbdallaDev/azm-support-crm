import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tokenStore } from "@/api/tokenStore";
import { Composer } from "@/features/tickets/Composer";
import { installApiMock } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { detail, message } from "@/test/fixtures";
import { makeQueryClient, renderWithProviders } from "@/test/utils";

import "@/i18n";

vi.mock("@/components/ui/toast", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/toast")>(
    "@/components/ui/toast",
  );
  return { ...actual, toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } };
});

const { toast } = await import("@/components/ui/toast");

let mock: ApiMock;

const setup = (ticket = detail()) =>
  renderWithProviders(<Composer ticket={ticket} />, { queryClient: makeQueryClient() });

const textarea = () => screen.getByTestId("composer-textarea") as HTMLTextAreaElement;

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "agent" });
  mock.on("/canned-replies/", () => [
    {
      id: 1,
      shortcut: "ack",
      title_en: "Acknowledge + ETA",
      title_ar: "إقرار",
      body_en: "Thanks — we are on it.",
      body_ar: "شكرًا — نعمل عليها.",
      category: null,
    },
  ]);
  window.sessionStorage.clear();
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
  window.sessionStorage.clear();
  vi.clearAllMocks();
});

describe("the reply / internal-note toggle", () => {
  it("VISIBLY restyles the textarea, not merely a state flag", () => {
    setup();

    const replyClass = textarea().className;
    expect(replyClass).toContain("bg-background");

    fireEvent.click(screen.getByTestId("composer-mode-internal"));

    const noteClass = textarea().className;
    // The class must actually change. Asserting on a state variable would pass
    // even if the tint never rendered — and this is the one control where a
    // mistaken mode publishes text to a customer.
    expect(noteClass).not.toBe(replyClass);
    expect(noteClass).toContain("bg-priority-high-bg");
    expect(noteClass).not.toContain("bg-background");
  });

  it("changes the placeholder to say the customer never sees it", () => {
    setup();
    expect(textarea().placeholder).toContain("Khalid Omari");

    fireEvent.click(screen.getByTestId("composer-mode-internal"));
    expect(textarea().placeholder).toContain("never sees");
  });

  it("hides the channel label and Suggest reply in note mode", () => {
    setup();
    expect(screen.getByTestId("composer-suggest")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("composer-mode-internal"));
    // Neither belongs on a note: there is no channel, and an AI *customer*
    // reply drafted into an internal note is a category error.
    expect(screen.queryByTestId("composer-suggest")).not.toBeInTheDocument();
  });
});

describe("drafts", () => {
  it("survives an unmount and comes back on the same ticket", () => {
    const view = setup();
    fireEvent.change(textarea(), { target: { value: "Half-written reply" } });
    view.unmount();

    setup();
    expect(textarea().value).toBe("Half-written reply");
  });

  it("keeps reply and note drafts apart", () => {
    setup();
    fireEvent.change(textarea(), { target: { value: "To the customer" } });

    fireEvent.click(screen.getByTestId("composer-mode-internal"));
    // A half-written note must never surface in the reply box, and vice versa.
    expect(textarea().value).toBe("");

    fireEvent.change(textarea(), { target: { value: "For colleagues" } });
    fireEvent.click(screen.getByTestId("composer-mode-reply"));
    expect(textarea().value).toBe("To the customer");
  });

  it("keeps drafts apart per ticket", () => {
    const view = setup(detail({ id: 1 }));
    fireEvent.change(textarea(), { target: { value: "About ticket one" } });
    view.unmount();

    setup(detail({ id: 2 }));
    expect(textarea().value).toBe("");
  });

  it("clears the draft once the message actually sends", async () => {
    mock.on("/messages/", () => message({ body: "Sent!" }));
    const view = setup();

    fireEvent.change(textarea(), { target: { value: "Sent!" } });
    fireEvent.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    view.unmount();

    setup();
    expect(textarea().value).toBe("");
  });

  it("KEEPS the draft when sending fails", async () => {
    mock.fail("/messages/", 500);
    setup();

    fireEvent.change(textarea(), { target: { value: "Do not lose me" } });
    fireEvent.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    // Losing what someone just wrote is worse than any error message.
    expect(textarea().value).toBe("Do not lose me");
  });
});

describe("canned replies", () => {
  it("inserts at the cursor rather than appending", async () => {
    setup();
    await screen.findByText("Acknowledge + ETA");

    const field = textarea();
    fireEvent.change(field, { target: { value: "Hello. Regards, Yousef" } });
    // Caret just after "Hello. "
    field.setSelectionRange(7, 7);

    fireEvent.click(screen.getByText("Acknowledge + ETA"));

    expect(textarea().value).toBe("Hello. Thanks — we are on it.Regards, Yousef");
  });
});

describe("attachments", () => {
  const pick = (file: File) => {
    const input = screen.getByTestId("composer-file") as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);
  };

  it("rejects a file over the backend's own 10 MB limit before uploading", () => {
    setup();

    const big = new File(["x"], "huge.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    pick(big);

    expect(toast.error).toHaveBeenCalled();
    expect(mock.urls().some((url) => url.includes("/attachments/"))).toBe(false);
  });

  it("rejects a content type the backend does not accept", () => {
    setup();
    pick(new File(["x"], "run.exe", { type: "application/x-msdownload" }));

    expect(toast.error).toHaveBeenCalled();
    expect(mock.urls().some((url) => url.includes("/attachments/"))).toBe(false);
  });

  it("uploads an allowed file", async () => {
    mock.on("/attachments/", () => ({ id: 1, filename: "invoice.pdf" }));
    setup();
    pick(new File(["x"], "invoice.pdf", { type: "application/pdf" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(mock.urls().some((url) => url.includes("/attachments/"))).toBe(true);
  });
});

describe("suggest reply", () => {
  it("inserts the draft as editable text and never sends it", async () => {
    mock.on("/ai/suggest-reply/", () => ({
      ticket: 1,
      backend: "mock",
      suggested_reply: "We are investigating the delay.",
      language: "en",
    }));
    setup();

    fireEvent.click(screen.getByTestId("composer-suggest"));

    await waitFor(() =>
      expect(textarea().value).toBe("We are investigating the delay."),
    );
    // The agent approving it is the whole point: nothing was posted.
    expect(mock.urls().some((url) => url.includes("/messages/"))).toBe(false);
  });
});
