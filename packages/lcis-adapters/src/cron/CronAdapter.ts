/**
 * CronAdapter — READ-ONLY observer of Cloudflare Workers Cron Triggers.
 *
 * Reads: worker scripts list, per-script schedule entries.
 * Uses the injected ReadOnlyHttpClient (GET only).
 * No mutation is possible — the interface exposes only this.http.get(...).
 *
 * Honesty contract:
 *  - Credentials absent → NOT_CONNECTED, names CLOUDFLARE_API_TOKEN and
 *    CLOUDFLARE_ACCOUNT_ID exactly.
 *  - Per-script schedule fetch failures are absorbed with honest evidence;
 *    they do not abort the whole gather.
 *  - Last-run results (execution logs, success/failure status of individual
 *    cron invocations) are NOT CONNECTED — they require Cloudflare Workers
 *    Logpush / Analytics Engine and separate credentials not covered here.
 *  - Confidence capped at 0.85 (scripts list is page-1 only; per-script
 *    failures reduce coverage further).
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
  CfScriptsResponseSchema,
  CfSchedulesResponseSchema,
  type CfWorkerScript,
  type CfScheduleEntry,
  type CronPayload,
  type CronScriptSchedules,
} from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';
const SOURCE = 'Cloudflare Workers Cron';

/**
 * Normalise a Cloudflare result field into a flat schedule array.
 * Tolerates both { schedules: [...] } and [...] shapes.
 */
function extractSchedules(result: unknown): CfScheduleEntry[] {
  if (Array.isArray(result)) return result as CfScheduleEntry[];
  if (result !== null && typeof result === 'object' && 'schedules' in result) {
    const inner = (result as { schedules: unknown }).schedules;
    if (Array.isArray(inner)) return inner as CfScheduleEntry[];
  }
  return [];
}

