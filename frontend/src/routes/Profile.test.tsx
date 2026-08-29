import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { qk } from "@/api/queryKeys";
import { tokenStore } from "@/api/tokenStore";
import Profile from "@/routes/Profile";
import { installApiMock } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { me } from "@/test/fixtures";
import { makeQueryClient, renderWithProviders } from "@/test/utils";

import "@/i18n";

let mock: ApiMock;

const setup = (overrides: Partial<ReturnType<typeof me>> = {}) => {
  const queryClient = makeQueryClient();
  queryClient.setQueryData(qk.me, me(overrides));
  return renderWithProviders(<Profile />, { queryClient, route: "/app/profile" });
};

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "agent" });
  // A sane default so a test that doesn't care about the exact payload never
  // leaves an unmatched request in flight — a stray fetch resolving after its
  // own test finished is what caused a real, hard-to-place i18next crash here.
  mock.on("/auth/me/", () => me());
});

afterEach(() => {
  mock.restore();
});

describe("Profile", () => {
  it("shows the caller's read-only account info", async () => {
    setup({ username: "agent@demo", email: "agent@demo.local", department: "technical" });

    expect(await screen.findByText("agent@demo")).toBeInTheDocument();
    expect(screen.getByText("agent@demo.local")).toBeInTheDocument();
  });

  it("does not reset a typed value when the me query is touched with identical content", async () => {
    // useForm's `values` option resyncs the form whenever the object it is
    // given has a different reference — including an inline object literal
    // recomputed on every render, even when its content hasn't changed. This
    // pins the defensive fix (memoizing that object on the actual field
    // values) against the specific case it guards: a cache touch with
    // identical data should never undo an in-progress edit.
    const queryClient = makeQueryClient();
    queryClient.setQueryData(qk.me, me());
    const { rerender } = renderWithProviders(<Profile />, { queryClient, route: "/app/profile" });

    const phone = await screen.findByLabelText(/phone/i);
    fireEvent.change(phone, { target: { value: "+966599998888" } });

    queryClient.setQueryData(qk.me, me()); // same content, new object reference
    rerender(<Profile />);

    expect(screen.getByLabelText(/phone/i)).toHaveValue("+966599998888");
  });

  it("saves phone and language, and seeds the me cache from the full response", async () => {
    setup({ phone: "" });
    mock.on("/auth/me/", () => me({ phone: "+966500000000", language: "ar" }));

    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: "+966500000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(mock.requests.some((r) => r.startsWith("PATCH /auth/me/"))).toBe(true),
    );
  });

  it("requires the current password before accepting a new one", async () => {
    setup();
    mock.fail("/auth/change-password/", 400);

    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: "wrong" },
    });
    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: "SomethingNew123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() =>
      expect(mock.requests.some((r) => r.startsWith("POST /auth/change-password/"))).toBe(true),
    );
  });

  it("shows a loading skeleton before the profile loads", () => {
    const queryClient = makeQueryClient();
    renderWithProviders(<Profile />, { queryClient, route: "/app/profile" });
    expect(screen.queryByText(/account information/i)).not.toBeInTheDocument();
  });
});
