/**
 * PostgresAdapter — READ-ONLY observer of PostgreSQL (Supabase) via the
 * Supabase Management API (https://api.supabase.com).
 *
 * Reads: project metadata, db service health, postgres config keys.
 * Uses the injected ReadOnlyHttpClient (GET only).
 * No mutation is possible — the interface exposes only this.http.get(...).
 *
 * Honesty contract:
 *  - Credentials absent → NOT_CONNECTED, names SUPABASE_MGMT_TOKEN + SUPABASE_PROJECT_REF.
 *  - Health endpoint absence is tolerated; evidence states NOT CONNECTED with exact reason.
 *  - Config endpoint absence is tolerated; evidence states NOT CONNECTED with exact reason.
 *  - Live query stats / connection counts: NOT CONNECTED in evidence (requires pg_stat via
 *    SQL, not exposed over GET via Management API).
 *  - Confidence capped at 0.85 (health/config endpoints may be absent; first-page only).
 */
import { type Evidence } from '@letbuyy/lcis-core';
import {
  AdapterBase,
  type AdapterDeps,
  type AdapterMetadata,
  EvidenceBuilder,
  type GatherResult,
  type LiveFact,
  type VerificationFinding,
} from '../shared/index';
import {
  DB_CONFIG_ALLOWLIST,
  HEALTHY_STATUSES,
  SupabaseHealthResponseSchema,
  SupabasePostgresConfigSchema,
  SupabaseProjectSchema,
  type DbConfigKey,
  type PostgresPayload,
  type SupabaseProject,
  type SupabaseServiceHealth,
} from './types';

const SUPABASE_API = 'https://api.supabase.com';
const SOURCE = 'Supabase Management API';

