/**
 * WorkersAdapter — READ-ONLY deep observer of Cloudflare Workers scripts,
 * settings, bindings, and deployments.
 *
 * DISTINCT FROM CloudflareAdapter (src/cloudflare/): that adapter gives a
 * coarse inventory of Workers script names (id/etag/handlers) alongside
 * Queues/KV/R2/routes. This adapter goes deeper per-script: it reads
 * /workers/scripts/{name}/settings (bindings[], compatibility_date) and
 * /workers/scripts/{name}/deployments (deployment history). It does NOT
 * duplicate the coarse inventory from CloudflareAdapter — it enriches it.
 *
 * Reads (GET only):
 *  - /accounts/{acct}/workers/subdomain  — probe: confirms account has a
 *    Workers subdomain (lightweight connectivity check).
 *  - /accounts/{acct}/workers/scripts    — inventory: id, created_on, modified_on.
 *  - /accounts/{acct}/workers/scripts/{name}/settings — per-script: bindings[],
 *    compatibility_date.
 *  - /accounts/{acct}/workers/scripts/{name}/deployments — per-script:
 *    deployment history (first page only).
 *
 * Honesty contract:
 *  - Credentials absent → NOT_CONNECTED, names CLOUDFLARE_API_TOKEN and
 *    CLOUDFLARE_ACCOUNT_ID.
 *  - Per-script settings/deployment fetch failures are tolerated and reported
 *    as evidence; the script entry is still emitted with fetchError=true.
 *  - Deployment list is page 1 only — fuller history NOT CONNECTED (paginated API).
 *  - Confidence capped at 0.85: per-script errors may mean incomplete coverage.
 *
 * Fact kinds (distinct from cloudflare adapter):
 *  - 'worker-script'     subject=script name, at=modified_on
 *  - 'worker-binding'    subject="{scriptName}/{bindingName}", at=null
 *  - 'worker-deployment' subject=script name, at=created_on of latest deployment
 *
 * Checks:
 *  - 'worker-no-compat-date' (medium)  — compatibility_date absent on a script.
 *  - 'worker-stale'          (low)     — modified_on older than 30 days vs injected clock.
 *  - 'workers-inventory'     (info)    — summary count of all observed scripts.
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
  type WorkerScriptDetail,
  type WorkersPayload,
  WorkerDeploymentsResponseSchema,
  WorkerSettingsResponseSchema,
  WorkersScriptsResponseSchema,
  WorkersSubdomainProbeSchema,
} from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';
const SOURCE = 'Cloudflare Workers';

/** 30 days in milliseconds — stale threshold for modified_on. */
const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

