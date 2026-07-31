/**
 * IncidentEvidenceCollector — collects evidence from all subsystems for an incident.
 *
 * Named IncidentEvidenceCollector (not EvidenceCollector) to avoid clash with
 * browser-intelligence/EvidenceCollector.mjs.
 *
 * Each evidence item: { source, type, connected: bool, fact, timestamp }
 * Live values → connected:false + source named exactly.
 */

const V1_BASE = 'http://localhost:3333';

// ─── lazy V2 imports (graceful) ──────────────────────────────────────────────

async function loadModule(specifier) {
  try {
    return (await import(specifier)).default;
  } catch {
    return null;
  }
}

// ─── V1 fetch helper ─────────────────────────────────────────────────────────

async function fetchV1(endpoint, timeout = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${V1_BASE}${endpoint}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, source: `${V1_BASE}${endpoint}` };
    return { ok: true, data: await res.json(), source: `${V1_BASE}${endpoint}` };
  } catch {
    clearTimeout(timer);
    return { ok: false, source: `${V1_BASE}${endpoint}` };
  }
}

// ─── evidence factory ────────────────────────────────────────────────────────

function evidence(source, type, connected, fact, extra = {}) {
  return {
    source,
    type,
    connected: !!connected,
    fact,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

function notConnectedEvidence(source, type, field) {
  return evidence(source, type, false, `NOT CONNECTED — ${field} requires live telemetry from ${source}`, {
    notConnected: true,
    field,
  });
}

// ─── in-memory store keyed by investigationId ─────────────────────────────────

const _store = new Map();

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

// ─── IncidentEvidenceCollector ────────────────────────────────────────────────

class IncidentEvidenceCollector {
  /**
   * Collect evidence from all subsystems (structural + live).
   * Returns an array of evidence items; live items have connected:false.
   */
  async collect(incident) {
    const [structural, live] = await Promise.allSettled([
      this.collectStructural(incident),
      this.collectLive(incident),
    ]);

    return [
      ...(structural.status === 'fulfilled' ? structural.value : []),
      ...(live.status === 'fulfilled' ? live.value : []),
    ];
  }

  /**
   * Structural evidence — graph, architecture drift, blast radius, runbook.
   * These are connected (sourced from the code graph / V1 structural layer).
   */
  async collectStructural(incident) {
    const domain = extractDomain(incident);
    const items = [];

    // 1. Blast radius (V1 structural)
    const blast = await fetchV1(`/api/blast?q=${encodeURIComponent(domain)}`);
    if (blast.ok) {
      items.push(
        evidence(blast.source, 'blast-radius', true, `Blast radius for ${domain}`, { data: blast.data })
      );
    } else {
      items.push(
        evidence(`${V1_BASE}/api/blast`, 'blast-radius', false, `NOT CONNECTED — V1 blast radius unavailable`, { notConnected: true })
      );
    }

    // 2. Incident response (V1 structural)
    const ir = await fetchV1(`/api/incident-response?domain=${encodeURIComponent(domain)}`);
    if (ir.ok) {
      items.push(
        evidence(ir.source, 'incident-response', true, `V1 incident-response for ${domain}`, { data: ir.data })
      );
    } else {
      items.push(
        notConnectedEvidence(`${V1_BASE}/api/incident-response`, 'incident-response', 'incident response playbook')
      );
    }

    // 3. Runbook (V1 structural)
    const rb = await fetchV1(`/api/runbook?domain=${encodeURIComponent(domain)}`);
    if (rb.ok) {
      items.push(
        evidence(rb.source, 'runbook', true, `Runbook available for ${domain}`, { data: rb.data })
      );
    } else {
      items.push(
        notConnectedEvidence(`${V1_BASE}/api/runbook`, 'runbook', 'runbook content')
      );
    }

    // 4. Architecture drift (structural)
    const driftDetector = await loadModule('../architecture-intelligence/ArchitectureDriftDetector.mjs');
    if (driftDetector) {
      try {
        const riskReport = await driftDetector.getArchitectureRiskReport();
        if (riskReport) {
          items.push(
            evidence(
              'ArchitectureDriftDetector.getArchitectureRiskReport',
              'architecture-drift',
              true,
              `Architecture risk: ${riskReport.riskLevel || riskReport.level || 'unknown'}`,
              { data: riskReport }
            )
          );
        }
      } catch (err) {
        items.push(
          evidence('ArchitectureDriftDetector', 'architecture-drift', false, `Drift detector error: ${err.message}`, { notConnected: true })
        );
      }
    }

    // 5. Graph explorer — entity explanation + what-breaks-if
    const graphExplorer = await loadModule('../graph-engine/GraphExplorer.mjs');
    if (graphExplorer) {
      try {
        const [entityInfo, breakInfo] = await Promise.allSettled([
          graphExplorer.explainEntity(domain),
          graphExplorer.whatBreaksIf(domain),
        ]);
        if (entityInfo.status === 'fulfilled' && entityInfo.value) {
          items.push(
            evidence('GraphExplorer.explainEntity', 'graph-entity', true, `Graph entity: ${domain}`, {
              data: entityInfo.value,
            })
          );
        }
        if (breakInfo.status === 'fulfilled' && breakInfo.value) {
          items.push(
            evidence('GraphExplorer.whatBreaksIf', 'blast-graph', true, `What breaks if ${domain} fails`, {
              data: breakInfo.value,
            })
          );
        }
      } catch {
        // graceful
      }
    }

    // 6. Domain intel (V1)
    const domainIntel = await fetchV1(`/api/domain?key=${encodeURIComponent(domain)}`);
    if (domainIntel.ok) {
      items.push(
        evidence(domainIntel.source, 'domain-intel', true, `Domain intel for ${domain}`, { data: domainIntel.data })
      );
    }

    // 7. Cross-domain (V1)
    const xd = await fetchV1(`/api/cross-domain?key=${encodeURIComponent(domain)}`);
    if (xd.ok) {
      items.push(
        evidence(xd.source, 'cross-domain', true, `Cross-domain edges for ${domain}`, { data: xd.data })
      );
    }

    return items;
  }

  /**
   * Live evidence — signal collector, metrics, live telemetry.
   * All marked connected:false + exact source named.
   */
  async collectLive(incident) {
    const domain = extractDomain(incident);
    const items = [];

    // 1. Signal collector
    const sc = await loadModule('../correlation/SignalCollector.mjs');
    if (sc) {
      try {
        const [deps, anomalies, metrics] = await Promise.allSettled([
          sc.collectDependencySignals(domain),
          sc.collectAnomalies(),
          sc.collectMetrics(),
        ]);
        if (deps.status === 'fulfilled' && deps.value?.length) {
          items.push(
            evidence('SignalCollector.collectDependencySignals', 'live-signals', false,
              `${deps.value.length} dependency signals collected (NOT CONNECTED — live values)`,
              { signals: deps.value, notConnected: true, source: 'Cloudflare Analytics Engine / OTel' }
            )
          );
        }
        if (anomalies.status === 'fulfilled' && anomalies.value?.length) {
          items.push(
            evidence('SignalCollector.collectAnomalies', 'anomalies', false,
              `${anomalies.value.length} anomalies detected (NOT CONNECTED — live values)`,
              { anomalies: anomalies.value, notConnected: true, source: 'OTel / SigNoz' }
            )
          );
        }
        if (metrics.status === 'fulfilled' && metrics.value) {
          items.push(
            evidence('SignalCollector.collectMetrics', 'metrics', false,
              `Metrics snapshot (NOT CONNECTED — live values)`,
              { metrics: metrics.value, notConnected: true, source: 'Cloudflare Analytics Engine' }
            )
          );
        }
      } catch {
        items.push(
          notConnectedEvidence('SignalCollector', 'live-signals', 'live dependency + anomaly signals (OTel/CF not wired)')
        );
      }
    } else {
      items.push(
        notConnectedEvidence('SignalCollector.mjs (module unavailable)', 'live-signals', 'live signals')
      );
    }

    // 2. Live metrics via V1 (/api/live-metrics)
    const lm = await fetchV1('/api/live-metrics');
    if (lm.ok) {
      items.push(
        evidence(lm.source, 'live-metrics', false,
          `Live metrics (NOT CONNECTED — values from ${lm.source})`,
          { data: lm.data, notConnected: true }
        )
      );
    } else {
      items.push(
        notConnectedEvidence(`${V1_BASE}/api/live-metrics`, 'live-metrics', 'live metric values (telemetry adapter not wired)')
      );
    }

    // 3. Memory — past incidents
    const mr = await loadModule('../memory-engine/MemoryRetriever.mjs');
    if (mr) {
      try {
        const pastIncidents = await mr.retrieveIncidents(domain, { limit: 5 });
        if (pastIncidents) {
          items.push(
            evidence(
              'MemoryRetriever.retrieveIncidents',
              'historical-incidents',
              true,
              `Recalled past incidents for ${domain}`,
              { data: pastIncidents }
            )
          );
        }
      } catch {
        items.push(
          notConnectedEvidence('MemoryRetriever (Qdrant)', 'historical-incidents', 'past incident recall (Qdrant not wired)')
        );
      }
    }

    // 4. Intelligence correlation signals
    const ice = await loadModule('../correlation/IntelligenceCorrelationEngine.mjs');
    if (ice) {
      try {
        const riskScore = await ice.getRiskScore(domain);
        if (riskScore !== undefined) {
          items.push(
            evidence(
              'IntelligenceCorrelationEngine.getRiskScore',
              'risk-score',
              true,
              `Risk score for ${domain}: ${riskScore}`,
              { riskScore }
            )
          );
        }
      } catch {
        // graceful
      }
    }

    // Blanket NOT CONNECTED for all live telemetry amounts
    items.push(
      notConnectedEvidence(
        'Supabase ledger RPCs / Razorpay webhooks / Cloudflare Analytics Engine',
        'live-revenue-impact',
        'revenue impact amounts (GMV, refund totals) — canonical ledger RPCs not queried without service-role key'
      )
    );

    return items;
  }

  /**
   * Point-in-time evidence snapshot — collect + stamp with investigationId.
   */
  async snapshot(incident) {
    const id = typeof incident === 'object' ? (incident.id || `snap-${Date.now()}`) : `snap-${Date.now()}`;
    const items = await this.collect(incident);
    _store.set(id, items);
    return { investigationId: id, evidence: items, snapshotAt: new Date().toISOString() };
  }

  /**
   * Retrieve stored evidence for a given investigationId.
   */
  getEvidence(investigationId) {
    return _store.get(investigationId) ?? [];
  }
}

export default new IncidentEvidenceCollector();
