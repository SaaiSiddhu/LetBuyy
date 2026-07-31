/**
 * RedisAdapter — READ-ONLY observer of Redis via the Upstash REST API.
 *
 * Reads: PING (probe), DBSIZE (gather).
 * Uses the injected ReadOnlyHttpClient (GET only).
 * No mutation is possible — the interface exposes only this.http.get(...)
 * and the readCommand() method enforces an explicit allowlist.
 *
 * Honesty contract:
 *  - Credentials absent → NOT_CONNECTED, names UPSTASH_REDIS_REST_URL and
 *    UPSTASH_REDIS_REST_TOKEN.
 *  - Memory usage / hit-ratio / keyspace statistics NOT CONNECTED: the INFO
 *    command is not allowlisted — its response is unbounded free-text and
 *    requires a POST-based Upstash pipeline API which is outside this
 *    read-only adapter's scope.
 *  - Confidence capped at 0.85: only DBSIZE is observed; key-type breakdown,
 *    memory usage, and eviction policy are not read.
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
  RedisPingResponseSchema,
  RedisDbSizeResponseSchema,
  type RedisPayload,
} from './types';

const SOURCE = 'Upstash Redis';

/**
 * The only commands this adapter is permitted to call via the Upstash REST API.
 * This list is the structural write-guard: readCommand() throws for anything
 * outside it, making it impossible to accidentally call a mutating command.
 */
const READ_ONLY_COMMANDS = ['ping', 'dbsize'] as const;
type ReadOnlyCommand = (typeof READ_ONLY_COMMANDS)[number];

export class RedisAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) {
    super(deps);
  }

  metadata(): AdapterMetadata {
    return {
      name: 'redis',
      displayName: 'Redis (Upstash REST)',
      requiredEnv: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
      capabilities: ['dbsize', 'ping'],
      sourceOfTruth: SOURCE,
    };
  }

  // ── Read-only command guard ────────────────────────────────────────────────

  /**
   * Constructs the Upstash REST URL for a given command and asserts it is in
   * the READ_ONLY_COMMANDS allowlist. Throws a descriptive error for any
   * command not in the list — this is the structural write-guard that makes
   * mutation unrepresentable via this adapter.
   */
  private readCommand(cmd: string): string {
    if (!(READ_ONLY_COMMANDS as readonly string[]).includes(cmd)) {
      throw new Error(
        `RedisAdapter: command "${cmd}" is not in the read-only allowlist [${READ_ONLY_COMMANDS.join(', ')}]. ` +
          'Only read-only introspection commands are permitted.',
      );
    }
    const base = this.creds.value('UPSTASH_REDIS_REST_URL');
    return `${base}/${cmd}`;
  }

  // ── Probe ─────────────────────────────────────────────────────────────────

  protected async probe(): Promise<void> {
    const token = this.creds.value('UPSTASH_REDIS_REST_TOKEN');
    const url = this.readCommand('ping');
    const raw = await this.http.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const parsed = RedisPingResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Redis PING: unexpected response shape — ${parsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    if (parsed.data.result !== 'PONG') {
      throw new Error(
        `Redis PING: expected result "PONG", got "${parsed.data.result}"`,
      );
    }
  }

  // ── Gather ────────────────────────────────────────────────────────────────

  protected async gather(): Promise<GatherResult> {
    const token = this.creds.value('UPSTASH_REDIS_REST_TOKEN');
    const headers = { Authorization: `Bearer ${token}` };
    const ev: Evidence[] = [];

    // ── DBSIZE ───────────────────────────────────────────────────────────────
    const dbSizeUrl = this.readCommand('dbsize');
    const dbSizeRaw = await this.http.get(dbSizeUrl, { headers });
    const dbSizeParsed = RedisDbSizeResponseSchema.safeParse(dbSizeRaw);
    if (!dbSizeParsed.success) {
      throw new Error(
        `Redis DBSIZE: invalid response shape — ${dbSizeParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const dbSize = dbSizeParsed.data.result;
    ev.push(
      EvidenceBuilder.observed('redis.dbsize', `${dbSize} key(s) in database`, SOURCE),
    );

    // ── Memory / hit-ratio: honestly NOT CONNECTED ─────────────────────────
    const memoryNotConnected =
      'NOT CONNECTED — memory usage and hit-ratio require the INFO command, ' +
      'which is not in the read-only allowlist (unbounded free-text response; ' +
      'requires POST-based Upstash pipeline API). ' +
      'Source: Upstash Redis INFO command via UPSTASH_REDIS_REST_URL.';
    ev.push(
      EvidenceBuilder.observed(
        'redis.memory',
        memoryNotConnected,
        SOURCE,
      ),
    );

    // ── Normalise facts ───────────────────────────────────────────────────
    const now = this.now();
    const facts: LiveFact[] = [
      {
        adapter: 'redis',
        kind: 'cache-size',
        subject: 'redis',
        detail: `${dbSize} keys`,
        at: now,
        evidence: [
          EvidenceBuilder.observed('redis.dbsize', `${dbSize} key(s)`, SOURCE),
        ],
      },
    ];

    const payload: RedisPayload = { dbSize, facts, memoryNotConnected };

    return {
      payload,
      evidence: ev,
      // 0.85: only DBSIZE observed; memory, eviction policy, key-type breakdown
      // are NOT CONNECTED (INFO not allowlisted).
      confidence: 0.85,
    };
  }

  // ── Checks ────────────────────────────────────────────────────────────────

  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
    const p = payload as RedisPayload;
    const findings: VerificationFinding[] = [];

    // ── cache-empty: dbsize === 0 is noteworthy (info) ────────────────────
    if (p.dbSize === 0) {
      findings.push({
        kind: 'cache-empty',
        severity: 'info',
        subject: 'redis',
        detail:
          'Redis DBSIZE is 0 — the cache is empty. ' +
          'This is expected after a flush or on a freshly provisioned instance, ' +
          'but may indicate cache population is not running.',
        evidence: [
          EvidenceBuilder.observed('redis.dbsize', 'result=0', SOURCE),
        ],
      });
    }

    // ── cache-inventory: info summary of observed key count ───────────────
    findings.push({
      kind: 'cache-inventory',
      severity: 'info',
      subject: 'redis',
      detail:
        `Redis DBSIZE: ${p.dbSize} key(s) observed. ` +
        'Memory usage and hit-ratio NOT CONNECTED — INFO command not allowlisted ' +
        '(unbounded response; requires Upstash pipeline API).',
      evidence: [
        EvidenceBuilder.observed('redis.dbsize', `${p.dbSize} key(s)`, SOURCE),
      ],
    });

    return findings;
  }

  protected snapshotTtlMs(): number {
    return 30_000; // 30 s — key count can change frequently
  }
}
