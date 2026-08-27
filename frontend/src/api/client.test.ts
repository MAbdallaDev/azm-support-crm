import axios, { AxiosError, AxiosHeaders } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetRefreshState, api, navigation } from "@/api/client";
import { tokenStore } from "@/api/tokenStore";

/**
 * The refresh interceptor, exercised through a stubbed adapter rather than a
 * mock server: the adapter is the lowest layer axios has, so both interceptors
 * and the retry all run for real.
 */

const originalAdapter = api.defaults.adapter;

/** Requests that arrive holding this token get a 401; anything else, a 200. */
const STALE = "stale-access";
const FRESH = "fresh-access";

let requests: string[] = [];

const unauthorized = (config: InternalAxiosRequestConfig) =>
  new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, null, {
    status: 401,
    statusText: "Unauthorized",
    data: { detail: "Given token not valid" },
    headers: new AxiosHeaders(),
    config,
  });

beforeEach(() => {
  requests = [];
  __resetRefreshState();
  tokenStore.set({ access: STALE, refresh: "refresh-token", role: "agent" });

  api.defaults.adapter = async (config) => {
    const auth = String(config.headers?.Authorization ?? "");
    requests.push(`${config.url} ${auth}`);

    if (auth === `Bearer ${STALE}`) throw unauthorized(config as InternalAxiosRequestConfig);

    return {
      data: { ok: true },
      status: 200,
      statusText: "OK",
      headers: new AxiosHeaders(),
      config,
    };
  };
});

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  tokenStore.clear();
  __resetRefreshState();
  vi.restoreAllMocks();
});

describe("refresh interceptor", () => {
  it("shares ONE refresh across concurrent 401s and replays both requests", async () => {
    // A deliberately slow refresh: an instant one would let the first 401
    // finish before the second even starts, and the race this test exists for
    // would never happen.
    const post = vi.spyOn(axios, "post").mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ data: { access: FRESH } }), 20);
        }) as never,
    );

    const [first, second] = await Promise.all([api.get("/tickets/"), api.get("/customers/")]);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toContain("/auth/refresh/");
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    // Both original calls: once with the stale token, once replayed with the
    // fresh one. Four requests, one refresh.
    expect(requests).toHaveLength(4);
    expect(requests.filter((entry) => entry.includes(FRESH))).toHaveLength(2);
    expect(tokenStore.access).toBe(FRESH);
  });

  it("retries a request exactly once, then gives up", async () => {
    // A refresh that "succeeds" but hands back the same dead token: without
    // the _retried flag this loops until the stack gives out.
    vi.spyOn(axios, "post").mockResolvedValue({ data: { access: STALE } });

    await expect(api.get("/tickets/")).rejects.toMatchObject({ response: { status: 401 } });
    expect(requests).toHaveLength(2);
  });

  it("clears the session and redirects to the staff login when the refresh fails", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("refresh rejected"));
    const redirect = vi.spyOn(navigation, "redirect").mockImplementation(() => {});

    await expect(api.get("/tickets/")).rejects.toBeInstanceOf(AxiosError);

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(tokenStore.hasToken()).toBe(false);
  });

  it("redirects a customer to the portal login instead", async () => {
    tokenStore.set({ access: STALE, refresh: "refresh-token", role: "customer" });
    vi.spyOn(axios, "post").mockRejectedValue(new Error("refresh rejected"));
    const redirect = vi.spyOn(navigation, "redirect").mockImplementation(() => {});

    await expect(api.get("/portal/tickets/")).rejects.toBeInstanceOf(AxiosError);

    expect(redirect).toHaveBeenCalledWith("/portal/login");
  });

  it("never refreshes on a failed login — that 401 means wrong password", async () => {
    const post = vi.spyOn(axios, "post");

    // The login route is exempt from the Authorization header, so force the
    // 401 by having the adapter reject this URL outright.
    api.defaults.adapter = async (config) => {
      requests.push(String(config.url));
      throw unauthorized(config as InternalAxiosRequestConfig);
    };

    await expect(api.post("/auth/login/", { username: "x", password: "y" })).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(post).not.toHaveBeenCalled();
    expect(requests).toHaveLength(1);
  });

  it("starts a fresh refresh for the next expiry rather than reusing a settled promise", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { access: FRESH } });

    await api.get("/tickets/");
    expect(post).toHaveBeenCalledTimes(1);

    // An hour later the fresh token is stale in turn.
    tokenStore.setAccess(STALE);
    await api.get("/tickets/");

    expect(post).toHaveBeenCalledTimes(2);
  });
});