export class WorkersAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) {
    super(deps);
  }

  metadata(): AdapterMetadata {
    return {
      name: 'workers',
      displayName: 'Cloudflare Workers (deep)',
      requiredEnv: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
      capabilities: ['script-settings', 'deployments', 'subdomain'],
      sourceOfTruth: SOURCE,
    };
  }

  // ── Probe ────────────────────────────────────────────────────────────────────

  protected async probe(): Promise<void> {
    const token = this.creds.value('CLOUDFLARE_API_TOKEN');
    const acct = this.creds.value('CLOUDFLARE_ACCOUNT_ID');
    const raw = await this.http.get(
      `${CF_API}/accounts/${acct}/workers/subdomain`,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    );
    const parsed = WorkersSubdomainProbeSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        'Cloudflare Workers subdomain endpoint: unexpected response shape — token or account ID may be invalid',
      );
    }
  }

  // ── Gather ────────────────────────────────────────────────────────────────────

  protected async gather(): Promise<GatherResult> {
    const token = this.creds.value('CLOUDFLARE_API_TOKEN');
    const acct = this.creds.value('CLOUDFLARE_ACCOUNT_ID');
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    const ev: Evidence[] = [];

    // ── Subdomain (probe-level info for payload) ──────────────────────────────
    let subdomainActive = false;
    try {
      const sdRaw = await this.http.get(
        `${CF_API}/accounts/${acct}/workers/subdomain`,
        { headers },
      );
      const sdParsed = WorkersSubdomainProbeSchema.safeParse(sdRaw);
      subdomainActive = sdParsed.success && sdParsed.data.success === true;
    } catch {
      subdomainActive = false;
      ev.push(
        EvidenceBuilder.observed(
          'workers.subdomain',
          'workers/subdomain fetch error — subdomain status NOT CONNECTED',
          SOURCE,
        ),
      );
    }

    // ── Scripts list ─────────────────────────────────────────────────────────
    const scriptsRaw = await this.http.get(
      `${CF_API}/accounts/${acct}/workers/scripts`,
      { headers },
    );
    const scriptsParsed = WorkersScriptsResponseSchema.safeParse(scriptsRaw);
    if (!scriptsParsed.success) {
      throw new Error(
        `Cloudflare /workers/scripts: invalid response shape — ${
          scriptsParsed.error.issues[0]?.message ?? 'parse error'
        }`,
      );
    }
    const scriptItems = scriptsParsed.data.result ?? [];
    ev.push(
      EvidenceBuilder.observed(
        'workers.scripts',
        `${scriptItems.length} script(s) observed`,
        SOURCE,
      ),
    );

    // ── Per-script: settings + deployments ───────────────────────────────────
    const scripts: WorkerScriptDetail[] = [];
    const facts: LiveFact[] = [];

    for (const item of scriptItems) {
      const name = item.id;
      let bindings: WorkerScriptDetail['bindings'] = [];
      let compatibilityDate: string | null = null;
      let latestDeploymentId: string | null = null;
      let latestDeploymentAt: string | null = null;
      let fetchError = false;
      let fetchErrorDetail: string | null = null;

      // Settings
      try {
        const settingsRaw = await this.http.get(
          `${CF_API}/accounts/${acct}/workers/scripts/${encodeURIComponent(name)}/settings`,
          { headers },
        );
        const settingsParsed = WorkerSettingsResponseSchema.safeParse(settingsRaw);
        if (!settingsParsed.success) {
          fetchError = true;
          fetchErrorDetail = `settings parse error: ${settingsParsed.error.issues[0]?.message ?? 'unknown'}`;
          ev.push(
            EvidenceBuilder.observed(
              `workers.scripts.${name}.settings`,
              `settings parse error for script "${name}" — ${fetchErrorDetail}`,
              SOURCE,
            ),
          );
        } else {
          const result = settingsParsed.data.result;
          bindings = result?.bindings ?? [];
          compatibilityDate = result?.compatibility_date ?? null;
        }
      } catch (e) {
        fetchError = true;
        fetchErrorDetail = `settings fetch error: ${e instanceof Error ? e.message : String(e)}`;
        ev.push(
          EvidenceBuilder.observed(
            `workers.scripts.${name}.settings`,
            `settings NOT CONNECTED for script "${name}" — ${fetchErrorDetail}`,
            SOURCE,
          ),
        );
      }

      // Deployments (only if settings fetch did not fail entirely — we still try)
      try {
        const deploymentsRaw = await this.http.get(
          `${CF_API}/accounts/${acct}/workers/scripts/${encodeURIComponent(name)}/deployments`,
          { headers },
        );
        const deploymentsParsed = WorkerDeploymentsResponseSchema.safeParse(deploymentsRaw);
        if (deploymentsParsed.success) {
          const list = deploymentsParsed.data.result ?? [];
          // Take most-recent (first in list, or sort by created_on when present)
          const sorted = [...list].sort((a, b) => {
            const ta = a.created_on ? new Date(a.created_on).getTime() : 0;
            const tb = b.created_on ? new Date(b.created_on).getTime() : 0;
            return tb - ta;
          });
          const latest = sorted[0];
          latestDeploymentId = latest?.id ?? null;
          latestDeploymentAt = latest?.created_on ?? null;
          if (list.length > 1) {
            ev.push(
              EvidenceBuilder.observed(
                `workers.scripts.${name}.deployments`,
                `${list.length} deployment(s) observed — page 1 only; full history NOT CONNECTED (paginated API)`,
                SOURCE,
              ),
            );
          }
        } else {
          // Parse failure: tolerate, mark in evidence
          ev.push(
            EvidenceBuilder.observed(
              `workers.scripts.${name}.deployments`,
              `deployments parse error for script "${name}" — ${deploymentsParsed.error.issues[0]?.message ?? 'unknown'}`,
              SOURCE,
            ),
          );
          // Don't override fetchError if settings already failed
          if (!fetchError) {
            fetchError = true;
            fetchErrorDetail = `deployments parse error: ${deploymentsParsed.error.issues[0]?.message ?? 'unknown'}`;
          }
        }
      } catch (e) {
        ev.push(
          EvidenceBuilder.observed(
            `workers.scripts.${name}.deployments`,
            `deployments NOT CONNECTED for script "${name}" — ${e instanceof Error ? e.message : String(e)}`,
            SOURCE,
          ),
        );
        if (!fetchError) {
          fetchError = true;
          fetchErrorDetail = `deployments fetch error: ${e instanceof Error ? e.message : String(e)}`;
        }
      }

      const detail: WorkerScriptDetail = {
        name,
        createdOn: item.created_on ?? null,
        modifiedOn: item.modified_on ?? null,
        bindings,
        compatibilityDate,
        latestDeploymentId,
        latestDeploymentAt,
        fetchError,
        fetchErrorDetail,
      };
      scripts.push(detail);

      // ── Emit facts ─────────────────────────────────────────────────────────

      // worker-script fact
      facts.push({
        adapter: 'workers',
        kind: 'worker-script',
        subject: name,
        detail: `Cloudflare Worker script "${name}"${
          compatibilityDate ? ` compat=${compatibilityDate}` : ' (no compatibility_date)'
        }${fetchError ? ` — ${fetchErrorDetail}` : ''}`,
        at: item.modified_on ?? null,
        evidence: [
          EvidenceBuilder.observed(
            `workers.script.${name}`,
            `id=${name} modified_on=${item.modified_on ?? 'unknown'}`,
            SOURCE,
          ),
        ],
      });

      // worker-binding facts (one per binding)
      for (const binding of bindings) {
        facts.push({
          adapter: 'workers',
          kind: 'worker-binding',
          subject: `${name}/${binding.name}`,
          detail: `Binding "${binding.name}" (type=${binding.type}) on Worker "${name}"`,
          at: null,
          evidence: [
            EvidenceBuilder.observed(
              `workers.binding.${name}.${binding.name}`,
              `type=${binding.type}`,
              SOURCE,
            ),
          ],
        });
      }

      // worker-deployment fact (only if we have a deployment)
      if (latestDeploymentAt !== null || latestDeploymentId !== null) {
        facts.push({
          adapter: 'workers',
          kind: 'worker-deployment',
          subject: name,
          detail: `Latest deployment of Worker "${name}"${
            latestDeploymentId ? ` id=${latestDeploymentId}` : ''
          }${latestDeploymentAt ? ` at=${latestDeploymentAt}` : ''}`,
          at: latestDeploymentAt,
          evidence: [
            EvidenceBuilder.observed(
              `workers.deployment.${name}`,
              `deploymentId=${latestDeploymentId ?? 'unknown'} at=${latestDeploymentAt ?? 'unknown'}`,
              SOURCE,
            ),
          ],
        });
      }
    }

    const payload: WorkersPayload = {
      scripts,
      scriptCount: scripts.length,
      subdomainActive,
      facts,
    };

    return {
      payload,
      evidence: ev,
      // 0.85: per-script errors may leave some scripts without full detail;
      // deployment list is page 1 only.
      confidence: 0.85,
    };
  }

  // ── Checks ────────────────────────────────────────────────────────────────────

  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
    const p = payload as WorkersPayload;
    const findings: VerificationFinding[] = [];
    // Injected clock — never wall-clock, so staleness is deterministic in tests.
    const now = new Date(this.now()).getTime();

    for (const script of p.scripts) {
      // ── worker-no-compat-date (medium) ──────────────────────────────────────
      if (!script.fetchError && script.compatibilityDate === null) {
        findings.push({
          kind: 'worker-no-compat-date',
          severity: 'medium',
          subject: script.name,
          detail: `Worker "${script.name}" has no compatibility_date set. Cloudflare may apply breaking behaviour changes on your behalf.`,
          evidence: [
            EvidenceBuilder.observed(
              `workers.script.${script.name}`,
              'compatibility_date=null',
              SOURCE,
            ),
          ],
        });
      }

      // ── worker-stale (low) ─────────────────────────────────────────────────
      if (script.modifiedOn !== null) {
        const modifiedMs = new Date(script.modifiedOn).getTime();
        if (!Number.isNaN(modifiedMs) && now - modifiedMs > STALE_THRESHOLD_MS) {
          findings.push({
            kind: 'worker-stale',
            severity: 'low',
            subject: script.name,
            detail: `Worker "${script.name}" modified_on ${script.modifiedOn} — over 30 days ago. Consider whether this is intentional.`,
            evidence: [
              EvidenceBuilder.observed(
                `workers.script.${script.name}`,
                `modified_on=${script.modifiedOn}`,
                SOURCE,
              ),
            ],
          });
        }
      }
    }

    // ── workers-inventory (info) ─────────────────────────────────────────────
    findings.push({
      kind: 'workers-inventory',
      severity: 'info',
      subject: 'cloudflare-workers',
      detail: `${p.scriptCount} Cloudflare Worker script(s) observed${
        p.scripts.length > 0
          ? ': ' + p.scripts.map((s) => s.name).join(', ')
          : '.'
      }.`,
      evidence: [
        EvidenceBuilder.observed(
          'workers.scripts',
          `${p.scriptCount} script(s)`,
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
