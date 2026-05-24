import {
  createClient,
  type SupabaseClient as SupabaseJsClient,
  type User,
  type Session,
  type AuthChangeEvent,
} from '@supabase/supabase-js';
import {
  createBrowserClient,
  createServerClient,
} from '@supabase/ssr';

// Existing runtimes still use untyped Supabase query builders while database
// contracts are normalized. Keep the looseness contained at the adapter edge.
type UntypedSupabaseDatabase = any;

export type SupabaseClient = SupabaseJsClient<UntypedSupabaseDatabase>;
export type { User, Session, AuthChangeEvent };

type SupabaseCreateOptions = Parameters<typeof createClient>[2];
type SupabaseServerClientOptions = Parameters<typeof createServerClient>[2];

export interface SupabaseServiceEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY?: string;
}

export interface SupabaseAnonEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

export function createSupabaseServiceClient(env: SupabaseServiceEnv, options?: SupabaseCreateOptions): SupabaseClient {
  return createClient<UntypedSupabaseDatabase>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...options,
  });
}

export function createSupabaseAnonClient(env: SupabaseAnonEnv, options?: SupabaseCreateOptions): SupabaseClient {
  return createClient<UntypedSupabaseDatabase>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, options);
}

export function createSupabaseUserClient(env: SupabaseAnonEnv, token: string): SupabaseClient {
  return createSupabaseAnonClient(env, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export function createSupabaseBrowserClient(url: string, anonKey: string) {
  return createBrowserClient(url, anonKey);
}

export function createSupabaseServerClient(url: string, anonKey: string, cookies: SupabaseServerClientOptions['cookies']) {
  return createServerClient(url, anonKey, { cookies });
}

export function supabaseRestUrl(env: SupabaseServiceEnv, table: string, params: Record<string, string>): string {
  const url = new URL(`/rest/v1/${table}`, env.SUPABASE_URL);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

export function supabaseServiceHeaders(env: SupabaseServiceEnv, prefer = 'return=representation'): HeadersInit {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
}

export async function selectSupabaseRows<T>(
  env: SupabaseServiceEnv,
  table: string,
  params: Record<string, string>,
): Promise<T[]> {
  const response = await fetch(supabaseRestUrl(env, table, params), {
    headers: supabaseServiceHeaders(env),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`Supabase select failed for ${table}: ${response.status} ${message}`);
  }

  return response.json() as Promise<T[]>;
}

export async function patchSupabaseRows<T>(
  env: SupabaseServiceEnv,
  table: string,
  params: Record<string, string>,
  body: Record<string, unknown>,
  prefer = 'return=representation',
): Promise<T[]> {
  const response = await fetch(supabaseRestUrl(env, table, params), {
    method: 'PATCH',
    headers: supabaseServiceHeaders(env, prefer),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`Supabase patch failed for ${table}: ${response.status} ${message}`);
  }

  if (prefer.includes('return=minimal')) return [];
  return response.json() as Promise<T[]>;
}

export async function insertSupabaseRows<T>(
  env: SupabaseServiceEnv,
  table: string,
  rows: Record<string, unknown> | Array<Record<string, unknown>>,
): Promise<T[]> {
  const response = await fetch(supabaseRestUrl(env, table, {}), {
    method: 'POST',
    headers: supabaseServiceHeaders(env),
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`Supabase insert failed for ${table}: ${response.status} ${message}`);
  }

  return response.json() as Promise<T[]>;
}

export async function upsertSupabaseRows<T>(
  env: SupabaseServiceEnv,
  table: string,
  rows: Record<string, unknown> | Array<Record<string, unknown>>,
  options: { onConflict: string; prefer?: string },
): Promise<T[]> {
  const response = await fetch(supabaseRestUrl(env, table, { on_conflict: options.onConflict }), {
    method: 'POST',
    headers: supabaseServiceHeaders(env, options.prefer || 'resolution=ignore-duplicates,return=representation'),
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`Supabase upsert failed for ${table}: ${response.status} ${message}`);
  }

  return response.json() as Promise<T[]>;
}
