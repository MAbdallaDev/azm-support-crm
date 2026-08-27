import { fireEvent, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { api } from "@/api/client";
import { tokenStore } from "@/api/tokenStore";
import en from "@/i18n/en.json";
import { renderWithProviders } from "@/test/utils";

import Login from "./Login";

import "@/i18n";

const originalAdapter = api.defaults.adapter;

const respond = (status: number, data: unknown) => {
  api.defaults.adapter = async (config) => {
    const response = {
      data,
      status,
      statusText: "",
      headers: new AxiosHeaders(),
      config,
    };
    if (status >= 400) {
      // A real AxiosError, not a look-alike: Login narrows on
      // `instanceof AxiosError` before reading the status, so a plain object
      // with a `.response` would silently take the "server unavailable" path.
      throw new AxiosError(
        "request failed",
        "ERR_BAD_REQUEST",
        config as InternalAxiosRequestConfig,
        null,
        response,
      );
    }
    return response;
  };
};

beforeEach(() => tokenStore.clear());
afterEach(() => {
  api.defaults.adapter = originalAdapter;
  tokenStore.clear();
});

describe("Login", () => {
  it("renders its heading through i18next", () => {
    renderWithProviders(<Login />);
    expect(screen.getByRole("heading", { name: en.auth.signIn })).toBeInTheDocument();
  });

  it("shows the real demo credentials from demo_content.py", () => {
    renderWithProviders(<Login />);

    expect(screen.getByText(/agent@demo/)).toBeInTheDocument();
    expect(screen.getByText(/Demo!2345/)).toBeInTheDocument();
  });

  it("blocks an empty submit with inline errors and never calls the API", async () => {
    let called = false;
    api.defaults.adapter = async () => {
      called = true;
      throw new Error("should not be called");
    };

    renderWithProviders(<Login />);
    fireEvent.click(screen.getByRole("button", { name: en.auth.submit }));

    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
    expect(called).toBe(false);
  });

  it("stores the token pair and role on success", async () => {
    respond(200, {
      access: "access-token",
      refresh: "refresh-token",
      user: { id: 1, role: "agent", full_name: "Yousef", language: "en", tier: 2 },
    });

    renderWithProviders(<Login />);
    fireEvent.change(screen.getByLabelText(en.auth.usernameLabel), {
      target: { value: "agent@demo" },
    });
    fireEvent.change(screen.getByLabelText(en.auth.passwordLabel), {
      target: { value: "Demo!2345" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.auth.submit }));

    await waitFor(() => expect(tokenStore.access).toBe("access-token"));
    expect(tokenStore.role).toBe("agent");
  });

  it("shows a generic banner on 401 — never the server's own wording", async () => {
    respond(401, { detail: "No active account found with the given credentials" });

    renderWithProviders(<Login />);
    fireEvent.change(screen.getByLabelText(en.auth.usernameLabel), { target: { value: "a" } });
    fireEvent.change(screen.getByLabelText(en.auth.passwordLabel), { target: { value: "b" } });
    fireEvent.click(screen.getByRole("button", { name: en.auth.submit }));

    await waitFor(() => expect(screen.getByText(en.auth.failed)).toBeInTheDocument());
    // The server distinguishes "no such user" from "wrong password". Echoing
    // that back is a free account-enumeration oracle.
    expect(screen.queryByText(/No active account/)).not.toBeInTheDocument();
  });

  it("distinguishes a server outage from bad credentials", async () => {
    respond(503, {});

    renderWithProviders(<Login />);
    fireEvent.change(screen.getByLabelText(en.auth.usernameLabel), { target: { value: "a" } });
    fireEvent.change(screen.getByLabelText(en.auth.passwordLabel), { target: { value: "b" } });
    fireEvent.click(screen.getByRole("button", { name: en.auth.submit }));

    await waitFor(() => expect(screen.getByText(en.auth.unavailable)).toBeInTheDocument());
  });

  it("disables the submit button for the duration of the request", async () => {
    let release: (() => void) | undefined;
    api.defaults.adapter = async (config) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return { data: {}, status: 200, statusText: "", headers: new AxiosHeaders(), config };
    };

    renderWithProviders(<Login />);
    fireEvent.change(screen.getByLabelText(en.auth.usernameLabel), { target: { value: "a" } });
    fireEvent.change(screen.getByLabelText(en.auth.passwordLabel), { target: { value: "b" } });
    fireEvent.click(screen.getByRole("button", { name: en.auth.submit }));

    // A double-click on a slow connection otherwise fires two logins, and the
    // second one's token wins over the first one's redirect.
    await waitFor(() => expect(screen.getByRole("button", { name: en.auth.submitting })).toBeDisabled());
    release?.();
  });
});