export class CronAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) {
    super(deps);
  }

  metadata(): AdapterMetadata {
    return {
      name: 'cron',
      displayName: 'Cloudflare Cron Triggers',
      requiredEnv: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
      capabilities: ['schedules'],
      sourceOfTruth: SOURCE,
    };
  }

  // ── Probe ──────────────────────────────────────────────────────────────────

  protected async probe(): Promise<void> {
    const token = this.creds.value('CLOUDFLARE_API_TOKEN');
    const acct = this.creds.value('CLOUDFLARE_ACCOUNT_ID');
    const raw = await this.http.get(
      `${CF_API}/accounts/${encodeURIComponent(acct ?? '')}/workers/scripts`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const parsed = CfScriptsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Cloudflare /workers/scripts: unexpected response shape — token or account may be invalid (${parsed.error.issues[0]?.message ?? 'parse error'})`,
      );
    }
    if (!parsed.data.success) {
      throw new Error(
        `Cloudflare /workers/scripts: API returned success=false`,
      );
    }
  }

  // ── Gather ─────────────────────────────────────────────────────────────────

  protected async gather(): Promise<GatherResult> {
    const token = this.creds.value('CLOUDFLARE_API_TOKEN');
    const acct = this.creds.value('CLOUDFLARE_ACCOUNT_ID');
    const headers = { Authorization: `Bearer ${token}` };
    const ev: Evidence[] = [];

    // ── Scripts list ─────────────────────────────────────────────────────────
    const scriptsRaw = await this.http.get(
      `${CF_API}/accounts/${encodeURIComponent(acct ?? '')}/workers/scripts`,
      { headers },
    );
    const scriptsParsed = CfScriptsResponseSchema.safeParse(scriptsRaw);
    if (!scriptsParsed.success) {
      throw new Error(
        `Cloudflare /workers/scripts: invalid response shape — ${scriptsParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const scripts: CfWorkerScript[] = scriptsParsed.data.result;
    ev.push(
      EvidenceBuilder.observed(
        'cron.scripts',
        `${scripts.length} worker script(s) observed — page 1 only; full list NOT CONNECTED (paginated API)`,
        SOURCE,
      ),
    );

    // ── Per-script schedules ──────────────────────────────────────────────────
    const schedulesByScript: CronScriptSchedules[] = [];

    for (const script of scripts) {
      try {
        const schedRaw = await this.http.get(
          `${CF_API}/accounts/${encodeURIComponent(acct ?? '')}/workers/scripts/${encodeURIComponent(script.id)}/schedules`,
          { headers },
        );
        const schedParsed = CfSchedulesResponseSchema.safeParse(schedRaw);
        if (!schedParsed.success) {
          // Shape mismatch for this script — record honestly, continue.
          schedulesByScript.push({
            scriptName: script.id,
            schedules: [],
            fetched: false,
            fetchError: `unexpected response shape: ${schedParsed.error.issues[0]?.message ?? 'parse error'}`,
          });
          ev.push(
            EvidenceBuilder.observed(
              `cron.schedules.${script.id}`,
              `schedule parse error for script "${script.id}" — skipped`,
              SOURCE,
            ),
          );
          continue;
        }
        const schedules = extractSchedules(schedParsed.data.result);
        schedulesByScript.push({ scriptName: script.id, schedules, fetched: true });
        ev.push(
          EvidenceBuilder.observed(
            `cron.schedules.${script.id}`,
            `${schedules.length} schedule(s) for script "${script.id}"`,
            SOURCE,
          ),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        schedulesByScript.push({
          scriptName: script.id,
          schedules: [],
          fetched: false,
          fetchError: msg,
        });
        ev.push(
          EvidenceBuilder.observed(
            `cron.schedules.${script.id}`,
            `schedule fetch error for script "${script.id}" — NOT CONNECTED (${msg})`,
            SOURCE,
          ),
        );
      }
    }

    // ── Flat schedule list ────────────────────────────────────────────────────
    const allSchedules: Array<{ scriptName: string; cron: string; at: string | null }> = [];
    for (const ss of schedulesByScript) {
      for (const sched of ss.schedules) {
        allSchedules.push({
          scriptName: ss.scriptName,
          cron: sched.cron,
          at: sched.created_on ?? sched.modified_on ?? null,
        });
      }
    }

    ev.push(
      EvidenceBuilder.observed(
        'cron.all-schedules',
        `${allSchedules.length} total schedule(s) across ${scripts.length} script(s)`,
        SOURCE,
      ),
    );
    ev.push(
      EvidenceBuilder.observed(
        'cron.last-run',
        `Last-run results NOT CONNECTED — requires Cloudflare Workers Logpush or Analytics Engine (separate credentials)`,
        SOURCE,
      ),
    );

    // ── Normalise LiveFacts ───────────────────────────────────────────────────
    const facts: LiveFact[] = [];

    for (const { scriptName, cron, at } of allSchedules) {
      facts.push({
        adapter: 'cron',
        kind: 'cron-schedule',
        subject: scriptName,
        detail: `Cron schedule "${cron}" on worker script "${scriptName}"`,
        at,
        evidence: [
          EvidenceBuilder.observed(
            `cron.schedule.${scriptName}`,
            `cron=${cron}`,
            SOURCE,
          ),
        ],
      });
    }

    const payload: CronPayload = { scripts, schedulesByScript, allSchedules, facts };

    return {
      payload,
      evidence: ev,
      // 0.85: scripts list is page-1 only; per-script schedule fetches may fail
      confidence: 0.85,
    };
  }

  // ── Checks ─────────────────────────────────────────────────────────────────

  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
    const p = payload as CronPayload;
    const findings: VerificationFinding[] = [];

    // ── cron-none: no script has any schedule (info) ─────────────────────────
    const totalSchedules = p.allSchedules.length;
    if (totalSchedules === 0) {
      findings.push({
        kind: 'cron-none',
        severity: 'info',
        subject: 'cron',
        detail:
          `No cron schedules found across ${p.scripts.length} worker script(s). ` +
          `If periodic jobs are expected (queue drains, cache refreshes, etc.) this may be a configuration gap.`,
        evidence: [
          EvidenceBuilder.observed(
            'cron.all-schedules',
            `0 schedules across ${p.scripts.length} scripts`,
            SOURCE,
          ),
        ],
      });
    }

    // ── cron-duplicate: two DIFFERENT scripts share an identical cron expr (medium) ─
    // Group by cron expression; flag when multiple distinct scripts share the same cron.
    const cronToScripts = new Map<string, Set<string>>();
    for (const { scriptName, cron } of p.allSchedules) {
      const existing = cronToScripts.get(cron);
      if (existing) {
        existing.add(scriptName);
      } else {
        cronToScripts.set(cron, new Set([scriptName]));
      }
    }
    for (const [cron, scriptNames] of cronToScripts) {
      if (scriptNames.size > 1) {
        const names = Array.from(scriptNames).sort();
        findings.push({
          kind: 'cron-duplicate',
          severity: 'medium',
          subject: cron,
          detail:
            `Cron expression "${cron}" is shared by ${scriptNames.size} different scripts: ` +
            `${names.join(', ')}. Duplicate schedules may cause redundant work or race conditions.`,
          evidence: names.map((n) =>
            EvidenceBuilder.observed(
              `cron.schedule.${n}`,
              `script="${n}" cron="${cron}"`,
              SOURCE,
            ),
          ),
        });
      }
    }

    // ── cron-inventory: info summary of observed schedules ────────────────────
    const scheduledScripts = p.schedulesByScript.filter((ss) => ss.schedules.length > 0);
    findings.push({
      kind: 'cron-inventory',
      severity: 'info',
      subject: 'cron',
      detail:
        `${totalSchedules} cron schedule(s) across ${scheduledScripts.length} of ${p.scripts.length} script(s). ` +
        `Last-run results NOT CONNECTED — requires Cloudflare Workers Logpush or Analytics Engine.`,
      evidence: [
        EvidenceBuilder.observed(
          'cron.all-schedules',
          `${totalSchedules} schedule(s) in ${scheduledScripts.length}/${p.scripts.length} scripts`,
          SOURCE,
        ),
      ],
    });

    return findings;
  }

  protected snapshotTtlMs(): number {
    return 120_000; // 2 min — schedule topology changes infrequently
  }
}
