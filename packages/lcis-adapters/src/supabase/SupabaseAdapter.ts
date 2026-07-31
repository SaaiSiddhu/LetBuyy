/**
 * SupabaseAdapter — READ-ONLY observer of Supabase (PostgREST + Management API).
 *
 * Honesty contract:
 *  - Credentials absent → NOT_CONNECTED (base handles this automatically).
 *  - Credentials present → GET-only probe/gather/checks; no mutation is possible.
 *  - Management API calls only happen when SUPABASE_ACCESS_TOKEN is also set.
 *  - dbIntel (from lcis-core ArtifactStore) is used when available; gracefully skipped otherwise.
 *  - All API responses are Zod-validated before use; malformed data → empty facts, no crash.
 *
 * IMPORTANT: this file must remain pure — no filesystem writes, no process execution, no eval.
 */
import { createEngine } from '@letbuyy/lcis-core';
import {
  AdapterBase,
  type AdapterDeps,
  type AdapterMetadata,
  EvidenceBuilder,
  type GatherResult,
  type VerificationFinding,
} from '../shared/index';
import type { LiveFact } from '../shared/contracts';
import {
  DbFunctionsListSchema,
  MigrationsListSchema,
  PoliciesListSchema,
  PostgRestOpenApiSchema,
  type DbFunction,
  type Migration,
  type Policy,
} from './types';

// ---------------------------------------------------------------------------
// Internal payload shape (what gather() returns as payload)
// ---------------------------------------------------------------------------

export interface SupabasePayload {
  readonly facts: readonly LiveFact[];
  readonly liveTables: readonly string[];
  readonly livePolicies: readonly Policy[];
  readonly liveMigrations: readonly Migration[];
  readonly liveFunctions: readonly DbFunction[];
  readonly projectRef: string | null;
}

const EMPTY_PAYLOAD: SupabasePayload = {
  facts: [],
  liveTables: [],
  livePolicies: [],
  liveMigrations: [],
  liveFunctions: [],
  projectRef: null,
};

// ---------------------------------------------------------------------------
// Helper — extract the Supabase project ref from a URL
// ---------------------------------------------------------------------------

