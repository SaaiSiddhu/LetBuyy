/**
 * AdapterBase — implements the LiveAdapter contract with the honesty model baked in:
 *  - credentials absent  → NOT_CONNECTED + the exact missing env vars (never fabricates)
 *  - credentials present  → read-only probe / gather / checks, timed and evidence-cited
 * Subclasses implement only metadata()/probe()/gather()/checks(); they never see a write path.
 */
import { type Evidence, Timer, evidence, notConnected } from '@letbuyy/lcis-core';
import type {
  AdapterMetadata,
  AdapterSnapshot,
  AdapterVerification,
  HealthResult,
  LiveAdapter,
  VerificationFinding,
} from './contracts';
import { CredentialProvider } from './credentials';
import type { ReadOnlyHttpClient } from './http';

export interface AdapterDeps {
  readonly creds?: CredentialProvider;
  readonly http: ReadOnlyHttpClient;
  /** Injectable clock for deterministic tests. */
  readonly now?: () => string;
}

export interface GatherResult {
  readonly payload: unknown;
  readonly evidence: readonly Evidence[];
  readonly confidence: number;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export abstract class AdapterBase implements LiveAdapter {
  protected readonly creds: CredentialProvider;
  protected readonly http: ReadOnlyHttpClient;
  protected readonly now: () => string;

  constructor(deps: AdapterDeps) {
    this.creds = deps.creds ?? new CredentialProvider();
    this.http = deps.http;
    this.now = deps.now ?? (() => new Date().toISOString());
  }

  abstract metadata(): AdapterMetadata;
  /** Lightweight read probe (only invoked when credentials present). Throws on failure. */
  protected abstract probe(): Promise<void>;
  /** Read + normalise facts (only invoked when credentials present). */
  protected abstract gather(): Promise<GatherResult>;
  /** Deterministic checks over a gathered payload. */
  protected abstract checks(payload: unknown): Promise<readonly VerificationFinding[]>;
  protected snapshotTtlMs(): number {
    return 60_000;
  }

  async health(): Promise<HealthResult> {
    const md = this.metadata();
    const presence = this.creds.check(md.requiredEnv);
    const checkedAt = this.now();
    if (!presence.present) {
      return {
        adapter: md.name,
        status: 'NOT_CONNECTED',
        latencyMs: null,
        missingEnvVars: presence.missing,
        checkedAt,
        evidence: presence.missing.map((v) => notConnected(md.name, v)),
        detail: `NOT CONNECTED — set ${presence.missing.join(', ')} to enable ${md.displayName}.`,
      };
    }
    const t = new Timer();
    try {
      await this.probe();
      return {
        adapter: md.name,
        status: 'CONNECTED',
        latencyMs: t.ms(),
        missingEnvVars: [],
        checkedAt,
        evidence: [evidence('artifact-field', `${md.name}.probe`, 'read probe ok', md.sourceOfTruth)],
        detail: `${md.displayName} reachable.`,
      };
    } catch (e) {
      return {
        adapter: md.name,
        status: 'ERROR',
        latencyMs: t.ms(),
        missingEnvVars: [],
        checkedAt,
        evidence: [evidence('artifact-field', `${md.name}.probe`, errMsg(e), md.sourceOfTruth)],
        detail: `${md.displayName} probe failed: ${errMsg(e)}`,
      };
    }
  }

  async collect(): Promise<AdapterSnapshot> {
    const md = this.metadata();
    const presence = this.creds.check(md.requiredEnv);
    const timestamp = this.now();
    if (!presence.present) {
      return {
        adapter: md.name,
        source: md.sourceOfTruth,
        timestamp,
        status: 'NOT_CONNECTED',
        confidence: 0,
        evidence: presence.missing.map((v) => notConnected(md.name, v)),
        payload: {},
        ttlMs: this.snapshotTtlMs(),
      };
    }
    try {
      const g = await this.gather();
      return {
        adapter: md.name,
        source: md.sourceOfTruth,
        timestamp,
        status: 'CONNECTED',
        confidence: Math.min(g.confidence, 0.95),
        evidence: g.evidence,
        payload: g.payload,
        ttlMs: this.snapshotTtlMs(),
      };
    } catch (e) {
      return {
        adapter: md.name,
        source: md.sourceOfTruth,
        timestamp,
        status: 'ERROR',
        confidence: 0,
        evidence: [evidence('artifact-field', `${md.name}.collect`, errMsg(e), md.sourceOfTruth)],
        payload: {},
        ttlMs: this.snapshotTtlMs(),
      };
    }
  }

  async verify(): Promise<AdapterVerification> {
    const md = this.metadata();
    const snap = await this.collect();
    const checkedAt = this.now();
    if (snap.status !== 'CONNECTED') {
      return { adapter: md.name, status: snap.status, findings: [], checkedAt, evidence: snap.evidence };
    }
    const findings = await this.checks(snap.payload);
    return {
      adapter: md.name,
      status: 'CONNECTED',
      findings,
      checkedAt,
      evidence: [evidence('artifact-field', `${md.name}.verify`, `${findings.length} finding(s)`, md.sourceOfTruth)],
    };
  }
}
