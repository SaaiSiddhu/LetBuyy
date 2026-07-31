/**
 * TimelineBuilder — builds 4 investigation timelines:
 *   1. Incident Timeline   — detection/signal sequence
 *   2. Dependency Timeline — structural propagation order
 *   3. Deployment Timeline — real commits + deployment-state
 *   4. Impact Timeline     — cross-domain FK propagation order
 *
 * Live timestamps where unavailable → relative ordering + NOT CONNECTED note.
 * Every live value is honest: connected:false + source given.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const V1_BASE = 'http://localhost:3333';

// ─── lazy V2 imports (graceful; NOT CONNECTED if unavailable) ───────────────

let _signalCollector = null;
async function getSignalCollector() {
  if (_signalCollector) return _signalCollector;
  try {
    const m = await import('../correlation/SignalCollector.mjs');
    _signalCollector = m.default;
  } catch {
    _signalCollector = null;
  }
  return _signalCollector;
}

let _graphExplorer = null;
async function getGraphExplorer() {
  if (_graphExplorer) return _graphExplorer;
  try {
    const m = await import('../graph-engine/GraphExplorer.mjs');
    _graphExplorer = m.default;
  } catch {
    _graphExplorer = null;
  }
  return _graphExplorer;
}

let _driftDetector = null;
async function getDriftDetector() {
  if (_driftDetector) return _driftDetector;
  try {
    const m = await import('../architecture-intelligence/ArchitectureDriftDetector.mjs');
    _driftDetector = m.default;
  } catch {
    _driftDetector = null;
  }
  return _driftDetector;
}

// ─── V1 fetch helper ─────────────────────────────────────────────────────────

async function fetchV1(endpoint, timeout = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${V1_BASE}${endpoint}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, source: `${V1_BASE}${endpoint}` };
    return { ok: true, data: await res.json() };
  } catch {
    clearTimeout(timer);
    return { ok: false, source: `${V1_BASE}${endpoint}` };
  }
}

// ─── git log helper ──────────────────────────────────────────────────────────

function getRecentGitCommits(windowMs = 24 * 60 * 60 * 1000) {
  try {
    const since = new Date(Date.now() - windowMs).toISOString();
    const raw = execSync(
      `git -C "${REPO_ROOT}" log --since="${since}" --pretty=format:"%H|%ai|%an|%s" --no-merges`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
    if (!raw) return [];
    return raw.split('\n').map((line) => {
      const [hash, iso, author, ...subjectParts] = line.split('|');
      return { hash: hash?.trim(), iso: iso?.trim(), author: author?.trim(), subject: subjectParts.join('|').trim() };
    });
  } catch {
    return [];
  }
}

// ─── domain extraction ───────────────────────────────────────────────────────

function extractDomain(incident) {
  if (!incident) return 'unknown';
  return (
    incident.domain ||
    incident.component ||
    incident.service ||
    incident.subject ||
    (typeof incident === 'string' ? incident : 'unknown')
  );
}

// ─── TimelineEvent factory ────────────────────────────────────────────────────

function event(t, eventStr, source, connected, detail = {}) {
  return { t, event: eventStr, source, connected: !!connected, detail };
}

// ─── TimelineBuilder ─────────────────────────────────────────────────────────

class TimelineBuilder {
  /**
   * Build the incident timeline — ordered sequence of detection signals.
   * Live signal timestamps → NOT CONNECTED; structural ordering is real.
   */
  async buildIncidentTimeline(incident) {
    const domain = extractDomain(incident);
    const events = [];
    const now = new Date().toISOString();
    const notConnected = [];

    // 1. Detection marker (structural — always present)
    events.push(
      event('T+0', `Incident detected: domain=${domain}`, 'investigation-engine', true, {
        incident: typeof incident === 'object' ? incident : { domain },
      })
    );

    // 2. Signal collector (live signals — NOT CONNECTED until telemetry wired)
    const sc = await getSignalCollector();
    if (sc) {
      try {
        const [depSignals, anomalies] = await Promise.allSettled([
          sc.collectDependencySignals(domain),
          sc.collectAnomalies(),
        ]);
        const ds = depSignals.status === 'fulfilled' ? depSignals.value : [];
        const an = anomalies.status === 'fulfilled' ? anomalies.value : [];

        (ds || []).forEach((sig, i) => {
          events.push(
            event(
              `T+${(i + 1) * 30}s`,
              `Dependency signal: ${sig.type || 'signal'} on ${sig.component || domain}`,
              'SignalCollector.collectDependencySignals',
              false,
              sig
            )
          );
          notConnected.push({
            field: 'signal.timestamp',
            source: 'Cloudflare Analytics Engine / OTel',
            note: 'NOT CONNECTED — structural ordering only',
          });
        });

        (an || []).forEach((a, i) => {
          events.push(
            event(
              `T+${(i + 1) * 45}s`,
              `Anomaly detected: ${a.type || 'anomaly'} in ${a.component || domain}`,
              'SignalCollector.collectAnomalies',
              false,
              a
            )
          );
        });
      } catch {
        // signal collector unavailable — graceful
      }
    }

    // 3. V1 incident-response (structural knowledge)
    const v1ir = await fetchV1(`/api/incident-response?domain=${encodeURIComponent(domain)}`);
    if (v1ir.ok && v1ir.data) {
      const d = v1ir.data;
      events.push(
        event(
          'T+structural',
          `V1 incident-response: root_cause=${d.rootCause || 'unknown'}, rollback=${d.rollback || 'unknown'}`,
          `${V1_BASE}/api/incident-response`,
          true,
          d
        )
      );
    } else {
      notConnected.push({ field: 'v1_incident_response', source: `${V1_BASE}/api/incident-response`, note: 'NOT CONNECTED' });
    }

    // 4. V1 runbook (structural)
    const v1rb = await fetchV1(`/api/runbook?domain=${encodeURIComponent(domain)}`);
    if (v1rb.ok && v1rb.data) {
      events.push(
        event(
          'T+structural+1',
          `Runbook available: ${v1rb.data.title || domain} runbook`,
          `${V1_BASE}/api/runbook`,
          true,
          { steps: (v1rb.data.steps || []).length }
        )
      );
    }

    return {
      type: 'incident',
      domain,
      generatedAt: now,
      events: events.sort((a, b) => {
        // put T+0, T+structural* last after real T+Xs
        const order = (t) => {
          if (t === 'T+0') return 0;
          const m = t.match(/T\+(\d+)/);
          if (m) return parseInt(m[1], 10);
          return 99999;
        };
        return order(a.t) - order(b.t);
      }),
      notConnected,
    };
  }

  /**
   * Build the dependency timeline — structural graph traversal of what
   * propagated from the failing component. Fully structural (connected).
   */
  async buildDependencyTimeline(component) {
    const events = [];
    const now = new Date().toISOString();
    const notConnected = [];
    const domain = typeof component === 'string' ? component : extractDomain(component);

    // 1. Blast radius from V1
    const blast = await fetchV1(`/api/blast?q=${encodeURIComponent(domain)}`);
    if (blast.ok && blast.data) {
      const bd = blast.data;
      const affected = bd.affected || bd.consumers || bd.dependents || [];
      events.push(
        event('P+0', `Blast radius origin: ${domain}`, `${V1_BASE}/api/blast`, true, {
          totalAffected: affected.length,
          blast: bd,
        })
      );
      (Array.isArray(affected) ? affected : []).forEach((dep, i) => {
        const name = typeof dep === 'string' ? dep : dep.name || dep.component || JSON.stringify(dep);
        events.push(
          event(
            `P+${i + 1}`,
            `Propagation to: ${name}`,
            `${V1_BASE}/api/blast`,
            true,
            { dependency: dep }
          )
        );
      });
    } else {
      notConnected.push({ field: 'blast_radius', source: `${V1_BASE}/api/blast`, note: 'NOT CONNECTED' });
      events.push(event('P+0', `Blast origin: ${domain} (V1 unavailable)`, 'structural', false, {}));
    }

    // 2. Graph explorer — what breaks if X fails
    const ge = await getGraphExplorer();
    if (ge) {
      try {
        const breakdown = await ge.whatBreaksIf(domain);
        if (breakdown) {
          const affected = breakdown.affected || breakdown.consumers || [];
          (Array.isArray(affected) ? affected : []).forEach((dep, i) => {
            const name = typeof dep === 'string' ? dep : dep.name || String(dep);
            events.push(
              event(
                `P+graph+${i}`,
                `Graph: ${name} breaks if ${domain} fails`,
                'GraphExplorer.whatBreaksIf',
                true,
                { entity: dep }
              )
            );
          });
        }
      } catch {
        // graceful
      }
    }

    // 3. Cross-domain propagation from V1 domain intel
    const domainIntel = await fetchV1(`/api/domain?key=${encodeURIComponent(domain)}`);
    if (domainIntel.ok && domainIntel.data) {
      const d = domainIntel.data;
      const consumers = d.consumedBy || d.consumers || [];
      const deps = d.dependsOn || d.dependencies || [];
      [...deps, ...consumers].forEach((x, i) => {
        const name = typeof x === 'string' ? x : x.key || x.name || String(x);
        events.push(
          event(
            `P+domain+${i}`,
            `Domain edge: ${name}`,
            `${V1_BASE}/api/domain`,
            true,
            { edge: x }
          )
        );
      });
    }

    return {
      type: 'dependency',
      component: domain,
      generatedAt: now,
      events,
      notConnected,
      note: 'Structural propagation order — live propagation timing NOT CONNECTED (source: Cloudflare Analytics Engine)',
    };
  }

  /**
   * Build the deployment timeline — real git commits + V1 deployment-state.
   * git log is structural/connected; live deploy timestamps NOT CONNECTED.
   */
  async buildDeploymentTimeline(window = { windowMs: 24 * 60 * 60 * 1000 }) {
    const windowMs = typeof window === 'object' ? (window.windowMs || 24 * 60 * 60 * 1000) : window;
    const events = [];
    const now = new Date().toISOString();
    const notConnected = [];

    // 1. Real git commits
    const commits = getRecentGitCommits(windowMs);
    if (commits.length > 0) {
      commits.forEach((c, i) => {
        events.push(
          event(
            c.iso || `D+${i}`,
            `Commit: ${c.subject}`,
            `git log (${c.hash?.slice(0, 8) || 'unknown'})`,
            true,
            { hash: c.hash, author: c.author, subject: c.subject }
          )
        );
      });
    } else {
      events.push(event(now, 'No commits found in window (git log returned empty)', 'git', true, { windowMs }));
    }

    // 2. V1 deployment-state (HEAD + latest migration + targets)
    const ds = await fetchV1('/api/deployment-state');
    if (ds.ok && ds.data) {
      events.push(
        event(now, 'Deployment state snapshot', `${V1_BASE}/api/deployment-state`, true, ds.data)
      );
    } else {
      notConnected.push({ field: 'deployment_state', source: `${V1_BASE}/api/deployment-state`, note: 'NOT CONNECTED' });
    }

    // 3. V1 time-travel (what changed / last migration / release)
    const tt = await fetchV1('/api/time-travel');
    if (tt.ok && tt.data) {
      const changes = tt.data.changes || tt.data.migrations || [];
      (Array.isArray(changes) ? changes : []).forEach((ch, i) => {
        events.push(
          event(
            ch.timestamp || ch.at || `TT+${i}`,
            `Migration/change: ${ch.name || ch.description || JSON.stringify(ch).slice(0, 80)}`,
            `${V1_BASE}/api/time-travel`,
            true,
            ch
          )
        );
      });
    } else {
      notConnected.push({ field: 'time_travel', source: `${V1_BASE}/api/time-travel`, note: 'NOT CONNECTED' });
    }

    // 4. Live deploy version (telemetry-bound)
    notConnected.push({
      field: 'live_deploy_versions',
      source: 'Vercel Deploy API / Cloudflare Workers API',
      note: 'NOT CONNECTED — deploy version values are query-bound from Vercel/CF APIs; no credentials in repo',
    });

    // sort by timestamp, ISO strings sort lexicographically
    const sorted = events.sort((a, b) => {
      if (a.t < b.t) return -1;
      if (a.t > b.t) return 1;
      return 0;
    });

    return {
      type: 'deployment',
      generatedAt: now,
      windowMs,
      events: sorted,
      notConnected,
    };
  }

  /**
   * Build the impact timeline — cross-domain + FK propagation order.
   * Fully structural from graph intel + domain cross-domain edges.
   */
  async buildImpactTimeline(incident) {
    const domain = extractDomain(incident);
    const events = [];
    const now = new Date().toISOString();
    const notConnected = [];

    events.push(
      event('I+0', `Impact origin: ${domain}`, 'investigation-engine', true, {
        incident: typeof incident === 'object' ? incident : { domain },
      })
    );

    // 1. Cross-domain impact from V1
    const xd = await fetchV1(`/api/cross-domain?key=${encodeURIComponent(domain)}`);
    if (xd.ok && xd.data) {
      const d = xd.data;
      const downstream = d.consumedBy || d.downstream || d.affected || [];
      (Array.isArray(downstream) ? downstream : []).forEach((dep, i) => {
        const name = typeof dep === 'string' ? dep : dep.key || dep.name || String(dep);
        events.push(
          event(
            `I+${i + 1}`,
            `Cross-domain impact: ${name}`,
            `${V1_BASE}/api/cross-domain`,
            true,
            { domain: dep }
          )
        );
      });
    } else {
      notConnected.push({ field: 'cross_domain', source: `${V1_BASE}/api/cross-domain`, note: 'NOT CONNECTED' });
    }

    // 2. FK propagation — table relationships
    const rel = await fetchV1(`/api/relationships?table=sites`);
    if (rel.ok && rel.data) {
      const fks = rel.data.foreignKeys || rel.data.relationships || [];
      // Only the first 10 to keep timeline focused
      (Array.isArray(fks) ? fks.slice(0, 10) : []).forEach((fk, i) => {
        const from = fk.fromTable || fk.table || '?';
        const to = fk.toTable || fk.references || '?';
        events.push(
          event(
            `I+fk+${i}`,
            `FK propagation: ${from} → ${to}`,
            `${V1_BASE}/api/relationships`,
            true,
            fk
          )
        );
      });
    }

    // 3. Graph explorer — affected merchants
    const ge = await getGraphExplorer();
    if (ge) {
      try {
        const merchants = await ge.getAffectedMerchants(domain);
        if (merchants) {
          events.push(
            event(
              'I+merchants',
              `Affected merchants: ${JSON.stringify(merchants).slice(0, 120)}`,
              'GraphExplorer.getAffectedMerchants',
              true,
              { merchants }
            )
          );
        }
      } catch {
        // graceful
      }
    }

    // 4. Revenue impact — live values NOT CONNECTED
    notConnected.push({
      field: 'revenue_impact_amounts',
      source: 'Supabase ledger RPCs (confirm_order_payment_with_ledger)',
      note: 'NOT CONNECTED — GMV/refund amounts are query-bound from the canonical ledger; no live adapter wired',
    });
    events.push(
      event(
        'I+revenue',
        'Revenue impact: amounts NOT CONNECTED (source: canonical ledger RPCs)',
        'ledger-model',
        false,
        { source: 'confirm_order_payment_with_ledger RPC', note: 'NOT CONNECTED' }
      )
    );

    // 5. V1 business-impact
    const bi = await fetchV1(`/api/business-impact?domain=${encodeURIComponent(domain)}`);
    if (bi.ok && bi.data) {
      events.push(
        event('I+business', `Business impact: ${JSON.stringify(bi.data).slice(0, 200)}`, `${V1_BASE}/api/business-impact`, true, bi.data)
      );
    }

    return {
      type: 'impact',
      domain,
      generatedAt: now,
      events,
      notConnected,
    };
  }

  /**
   * Build all 4 timelines in parallel and return a keyed object.
   */
  async buildAll(incident) {
    const domain = extractDomain(incident);
    const [incidentTL, dependencyTL, deploymentTL, impactTL] = await Promise.allSettled([
      this.buildIncidentTimeline(incident),
      this.buildDependencyTimeline(domain),
      this.buildDeploymentTimeline({ windowMs: 24 * 60 * 60 * 1000 }),
      this.buildImpactTimeline(incident),
    ]);

    return {
      incident: incidentTL.status === 'fulfilled' ? incidentTL.value : { type: 'incident', error: incidentTL.reason?.message, events: [] },
      dependency: dependencyTL.status === 'fulfilled' ? dependencyTL.value : { type: 'dependency', error: dependencyTL.reason?.message, events: [] },
      deployment: deploymentTL.status === 'fulfilled' ? deploymentTL.value : { type: 'deployment', error: deploymentTL.reason?.message, events: [] },
      impact: impactTL.status === 'fulfilled' ? impactTL.value : { type: 'impact', error: impactTL.reason?.message, events: [] },
    };
  }
}

export default new TimelineBuilder();
