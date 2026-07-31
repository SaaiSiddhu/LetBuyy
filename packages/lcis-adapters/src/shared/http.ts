/**
 * Read-only HTTP client — the ONLY network egress in the adapter platform.
 * GET requests only, to an explicit host allowlist. There is no method to POST/PUT/
 * PATCH/DELETE; mutation is unrepresentable. Tests inject MockHttpClient (no network).
 */
export interface ReadOnlyHttpClient {
  get<T = unknown>(url: string, opts?: { headers?: Record<string, string> }): Promise<T>;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
  ) {
    super(`HTTP ${status} for ${redactUrl(url)}`);
    this.name = 'HttpError';
  }
}

/** Real client: GET-only fetch, host-allowlisted, with a timeout. */
export class FetchHttpClient implements ReadOnlyHttpClient {
  constructor(
    private readonly allowHosts: readonly string[],
    private readonly timeoutMs = 8000,
  ) {}

  async get<T = unknown>(url: string, opts?: { headers?: Record<string, string> }): Promise<T> {
    const u = new URL(url);
    if (!this.allowHosts.includes(u.host)) {
      throw new Error(`lcis-adapters: host not allowlisted: ${u.host}`);
    }
    const res = await fetch(url, {
      method: 'GET',
      headers: opts?.headers,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new HttpError(res.status, url);
    return (await res.json()) as T;
  }
}

/** Test client: canned responses by URL matcher. No network. */
export class MockHttpClient implements ReadOnlyHttpClient {
  constructor(
    private readonly routes: ReadonlyArray<{ match: (url: string) => boolean; body: unknown; status?: number }>,
  ) {}

  async get<T = unknown>(url: string): Promise<T> {
    const r = this.routes.find((x) => x.match(url));
    if (!r) throw new HttpError(404, url);
    if (r.status !== undefined && r.status >= 400) throw new HttpError(r.status, url);
    return r.body as T;
  }
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return '<url>';
  }
}
