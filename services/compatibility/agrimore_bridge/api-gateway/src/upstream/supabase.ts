import { HttpError } from '../runtime/errors';
import type { Env, RequestContext } from '../runtime/types';

export type SupabaseSchema = 'app' | 'catalog' | 'commerce' | 'logistics' | 'ops';

type QueryValue = string | number | boolean | null | undefined;

export async function supabaseSelect<T>(
  env: Env,
  context: RequestContext,
  schema: SupabaseSchema,
  table: string,
  query: Record<string, QueryValue>,
  options: { readonly serviceRole?: boolean; readonly maybeSingle?: boolean } = {},
): Promise<T> {
  return supabaseRequest<T>(env, context, schema, table, {
    method: 'GET',
    query,
    serviceRole: options.serviceRole,
    maybeSingle: options.maybeSingle,
  });
}

export async function supabaseInsert<T>(
  env: Env,
  context: RequestContext,
  schema: SupabaseSchema,
  table: string,
  body: unknown,
  options: { readonly serviceRole?: boolean } = {},
): Promise<T> {
  return supabaseRequest<T>(env, context, schema, table, {
    method: 'POST',
    body,
    serviceRole: options.serviceRole,
    preferRepresentation: true,
  });
}

export async function supabaseUpdate<T>(
  env: Env,
  context: RequestContext,
  schema: SupabaseSchema,
  table: string,
  query: Record<string, QueryValue>,
  body: unknown,
  options: { readonly serviceRole?: boolean } = {},
): Promise<T> {
  return supabaseRequest<T>(env, context, schema, table, {
    method: 'PATCH',
    query,
    body,
    serviceRole: options.serviceRole,
    preferRepresentation: true,
  });
}

export async function supabaseDelete<T>(
  env: Env,
  context: RequestContext,
  schema: SupabaseSchema,
  table: string,
  query: Record<string, QueryValue>,
  options: { readonly serviceRole?: boolean } = {},
): Promise<T> {
  return supabaseRequest<T>(env, context, schema, table, {
    method: 'DELETE',
    query,
    serviceRole: options.serviceRole,
    preferRepresentation: true,
  });
}

export async function supabaseRpc<T>(
  env: Env,
  context: RequestContext,
  schema: SupabaseSchema,
  functionName: string,
  body: unknown,
  options: { readonly serviceRole?: boolean } = {},
): Promise<T> {
  return supabaseRequest<T>(env, context, schema, `rpc/${functionName}`, {
    method: 'POST',
    body,
    serviceRole: options.serviceRole,
  });
}

export async function invokeEdgeFunction<T>(
  env: Env,
  context: RequestContext,
  functionName: string,
  body: unknown,
  options: { readonly serviceRole?: boolean } = {},
): Promise<T> {
  const headers = supabaseHeaders(env, context, 'app', options.serviceRole);
  headers.set('x-user-id', context.auth?.userId ?? '');
  headers.set('x-user-role', context.auth?.roles[0] ?? 'anonymous');
  headers.set('x-request-id', context.ids.requestId);
  headers.set('x-trace-id', context.ids.traceId);

  const response = await fetch(`${supabaseBaseUrl(env)}/functions/v1/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await toHttpError(response, `edge.${functionName}.failed`);
  }

  return (await response.json()) as T;
}

async function supabaseRequest<T>(
  env: Env,
  context: RequestContext,
  schema: SupabaseSchema,
  path: string,
  options: {
    readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    readonly query?: Record<string, QueryValue>;
    readonly body?: unknown;
    readonly serviceRole?: boolean;
    readonly maybeSingle?: boolean;
    readonly preferRepresentation?: boolean;
  },
): Promise<T> {
  const url = new URL(`${supabaseBaseUrl(env)}/rest/v1/${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = supabaseHeaders(env, context, schema, options.serviceRole);
  if (options.preferRepresentation) {
    headers.set('prefer', 'return=representation');
  }
  if (options.maybeSingle) {
    headers.set('accept', 'application/vnd.pgrst.object+json');
  }

  const response = await fetch(url.toString(), {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    if (options.maybeSingle && response.status === 406) {
      return null as T;
    }
    throw await toHttpError(response, `supabase.${schema}.${path.replaceAll('/', '.')}.failed`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

function supabaseHeaders(env: Env, context: RequestContext, schema: SupabaseSchema, serviceRole = false): Headers {
  const serviceKey = serviceRole ? env.SUPABASE_SERVICE_ROLE_KEY : undefined;
  const apikey = serviceKey ?? env.SUPABASE_ANON_KEY;
  const bearer = serviceKey ?? context.auth?.token ?? env.SUPABASE_ANON_KEY;
  const headers = new Headers({
    apikey,
    authorization: `Bearer ${bearer}`,
    'content-type': 'application/json',
    'x-client-info': 'agrimore-api-gateway',
  });
  headers.set('accept-profile', schema);
  headers.set('content-profile', schema);
  return headers;
}

function supabaseBaseUrl(env: Env): string {
  return env.SUPABASE_URL.replace(/\/+$/, '');
}

async function toHttpError(response: Response, code: string): Promise<HttpError> {
  const text = await response.text();
  let details: Record<string, unknown> = {};
  try {
    details = JSON.parse(text) as Record<string, unknown>;
  } catch {
    details = { body: text.slice(0, 1000) };
  }

  return new HttpError(response.status, code, 'Upstream Supabase request failed.', response.status >= 500, details);
}
