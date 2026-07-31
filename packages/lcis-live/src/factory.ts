/**
 * createLivePlatform — wires the 4 read-only adapters with GET-only, host-allowlisted
 * HTTP clients + presence-only credential checks, plus the lcis-core engine for correlation.
 * With no credentials present (this environment), every adapter is honestly NOT_CONNECTED.
 */
import { type LcisEngine, getEngine } from '@letbuyy/lcis-core';
import {
  CloudflareAdapter,
  CredentialProvider,
  FetchHttpClient,
  GitHubAdapter,
  type LiveAdapter,
  SupabaseAdapter,
  VercelAdapter,
} from '@letbuyy/lcis-adapters';
import { LivePlatform } from './platform';

export interface LivePlatformOptions {
  /** Inject adapters (tests). Defaults to the 4 real read-only adapters. */
  readonly adapters?: readonly LiveAdapter[];
  readonly engine?: LcisEngine;
  readonly now?: () => string;
}

function supabaseHost(env: Record<string, string | undefined> = process.env): string {
  try {
    return new URL(env['SUPABASE_URL'] ?? 'https://project.supabase.co').host;
  } catch {
    return 'project.supabase.co';
  }
}

export function defaultAdapters(): LiveAdapter[] {
  const creds = new CredentialProvider();
  return [
    new SupabaseAdapter({ http: new FetchHttpClient([supabaseHost(), 'api.supabase.com']), creds }),
    new GitHubAdapter({ http: new FetchHttpClient(['api.github.com']), creds }),
    new CloudflareAdapter({ http: new FetchHttpClient(['api.cloudflare.com']), creds }),
    new VercelAdapter({ http: new FetchHttpClient(['api.vercel.com']), creds }),
  ];
}

export function createLivePlatform(opts: LivePlatformOptions = {}): LivePlatform {
  const engine = opts.engine ?? getEngine();
  const adapters = opts.adapters ?? defaultAdapters();
  return new LivePlatform(adapters, engine, opts.now);
}
