/**
 * The one place that talks HTTP. Every call goes to /api/* on the frontend's own
 * domain (Next.js forwards it to FastAPI), so the session cookie is first-party.
 */
import type { ErrorBody, FieldError } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: FieldError[];

  constructor(status: number, body: ErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.fieldErrors = body.field_errors ?? [];
  }
}

type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

const API_PREFIX = '/api/v1';

export function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return `${API_PREFIX}${path}${qs ? `?${qs}` : ''}`;
}

function redirectToLogin(): void {
  if (typeof window === 'undefined' || window.location.pathname.startsWith('/login')) return;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`/login?next=${next}`);
}

async function toError(response: Response): Promise<ApiError> {
  try {
    const data = (await response.json()) as { error?: ErrorBody };
    if (data.error) return new ApiError(response.status, data.error);
  } catch {
    // not JSON: fall through to a generic error
  }
  return new ApiError(response.status, {
    code: 'ServiceUnavailable',
    message: `The request failed (HTTP ${response.status}). Try again in a moment.`,
    field_errors: [],
  });
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { method = 'GET', body, query, signal } = options;
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      signal,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, {
      code: 'NetworkError',
      message: 'Unable to reach Route 53. Check your connection and try again.',
      field_errors: [],
    });
  }
  if (!response.ok) {
    // Any expired or missing session sends the user back to sign in
    if (response.status === 401 && !path.startsWith('/auth/')) redirectToLogin();
    throw await toError(response);
  }
  return response;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Fetches a file and hands it to the browser as a download. */
export async function apiDownload(
  path: string,
  query: Record<string, QueryValue>,
  fallbackName: string,
): Promise<void> {
  const response = await send(path, { query });
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Field errors keyed by field path, e.g. { name: '...', 'values[1]': '...' }. */
export function fieldErrorMap(error: unknown, prefix = ''): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const map: Record<string, string> = {};
  for (const item of error.fieldErrors) {
    if (!item.field.startsWith(prefix)) continue;
    const key = item.field.slice(prefix.length);
    map[key] ??= item.message;
  }
  return map;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Try again.';
}
