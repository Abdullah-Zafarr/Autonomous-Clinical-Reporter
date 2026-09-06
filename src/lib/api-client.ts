export interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

export class ApiError extends Error {
  status?: number;
  responseBody?: string;

  constructor(message: string, status?: number, responseBody?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithTimeout(url: string, options: ApiRequestOptions = {}) {
  const { timeoutMs = 15000, retries = 1, retryDelayMs = 500, ...requestOptions } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...requestOptions,
        signal: requestOptions.signal ? AbortSignal.any([requestOptions.signal, controller.signal]) : controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const body = await response.text();
        if (attempt < retries && RETRYABLE_STATUS.has(response.status)) {
          await wait(retryDelayMs * (attempt + 1));
          continue;
        }
        throw new ApiError(`Request failed with status ${response.status}`, response.status, body);
      }

      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (requestOptions.signal?.aborted) throw error;
      if (error instanceof ApiError && error.status && !RETRYABLE_STATUS.has(error.status)) throw error;
      if (attempt < retries) {
        await wait(retryDelayMs * (attempt + 1));
        continue;
      }
    }
  }

  if (lastError instanceof DOMException && lastError.name === "AbortError") {
    throw new ApiError("Request timed out");
  }
  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new ApiError("Request failed");
}

export async function postJson<TResponse>(url: string, body: unknown, options: ApiRequestOptions = {}) {
  const response = await fetchWithTimeout(url, {
    ...options,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  return (text ? JSON.parse(text) : null) as TResponse;
}
