import { describe, expect, it, vi } from "vitest";
import { fetchWithResilience, type FetchFn } from "./http.js";

function jsonResponse(status: number, body = "ok"): Response {
  return new Response(body, { status });
}

describe("fetchWithResilience", () => {
  it("returns a successful response without retrying", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200)) as unknown as FetchFn;

    const response = await fetchWithResilience("https://x/", {}, { fetchImpl });

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries on 5xx then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(200)) as unknown as FetchFn;

    const response = await fetchWithResilience(
      "https://x/",
      {},
      { fetchImpl, baseRetryDelayMs: 0 },
    );

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries on 429 then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("slow down", {
          status: 429,
          headers: { "retry-after": "0" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200)) as unknown as FetchFn;

    const response = await fetchWithResilience(
      "https://x/",
      {},
      { fetchImpl, baseRetryDelayMs: 0 },
    );

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 4xx", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(404)) as unknown as FetchFn;

    const response = await fetchWithResilience(
      "https://x/",
      {},
      { fetchImpl, baseRetryDelayMs: 0 },
    );

    expect(response.status).toBe(404);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns the last response when retries are exhausted", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(503)) as unknown as FetchFn;

    const response = await fetchWithResilience(
      "https://x/",
      {},
      { fetchImpl, retries: 2, baseRetryDelayMs: 0 },
    );

    expect(response.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("retries on network errors then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(jsonResponse(200)) as unknown as FetchFn;

    const response = await fetchWithResilience(
      "https://x/",
      {},
      { fetchImpl, baseRetryDelayMs: 0 },
    );

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("aborts a request that exceeds the timeout", async () => {
    const fetchImpl = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      })) as unknown as FetchFn;

    await expect(
      fetchWithResilience("https://x/", {}, { fetchImpl, timeoutMs: 10, retries: 0 }),
    ).rejects.toThrow();
  });
});
