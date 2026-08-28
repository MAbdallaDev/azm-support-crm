import { AxiosHeaders, AxiosError } from "axios";
import type { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";

import { api } from "@/api/client";

/**
 * A stubbed axios **adapter**, rather than a mock of each hook.
 *
 * The adapter is the lowest layer axios has, so everything above it — the
 * request interceptor, the refresh interceptor, the query hooks — runs for
 * real. That matters here specifically: several of this story's assertions are
 * *about the requests themselves* ("the tab count came from a server query,
 * not a client-side filter"), and a mocked hook would erase the evidence.
 */

export type Handler = (config: AxiosRequestConfig) => unknown;

export type ApiMock = {
  /** Every request that reached the adapter, in order, as `METHOD url`. */
  requests: string[];
  /** Just the URLs, for readable assertions. */
  urls: () => string[];
  /** Register a handler. The **last** matching registration wins, so a test can
   *  override a default set up in `beforeEach` by registering the same match. */
  on: (match: string, handler: Handler) => void;
  /** Force the next matching request to reject with this status. */
  fail: (match: string, status?: number) => void;
  restore: () => void;
};

export const installApiMock = (): ApiMock => {
  const original = api.defaults.adapter;
  const requests: string[] = [];
  const handlers: { match: string; handler: Handler }[] = [];
  const failures: { match: string; status: number }[] = [];

  api.defaults.adapter = async (config) => {
    const url = config.url ?? "";
    requests.push(`${(config.method ?? "get").toUpperCase()} ${url}`);

    const failure = [...failures].reverse().find((entry) => url.includes(entry.match));
    if (failure) {
      throw new AxiosError("Mocked failure", "ERR_BAD_RESPONSE", config, null, {
        status: failure.status,
        statusText: "Error",
        data: { detail: "mocked" },
        headers: new AxiosHeaders(),
        config: config as InternalAxiosRequestConfig,
      });
    }

    // Reverse: later registrations override earlier ones, which is what lets a
    // single test replace a default without unpicking the shared setup.
    const entry = [...handlers].reverse().find((candidate) => url.includes(candidate.match));
    const data = entry ? entry.handler(config) : {};

    return {
      data,
      status: 200,
      statusText: "OK",
      headers: new AxiosHeaders(),
      config,
    };
  };

  return {
    requests,
    urls: () => requests.map((entry) => entry.split(" ").slice(1).join(" ")),
    on: (match, handler) => handlers.push({ match, handler }),
    fail: (match, status = 500) => failures.push({ match, status }),
    restore: () => {
      api.defaults.adapter = original;
    },
  };
};

/** DRF's pagination envelope, so a handler can return rows directly. */
export const page = <T>(results: T[], count = results.length) => ({
  count,
  next: null,
  previous: null,
  results,
});
