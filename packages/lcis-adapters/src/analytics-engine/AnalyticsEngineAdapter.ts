/**
 * AnalyticsEngineAdapter — READ-ONLY observer of Cloudflare Analytics Engine dataset bindings.
 *
 * Reads:
 *  - /accounts/{acct}/workers/scripts          — list of Worker scripts (probe + gather)
 *  - /accounts/{acct}/workers/scripts/{id}/settings — per-script bindings (tolerate per-script failure)
 *
 * Extracts bindings where type === 'analytics_engine' to discover which scripts
 * write to which AE datasets.
 *
 * HONESTY CONTRACT (stated here and in evidence):
 *  - Analytics Engine query VALUES (row counts, events, write rates, top queries) are
 *    structurally NOT CONNECTED from this adapter. The AE SQL API that can answer these
 *    questions is POST /accounts/{acct}/analytics_engine/sql — a POST-only endpoint.
 *    The LCAS boundary is GET-only; therefore values remain NOT CONNECTED with the
 *    exact source cited as 'Analytics Engine SQL API (POST /analytics_engine/sql)'.
 *  - Per-script settings failures are absorbed and cited in evidence rather than
 *    failing the whole gather.
 *  - Pagination beyond page 1 of /workers/scripts is NOT CONNECTED (API is paginated;
 *    only first page observed). Confidence is capped at 0.80 to reflect this.
 *
 * READ ONLY: all I/O via this.http.get(...). No mutation is possible.
 * Credentials via this.creds.value() go ONLY into outbound request headers.
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
  WorkerScriptsResponseSchema,
  WorkerScriptSettingsSchema,
  type AEBindingRecord,
  type AEDatasetRecord,
  type AnalyticsEnginePayload,
} from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';
const SOURCE = 'Cloudflare Analytics Engine';

/** Detail string cited whenever AE query values are requested. */
const AE_VALUES_NOT_CONNECTED =
  'Analytics Engine query values NOT CONNECTED — the AE SQL API (POST /analytics_engine/sql) is POST-only; the LCAS GET-only boundary cannot reach it. Wire a telemetry adapter with POST capability to observe event counts and metrics.';