export class PostgresAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) {
    super(deps);
  }

  metadata(): AdapterMetadata {
    return {
      name: 'postgres',
      displayName: 'PostgreSQL (Supabase Management)',
      requiredEnv: ['SUPABASE_MGMT_TOKEN', 'SUPABASE_PROJECT_REF'],
      capabilities: ['database-health', 'postgres-config', 'version'],
      sourceOfTruth: SOURCE,
    };
  }

  // ── Probe ─────────────────────────────────────────────────────────────────────

  protected async probe(): Promise<void> {
    const token = this.creds.value('SUPABASE_MGMT_TOKEN');
    const ref = this.creds.value('SUPABASE_PROJECT_REF');
    const raw = await this.http.get(`${SUPABASE_API}/v1/projects/${encodeURIComponent(ref!)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const parsed = SupabaseProjectSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Supabase /v1/projects/${ref}: unexpected response shape — token or ref may be invalid`,
      );
    }
  }

  // ── Gather ────────────────────────────────────────────────────────────────────

  protected async gather(): Promise<GatherResult> {
    const token = this.creds.value('SUPABASE_MGMT_TOKEN');
    const ref = this.creds.value('SUPABASE_PROJECT_REF');
    const headers = { Authorization: `Bearer ${token}` };
    const ev: Evidence[] = [];

    // ── Project metadata ──────────────────────────────────────────────────────
    const projectRaw = await this.http.get(
      `${SUPABASE_API}/v1/projects/${encodeURIComponent(ref!)}`,
      { headers },
    );
    const projectParsed = SupabaseProjectSchema.safeParse(projectRaw);
    if (!projectParsed.success) {
      throw new Error(
        `Supabase /v1/projects/${ref}: invalid response shape — ${projectParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const project: SupabaseProject = projectParsed.data;
    ev.push(
      EvidenceBuilder.observed(
        'postgres.project',
        `project="${project.name}" ref=${ref}${project.region ? ` region=${project.region}` : ''}${project.db_version ? ` version=${project.db_version}` : ''}`,
        SOURCE,
      ),
    );

    // ── Health ────────────────────────────────────────────────────────────────
    let health: SupabaseServiceHealth[] = [];
    let healthConnected = false;
    try {
      const healthRaw = await this.http.get(
        `${SUPABASE_API}/v1/projects/${encodeURIComponent(ref!)}/health?services=db`,
        { headers },
      );
      const healthParsed = SupabaseHealthResponseSchema.safeParse(healthRaw);
      if (healthParsed.success) {
        health = [...healthParsed.data];
        healthConnected = true;
        ev.push(
          EvidenceBuilder.observed(
            'postgres.health',
            `${health.length} service(s) observed — ${health.map((s) => `${s.name}=${s.status}`).join(', ')}`,
            SOURCE,
          ),
        );
      } else {
        ev.push(
          EvidenceBuilder.observed(
            'postgres.health',
            `NOT CONNECTED — health endpoint returned unexpected shape: ${healthParsed.error.issues[0]?.message ?? 'parse error'}`,
            SOURCE,
          ),
        );
      }
    } catch (e) {
      ev.push(
        EvidenceBuilder.observed(
          'postgres.health',
          `NOT CONNECTED — health endpoint fetch failed: ${e instanceof Error ? e.message : String(e)}`,
          SOURCE,
        ),
      );
    }

    // ── Postgres config ───────────────────────────────────────────────────────
    const configValues: Partial<Record<DbConfigKey, unknown>> = {};
    let configConnected = false;
    try {
      const configRaw = await this.http.get(
        `${SUPABASE_API}/v1/projects/${encodeURIComponent(ref!)}/config/database/postgres`,
        { headers },
      );
      const configParsed = SupabasePostgresConfigSchema.safeParse(configRaw);
      if (configParsed.success) {
        configConnected = true;
        for (const key of DB_CONFIG_ALLOWLIST) {
          if (key in configParsed.data) {
            configValues[key] = configParsed.data[key];
          }
        }
        const reportedKeys = Object.keys(configValues);
        ev.push(
          EvidenceBuilder.observed(
            'postgres.config',
            reportedKeys.length > 0
              ? `config keys observed: ${reportedKeys.map((k) => `${k}=${configValues[k as DbConfigKey]}`).join(', ')}`
              : `config endpoint reachable but allowlisted keys not present in response`,
            SOURCE,
          ),
        );
      } else {
        ev.push(
          EvidenceBuilder.observed(
            'postgres.config',
            `NOT CONNECTED — config endpoint returned unexpected shape: ${configParsed.error.issues[0]?.message ?? 'parse error'}`,
            SOURCE,
          ),
        );
      }
    } catch (e) {
      ev.push(
        EvidenceBuilder.observed(
          'postgres.config',
          `NOT CONNECTED — config endpoint fetch failed: ${e instanceof Error ? e.message : String(e)}`,
          SOURCE,
        ),
      );
    }

    // Live query stats / connection counts are NOT CONNECTED — they require
    // pg_stat_activity via direct SQL (not exposed over the Management GET API).
    ev.push(
      EvidenceBuilder.observed(
        'postgres.live-stats',
        'NOT CONNECTED — live connection counts and query statistics require pg_stat_activity via direct SQL, not available via Supabase Management API GET endpoints',
        SOURCE,
      ),
    );

    // ── Normalise facts for CorrelationEngine ─────────────────────────────────
    const facts: LiveFact[] = [];

    // db-project fact
    facts.push({
      adapter: 'postgres',
      kind: 'db-project',
      subject: project.name,
      detail: `Supabase project "${project.name}" (ref=${ref}${project.region ? `, region=${project.region}` : ''}${project.db_version ? `, db_version=${project.db_version}` : ''})`,
      at: project.created_at ?? null,
      evidence: [
        EvidenceBuilder.observed(
          `postgres.project.${ref}`,
          `name=${project.name}${project.status ? ` status=${project.status}` : ''}`,
          SOURCE,
        ),
      ],
    });

    // db-health facts (one per service entry)
    for (const svc of health) {
      facts.push({
        adapter: 'postgres',
        kind: 'db-health',
        subject: 'db',
        detail: `Service "${svc.name}" status=${svc.status}`,
        at: new Date(this.now()).toISOString(),
        evidence: [
          EvidenceBuilder.observed(
            `postgres.health.${svc.name}`,
            `status=${svc.status}`,
            SOURCE,
          ),
        ],
      });
    }

    // db-config facts for allowlisted keys
    for (const key of DB_CONFIG_ALLOWLIST) {
      if (key in configValues) {
        facts.push({
          adapter: 'postgres',
          kind: 'db-config',
          subject: key,
          detail: `Postgres config ${key}=${configValues[key]}`,
          at: new Date(this.now()).toISOString(),
          evidence: [
            EvidenceBuilder.observed(
              `postgres.config.${key}`,
              `${key}=${configValues[key]}`,
              SOURCE,
            ),
          ],
        });
      }
    }

    const payload: PostgresPayload = {
      project,
      health,
      healthConnected,
      configValues,
      configConnected,
      facts,
    };

    return {
      payload,
      evidence: ev,
      // 0.85: health/config may be absent; only first-page of data; live stats NOT CONNECTED.
      confidence: 0.85,
    };
  }

  // ── Checks ────────────────────────────────────────────────────────────────────

  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
    const p = payload as PostgresPayload;
    const findings: VerificationFinding[] = [];

    // ── db-unhealthy: any service entry with a non-healthy status (critical) ──
    const unhealthyServices = p.health.filter((svc) => !HEALTHY_STATUSES.has(svc.status));
    for (const svc of unhealthyServices) {
      findings.push({
        kind: 'db-unhealthy',
        severity: 'critical',
        subject: 'db',
        detail: `Database service "${svc.name}" is in unhealthy state: status=${svc.status}. Immediate investigation required.`,
        evidence: [
          EvidenceBuilder.observed(
            `postgres.health.${svc.name}`,
            `status=${svc.status} (expected one of: ACTIVE_HEALTHY, healthy, ok)`,
            SOURCE,
          ),
        ],
      });
    }

    // ── db-config-inventory: info summary of observed config keys ────────────
    const observedKeys = DB_CONFIG_ALLOWLIST.filter((k) => k in p.configValues);
    const summary =
      observedKeys.length > 0
        ? `Postgres config observed — ${observedKeys.map((k) => `${k}=${p.configValues[k]}`).join(', ')}.`
        : p.configConnected
          ? `Postgres config endpoint reachable but allowlisted keys (${DB_CONFIG_ALLOWLIST.join(', ')}) not present in response.`
          : `Postgres config NOT CONNECTED — config endpoint was unavailable.`;
    findings.push({
      kind: 'db-config-inventory',
      severity: 'info',
      subject: 'postgres-config',
      detail: summary,
      evidence: [
        EvidenceBuilder.observed(
          'postgres.config.summary',
          `configConnected=${p.configConnected} observedKeys=${observedKeys.join(',') || 'none'}`,
          SOURCE,
        ),
      ],
    });

    return findings;
  }

  protected snapshotTtlMs(): number {
    return 120_000; // 2 min — DB config/health changes infrequently
  }
}
