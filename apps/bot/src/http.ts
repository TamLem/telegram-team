/** Shared fetch helpers with AbortController deadlines. */

export class HttpTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HttpTimeoutError";
  }
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 10_000, ...init } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // If the caller already provided a signal, abort when either fires.
  if (init.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || controller.signal.aborted)
    ) {
      throw new HttpTimeoutError(
        `Request timed out after ${timeoutMs}ms: ${url}`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