export class AnalyticsEngineAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) {
    super(deps);
  }

  metadata(): AdapterMetadata {
    return {
      name: 'analytics-engine',
      displayName: 'Cloudflare Analytics Engine',
      requiredEnv: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
      capabilities: ['datasets', 'bindings'],
      sourceOfTruth: SOURCE,
    };
  }

  // ── Probe ─────────────────────────────────────────────────────────────────────

  protected async probe(): Promise<void> {
    const token = this.creds.value('CLOUDFLARE_API_TOKEN');
    const accountId = this.creds.value('CLOUDFLARE_ACCOUNT_ID');
    const raw = await this.http.get(`${CF_API}/accounts/${accountId}/workers/scripts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const parsed = WorkerScriptsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Cloudflare /workers/scripts: unexpected response shape — token may be invalid or account ID incorrect (${parsed.error.issues[0]?.message ?? 'parse error'})`,
      );
    }
    if (!parsed.data.success) {
      throw new Error(
        `Cloudflare /workers/scripts: API returned success=false — check CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID`,
      );
    }
  }

  // ── Gather ────────────────────────────────────────────────────────────────────

  protected async gather(): Promise<GatherResult> {
    const token = this.creds.value('CLOUDFLARE_API_TOKEN');
    const accountId = this.creds.value('CLOUDFLARE_ACCOUNT_ID');
    const headers = { Authorization: `Bearer ${token}` };
    const ev: Evidence[] = [];

    // ── Scripts list ──────────────────────────────────────────────────────────
    const scriptsRaw = await this.http.get(
      `${CF_API}/accounts/${accountId}/workers/scripts`,
      { headers },
    );
    const scriptsParsed = WorkerScriptsResponseSchema.safeParse(scriptsRaw);
    if (!scriptsParsed.success) {
      throw new Error(
        `Cloudflare /workers/scripts: invalid response shape — ${scriptsParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const scripts = scriptsParsed.data.result;
    const scriptIds = scripts.map((s) => s.id);

    ev.push(
      EvidenceBuilder.observed(
        'cf.workers.scripts',
        `${scripts.length} Worker script(s) observed — page 1 only; pagination beyond page 1 NOT CONNECTED`,
        SOURCE,
      ),
    );

    // ── Per-script settings (bindings) ────────────────────────────────────────
    const aeBindings: AEBindingRecord[] = [];
    const scriptStatuses: AnalyticsEnginePayload['scriptStatuses'][number][] = [];

    for (const script of scripts) {
      try {
        const settingsRaw = await this.http.get(
          `${CF_API}/accounts/${accountId}/workers/scripts/${encodeURIComponent(script.id)}/settings`,
          { headers },
        );
        const settingsParsed = WorkerScriptSettingsSchema.safeParse(settingsRaw);
        if (!settingsParsed.success) {
          scriptStatuses.push({
            scriptId: script.id,
            status: 'error',
            detail: `settings parse error: ${settingsParsed.error.issues[0]?.message ?? 'unknown'}`,
          });
          ev.push(
            EvidenceBuilder.observed(
              `cf.workers.scripts.${script.id}.settings`,
              `settings shape invalid for script "${script.id}" — bindings not observed`,
              SOURCE,
            ),
          );
          continue;
        }

        const bindings = settingsParsed.data.result?.bindings ?? [];
        const aeBindingsForScript = bindings.filter((b) => b.type === 'analytics_engine');

        for (const binding of aeBindingsForScript) {
          if (binding.dataset) {
            aeBindings.push({
              scriptId: script.id,
              bindingName: binding.name,
              dataset: binding.dataset,
            });
          }
        }

        scriptStatuses.push({
          scriptId: script.id,
          status: 'ok',
          detail: `${aeBindingsForScript.length} analytics_engine binding(s)`,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        scriptStatuses.push({
          scriptId: script.id,
          status: 'error',
          detail: `settings fetch failed: ${msg} — NOT CONNECTED`,
        });
        ev.push(
          EvidenceBuilder.observed(
            `cf.workers.scripts.${script.id}.settings`,
            `settings fetch error for script "${script.id}": ${msg} — NOT CONNECTED`,
            SOURCE,
          ),
        );
      }
    }

    // ── De-duplicate datasets ─────────────────────────────────────────────────
    const datasetMap = new Map<string, { boundScripts: Set<string>; bindingNames: Set<string> }>();
    for (const binding of aeBindings) {
      if (!datasetMap.has(binding.dataset)) {
        datasetMap.set(binding.dataset, { boundScripts: new Set(), bindingNames: new Set() });
      }
      const entry = datasetMap.get(binding.dataset)!;
      entry.boundScripts.add(binding.scriptId);
      entry.bindingNames.add(binding.bindingName);
    }

    const aeDatasets: AEDatasetRecord[] = Array.from(datasetMap.entries()).map(
      ([dataset, { boundScripts, bindingNames }]) => ({
        dataset,
        boundScripts: Array.from(boundScripts),
        bindingNames: Array.from(bindingNames),
      }),
    );

    ev.push(
      EvidenceBuilder.observed(
        'cf.analytics-engine.datasets',
        `${aeDatasets.length} Analytics Engine dataset(s) observed via binding inspection. ${AE_VALUES_NOT_CONNECTED}`,
        SOURCE,
      ),
    );

    // ── Normalise facts for CorrelationEngine ─────────────────────────────────
    const facts: LiveFact[] = [];
    const now = this.now();

    // ae-dataset facts
    for (const record of aeDatasets) {
      facts.push({
        adapter: 'analytics-engine',
        kind: 'ae-dataset',
        subject: record.dataset,
        detail: `Analytics Engine dataset "${record.dataset}" bound by script(s): ${record.boundScripts.join(', ')}. Query values NOT CONNECTED — ${AE_VALUES_NOT_CONNECTED}`,
        at: now,
        evidence: [
          EvidenceBuilder.observed(
            `cf.ae.dataset.${record.dataset}`,
            `bound scripts: ${record.boundScripts.join(', ')} | binding names: ${record.bindingNames.join(', ')}`,
            SOURCE,
          ),
        ],
      });
    }

    // ae-binding facts (one per unique script+binding combination)
    for (const binding of aeBindings) {
      facts.push({
        adapter: 'analytics-engine',
        kind: 'ae-binding',
        subject: `${binding.scriptId}/${binding.bindingName}`,
        detail: `Script "${binding.scriptId}" declares analytics_engine binding "${binding.bindingName}" → dataset "${binding.dataset}". Write values NOT CONNECTED — ${AE_VALUES_NOT_CONNECTED}`,
        at: now,
        evidence: [
          EvidenceBuilder.observed(
            `cf.ae.binding.${binding.scriptId}.${binding.bindingName}`,
            `dataset=${binding.dataset}`,
            SOURCE,
          ),
        ],
      });
    }

    const payload: AnalyticsEnginePayload = {
      scriptIds,
      scriptStatuses,
      aeBindings,
      aeDatasets,
      facts,
    };

    return {
      payload,
      evidence: ev,
      // 0.80: scripts list is paginated (only first page observed);
      // per-script settings may fail for some scripts; AE query values NOT CONNECTED.
      confidence: 0.80,
    };
  }

  // ── Checks ────────────────────────────────────────────────────────────────────

  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
    const p = payload as AnalyticsEnginePayload;
    const findings: VerificationFinding[] = [];

    // ── ae-no-datasets (info): zero AE bindings found across all scripts ──────
    if (p.aeDatasets.length === 0) {
      findings.push({
        kind: 'ae-no-datasets',
        severity: 'info',
        subject: 'analytics-engine',
        detail:
          `No Analytics Engine bindings were found in any of the ${p.scriptIds.length} Worker script(s) observed. ` +
          `Either no scripts use Analytics Engine, or the relevant scripts were not on page 1 of /workers/scripts (pagination beyond page 1 NOT CONNECTED).`,
        evidence: [
          EvidenceBuilder.observed(
            'cf.ae.bindings',
            `0 analytics_engine bindings found across ${p.scriptIds.length} script(s) — page 1 only`,
            SOURCE,
          ),
        ],
      });
    }

    // ── ae-inventory (info): summary of all observed datasets and bindings ────
    findings.push({
      kind: 'ae-inventory',
      severity: 'info',
      subject: 'analytics-engine',
      detail:
        `Analytics Engine inventory: ${p.scriptIds.length} Worker script(s) observed (page 1 only), ` +
        `${p.aeDatasets.length} AE dataset(s), ${p.aeBindings.length} AE binding(s). ` +
        `Datasets: ${p.aeDatasets.length > 0 ? p.aeDatasets.map((d) => d.dataset).join(', ') : 'none'}. ` +
        `Query values NOT CONNECTED — ${AE_VALUES_NOT_CONNECTED}`,
      evidence: [
        EvidenceBuilder.observed(
          'cf.ae.inventory',
          `scripts=${p.scriptIds.length} datasets=${p.aeDatasets.length} bindings=${p.aeBindings.length}`,
          SOURCE,
        ),
      ],
    });

    return findings;
  }

  protected snapshotTtlMs(): number {
    return 120_000; // 2 min — Worker topology changes infrequently
  }
}
