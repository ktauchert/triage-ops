import { getOptionalEnv } from "../config/env.js";

export type FetchFn = typeof fetch;

export type ResilienceOptions = {
  fetchImpl?: FetchFn;
  timeoutMs?: number;
  retries?: number;
  baseRetryDelayMs?: number;
};

export function getVcsHttpTimeoutMs(): number {
  return parseInt(getOptionalEnv("VCS_HTTP_TIMEOUT_MS", "15000"), 10);
}

export function getOllamaHttpTimeoutMs(): number {
  return parseInt(getOptionalEnv("OLLAMA_HTTP_TIMEOUT_MS", "120000"), 10);
}

function getBaseRetryDelayMs(): number {
  return parseInt(getOptionalEnv("VCS_HTTP_RETRY_BASE_MS", "500"), 10);
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function backoffDelay(attempt: number, base: number): number {
  return base * 2 ** attempt;
}

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) {
    return null;
  }

  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }

  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch wrapper adding a per-attempt timeout and bounded retries with
 * exponential backoff on network errors, HTTP 429 (honoring Retry-After),
 * and 5xx responses. Non-retryable responses (incl. 4xx) are returned as-is
 * for the caller to interpret.
 */
export async function fetchWithResilience(
  url: string,
  init: RequestInit,
  options: ResilienceOptions = {},
): Promise<Response> {
  const {
    fetchImpl = fetch,
    timeoutMs = getVcsHttpTimeoutMs(),
    retries = 2,
    baseRetryDelayMs = getBaseRetryDelayMs(),
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (isRetryableStatus(response.status) && attempt < retries) {
        const retryAfter = parseRetryAfterMs(
          response.headers.get("retry-after"),
        );
        await delay(retryAfter ?? backoffDelay(attempt, baseRetryDelayMs));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await delay(backoffDelay(attempt, baseRetryDelayMs));
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("fetchWithResilience: retries exhausted");
}