function extractProjectRef(supabaseUrl: string): string | null {
  try {
    const hostname = new URL(supabaseUrl).hostname; // e.g. abcdefghijklmno.supabase.co
    const parts = hostname.split('.');
    if (parts.length >= 3 && parts[1] === 'supabase' && parts[2] === 'co') {
      return parts[0] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SupabaseAdapter
// ---------------------------------------------------------------------------

export class SupabaseAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) {
    super(deps);
  }

  metadata(): AdapterMetadata {
    return {
      name: 'supabase',
      displayName: 'Supabase',
      requiredEnv: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
      capabilities: ['status', 'tables', 'policies', 'migrations', 'drift', 'health'],
      sourceOfTruth: 'Supabase',
    };
  }

  // -------------------------------------------------------------------------
  // probe() — lightweight liveness check (one GET to PostgREST root)
  // -------------------------------------------------------------------------

  protected async probe(): Promise<void> {
    const supabaseUrl = this.creds.value('SUPABASE_URL') ?? '';
    const serviceKey = this.creds.value('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    await this.http.get(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    // If the GET succeeds (no throw), probe passes. HttpError from non-200 propagates.
  }

  // -------------------------------------------------------------------------
  // gather() — read tables/policies/migrations/functions; emit LiveFacts
  // -------------------------------------------------------------------------

  protected async gather(): Promise<GatherResult> {
    const supabaseUrl = this.creds.value('SUPABASE_URL') ?? '';
    const serviceKey = this.creds.value('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const accessToken = this.creds.value('SUPABASE_ACCESS_TOKEN');
    const projectRef = extractProjectRef(supabaseUrl);
    const src = 'Supabase';
    const facts: LiveFact[] = [];

    // -- 1. PostgREST OpenAPI root → table list --------------------------------

    let liveTables: string[] = [];
    try {
      const raw = await this.http.get<unknown>(`${supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      });
      const parsed = PostgRestOpenApiSchema.safeParse(raw);
      if (parsed.success) {
        const definitions = parsed.data.definitions ?? {};
        liveTables = Object.keys(definitions);
        for (const tableName of liveTables) {
          facts.push({
            adapter: 'supabase',
            kind: 'table',
            subject: tableName,
            detail: `Table "${tableName}" observed via PostgREST OpenAPI`,
            at: this.now(),
            evidence: [
              EvidenceBuilder.entity('table', tableName, src),
              EvidenceBuilder.observed(`supabase.table.${tableName}`, `observed in PostgREST OpenAPI`, `${supabaseUrl}/rest/v1/`),
            ],
          });
        }
      }
    } catch {
      // PostgREST root failed — no table facts, but don't crash
    }

    // -- 2. Management API calls (only if SUPABASE_ACCESS_TOKEN present) ------

    let livePolicies: Policy[] = [];
    let liveMigrations: Migration[] = [];
    let liveFunctions: DbFunction[] = [];

    if (accessToken && projectRef) {
      const mgmtHeaders = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };
      const mgmtBase = `https://api.supabase.com/v1/projects/${projectRef}`;

      // Migrations
      try {
        const raw = await this.http.get<unknown>(`${mgmtBase}/migrations`, { headers: mgmtHeaders });
        const parsed = MigrationsListSchema.safeParse(raw);
        if (parsed.success) {
          liveMigrations = parsed.data;
          for (const m of liveMigrations) {
            facts.push({
              adapter: 'supabase',
              kind: 'migration',
              subject: m.version,
              detail: `Migration ${m.version}${m.name ? ` (${m.name})` : ''} status=${m.status ?? 'unknown'}`,
              at: m.inserted_at ?? this.now(),
              evidence: [
                EvidenceBuilder.observed(`supabase.migration.${m.version}`, `status=${m.status ?? 'unknown'}`, `${mgmtBase}/migrations`),
              ],
            });
          }
        }
      } catch {
        // Management API unavailable — skip migrations
      }

      // Policies
      try {
        const raw = await this.http.get<unknown>(`${mgmtBase}/database/policies`, { headers: mgmtHeaders });
        const parsed = PoliciesListSchema.safeParse(raw);
        if (parsed.success) {
          livePolicies = parsed.data;
          for (const p of livePolicies) {
            facts.push({
              adapter: 'supabase',
              kind: 'policy',
              subject: `${p.table}.${p.name}`,
              detail: `Policy "${p.name}" on table "${p.table}" (command=${p.command ?? 'ALL'})`,
              at: this.now(),
              evidence: [
                EvidenceBuilder.entity('policy', `${p.table}.${p.name}`, src),
                EvidenceBuilder.observed(`supabase.policy.${p.table}.${p.name}`, `command=${p.command ?? 'ALL'}`, `${mgmtBase}/database/policies`),
              ],
            });
          }
        }
      } catch {
        // Skip policies
      }

      // Functions
      try {
        const raw = await this.http.get<unknown>(`${mgmtBase}/database/functions`, { headers: mgmtHeaders });
        const parsed = DbFunctionsListSchema.safeParse(raw);
        if (parsed.success) {
          liveFunctions = parsed.data;
          for (const f of liveFunctions) {
            facts.push({
              adapter: 'supabase',
              kind: 'function',
              subject: f.name,
              detail: `Function "${f.name}" language=${f.language ?? 'unknown'} security_definer=${f.security_definer ?? false}`,
              at: this.now(),
              evidence: [
                EvidenceBuilder.entity('rpc', f.name, src),
                EvidenceBuilder.observed(`supabase.function.${f.name}`, `language=${f.language ?? 'unknown'}`, `${mgmtBase}/database/functions`),
              ],
            });
          }
        }
      } catch {
        // Skip functions
      }

      // Extensions (inform health but not individual facts by default)
      try {
        await this.http.get<unknown>(`${mgmtBase}/database/extensions`, { headers: mgmtHeaders });
        // extensions are read-only observability; we don't emit per-extension facts (noise)
      } catch {
        // Skip extensions
      }
    }

    const payload: SupabasePayload = {
      facts,
      liveTables,
      livePolicies,
      liveMigrations,
      liveFunctions,
      projectRef,
    };

    return {
      payload,
      evidence: [
        EvidenceBuilder.observed('supabase.gather', `${liveTables.length} table(s), ${livePolicies.length} policy(ies), ${liveMigrations.length} migration(s), ${liveFunctions.length} function(s)`, src),
      ],
      confidence: 0.85,
    };
  }

  // -------------------------------------------------------------------------
  // checks() — deterministic findings over the gathered payload
  // -------------------------------------------------------------------------

  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
    const snap = payload as SupabasePayload;
    if (!snap || !Array.isArray(snap.facts)) return [];

    const findings: VerificationFinding[] = [];
    const src = 'Supabase';

    // -- Load dbIntel from lcis-core (graceful — null if artifact absent) -----
    let dbIntel: {
      tables: Array<{ name: string; money?: boolean; tenant?: boolean }>;
      functions: Array<{ name: string }>;
    } | null = null;

    try {
      const engine = createEngine();
      dbIntel = engine.store.tryRead<{
        tables: Array<{ name: string; money?: boolean; tenant?: boolean }>;
        functions: Array<{ name: string }>;
      }>('db-intel');
    } catch {
      // lcis-core or the artifact is unavailable — skip structural checks
    }

    // -- 1. schema-drift: tables in live but not in graph, and vice versa ------

    if (dbIntel) {
      const graphTables = new Set(dbIntel.tables.map((t) => t.name.toLowerCase()));
      const liveTables = new Set(snap.liveTables.map((t) => t.toLowerCase()));

      // Live tables not in graph
      for (const t of liveTables) {
        if (!graphTables.has(t)) {
          findings.push({
            kind: 'schema-drift',
            severity: 'medium',
            subject: t,
            detail: `Table "${t}" exists in live Supabase (PostgREST OpenAPI) but is absent from the lcis-core graph. Possible new/untracked table.`,
            evidence: [
              EvidenceBuilder.entity('table', t, src),
              EvidenceBuilder.observed(`supabase.drift.extra.${t}`, 'present in live, absent in graph', `${this.creds.value('SUPABASE_URL') ?? ''}/rest/v1/`),
            ],
          });
        }
      }

      // Graph tables not in live
      for (const t of graphTables) {
        if (!liveTables.has(t)) {
          findings.push({
            kind: 'schema-drift',
            severity: 'medium',
            subject: t,
            detail: `Table "${t}" exists in the lcis-core graph but is absent from live Supabase (PostgREST OpenAPI). Possible dropped/renamed/not-exposed table.`,
            evidence: [
              EvidenceBuilder.observed(`supabase.drift.missing.${t}`, 'present in graph, absent in live', 'graphify-out/db-intel.json'),
            ],
          });
        }
      }

      // -- 2. missing-rls: tenant tables without any live policy ---------------

      const policyTables = new Set(snap.livePolicies.map((p) => p.table.toLowerCase()));
      for (const dbTable of dbIntel.tables) {
        if (dbTable.tenant === true && !policyTables.has(dbTable.name.toLowerCase())) {
          findings.push({
            kind: 'missing-rls',
            severity: 'critical',
            subject: dbTable.name,
            detail: `Tenant-scoped table "${dbTable.name}" has no RLS policy in live Supabase. All tenant data may be cross-visible. Set SUPABASE_ACCESS_TOKEN to verify policies via the Management API.`,
            evidence: [
              EvidenceBuilder.entity('table', dbTable.name, src),
              EvidenceBuilder.observed(`supabase.rls.missing.${dbTable.name}`, 'no policy found in live', 'graphify-out/db-intel.json'),
            ],
          });
        }
      }

      // -- 4. unused-table: live tables not in graph at all -------------------
      // (already covered by schema-drift extra — alias with different kind for consumers)

      // -- 6. orphan-rpc: functions in live not in dbIntel.functions ----------

      const graphFunctions = new Set(dbIntel.functions.map((f) => f.name.toLowerCase()));
      for (const liveFunc of snap.liveFunctions) {
        if (!graphFunctions.has(liveFunc.name.toLowerCase())) {
          findings.push({
            kind: 'orphan-rpc',
            severity: 'low',
            subject: liveFunc.name,
            detail: `Function "${liveFunc.name}" exists in live Supabase but is not tracked in the lcis-core graph. May be a shadow function, legacy RPC, or an undocumented extension.`,
            evidence: [
              EvidenceBuilder.entity('rpc', liveFunc.name, src),
              EvidenceBuilder.observed(`supabase.orphan-rpc.${liveFunc.name}`, 'present in live, absent in graph', 'graphify-out/db-intel.json'),
            ],
          });
        }
      }
    }

    // -- 3. broken-migration: migrations in error/failed state ----------------

    const failedStatuses = new Set(['FAILED', 'FAILED_CLEANUP']);
    for (const m of snap.liveMigrations) {
      if (m.status && failedStatuses.has(m.status)) {
        findings.push({
          kind: 'broken-migration',
          severity: 'high',
          subject: m.version,
          detail: `Migration ${m.version}${m.name ? ` (${m.name})` : ''} is in state "${m.status}". The database schema may be in a partial/inconsistent state.`,
          evidence: [
            EvidenceBuilder.observed(`supabase.migration.failed.${m.version}`, `status=${m.status}`, snap.projectRef ? `https://api.supabase.com/v1/projects/${snap.projectRef}/migrations` : 'Supabase Management API'),
          ],
        });
      }
    }

    // -- 5. dangerous-policy: policies with USING (true) on tenant tables ------

    const tenantTableNames = new Set(
      (dbIntel?.tables ?? []).filter((t) => t.tenant === true).map((t) => t.name.toLowerCase()),
    );
    for (const p of snap.livePolicies) {
      const def = (p.definition ?? '').toLowerCase().trim();
      // Match USING (true) or USING(true) patterns
      if (/using\s*\(\s*true\s*\)/.test(def) && tenantTableNames.has(p.table.toLowerCase())) {
        findings.push({
          kind: 'dangerous-policy',
          severity: 'critical',
          subject: `${p.table}.${p.name}`,
          detail: `Policy "${p.name}" on tenant table "${p.table}" uses USING (true) — all rows visible regardless of tenant context. This is a cross-tenant data leakage risk.`,
          evidence: [
            EvidenceBuilder.entity('policy', `${p.table}.${p.name}`, src),
            EvidenceBuilder.observed(`supabase.policy.dangerous.${p.table}.${p.name}`, 'USING (true) on tenant table', snap.projectRef ? `https://api.supabase.com/v1/projects/${snap.projectRef}/database/policies` : 'Supabase Management API'),
          ],
        });
      }
    }

    return findings;
  }
}
