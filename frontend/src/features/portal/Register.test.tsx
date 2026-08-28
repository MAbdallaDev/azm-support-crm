import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { tokenStore } from "@/api/tokenStore";
import Register from "@/features/portal/Register";
import { installApiMock } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { makeQueryClient, renderWithDataRouter } from "@/test/utils";

import "@/i18n";

let mock: ApiMock;

const fill = () => {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Abdulaziz Al-Rashid" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ops@gulftrading.sa" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "SuperSecret1" } });
};

beforeEach(() => {
  mock = installApiMock();
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
});

describe("registration", () => {
  it("posts to /portal/register/ and signs the user in on success", async () => {
    mock.on("/portal/register/", () => ({
      access: "a", refresh: "r",
      user: { id: 11, username: "ops@gulftrading.sa", email: "ops@gulftrading.sa", full_name: "Abdulaziz Al-Rashid", role: "customer", department: null, branch: null, tier: 1, language: "en", is_available: true },
    }));

    renderWithDataRouter(<Register />, { queryClient: makeQueryClient() });
    fill();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(tokenStore.hasToken()).toBe(true));
    const request = mock.urls().find((url) => url.startsWith("/portal/register/"));
    expect(request).toBeDefined();
  });

  it("shows a generic error on a duplicate email, without implying that is the reason", async () => {
    mock.fail("/portal/register/", 400);

    renderWithDataRouter(<Register />, { queryClient: makeQueryClient() });
    fill();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    const banner = await screen.findByRole("alert");
    const text = banner.textContent?.toLowerCase() ?? "";
    expect(text).not.toContain("taken");
    expect(text).not.toContain("already");
    expect(text).not.toContain("exists");
  });
});
