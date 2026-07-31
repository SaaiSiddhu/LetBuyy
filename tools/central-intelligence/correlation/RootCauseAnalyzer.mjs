/**
 * LCIS Phase 16 — RootCauseAnalyzer
 *
 * Produces ranked root-cause candidates for an incident by combining three
 * independent correlation strategies:
 *
 *   1. Temporal — what changed in the deployment/commit history just before
 *      the incident timestamp?
 *   2. Structural — which components in the dependency graph lie on the path
 *      from the incident's domain to its symptoms?
 *   3. Historical — has LCIS memory seen similar incidents before, and what
 *      caused them?
 *
 * Candidate shape:
 *   { cause, confidence, reasoning, evidence, type: 'temporal'|'structural'|'historical' }
 *
 * All subsystem dependencies are optional and degrade gracefully.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const GRAPHIFY_OUT = resolve(REPO_ROOT, 'graphify-out');

const LCIS_BASE = process.env.LCIS_URL ?? 'http://localhost:3333';

// ── Utility helpers ────────────────────────────────────────────────────────

function readOut(name) {
  try {
    const p = resolve(GRAPHIFY_OUT, name);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch { return null; }
}

async function tryImport(rel) {
  try {
    const m = await import(new URL(rel, import.meta.url).href);
    return m.default ?? null;
  } catch { return null; }
}

async function fetchLCIS(path, params = {}) {
  try {
    const url = new URL(LCIS_BASE + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

/** Parse an ISO timestamp safely; returns 0 on failure. */
function parseTs(v) {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Clamp a number to [0, 1]. */
function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// ── Scoring helpers ────────────────────────────────────────────────────────

/**
 * Temporal proximity score: 1.0 if the event happened immediately before the
 * incident, decays linearly to 0 at DECAY_WINDOW_MS.
 */
const DECAY_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function temporalScore(incidentTs, eventTs) {
  if (!eventTs || !incidentTs) return 0;
  const delta = incidentTs - eventTs;
  if (delta < 0) return 0; // event AFTER incident — not causal
  return clamp01(1 - delta / DECAY_WINDOW_MS);
}

/**
 * Domain affinity score: 1.0 if the event's domain matches the incident domain,
 * 0.5 for a first-degree neighbour, 0 otherwise.
 */
function domainAffinityScore(incidentDomain, eventDomain, domainNeighbours = []) {
  if (!eventDomain) return 0.2; // unknown domain — partial credit
  if (eventDomain === incidentDomain) return 1.0;
  if (domainNeighbours.includes(eventDomain)) return 0.5;
  return 0;
}

// ── RootCauseAnalyzer ──────────────────────────────────────────────────────

class RootCauseAnalyzer {

  /**
   * Primary entry-point: run all three strategies and return merged ranked candidates.
   *
   * @param {{
   *   id?: string,
   *   type?: string,
   *   domain?: string,
   *   detectedAt?: string,
   *   description?: string,
   *   severity?: string,
   *   metrics?: Record<string,unknown>
   * }} incident
   * @param {Array<{subsystem:string,type:string,timestamp:string,payload:unknown,connected:boolean}>} signals
   * @returns {Promise<Array<{cause:string,confidence:number,reasoning:string,evidence:string[],type:string}>>}
   */
  async analyze(incident, signals = []) {
    const incidentTs = parseTs(incident.detectedAt ?? incident.timestamp);

    // Separate signal types
    const deploySignals = signals.filter((s) => s.type === 'deployment_state' || s.type === 'recent_commits' || s.type === 'deployment_state_snapshot');
    const depSignals = signals.filter((s) => s.type === 'dependency_graph' || s.type === 'dependency_graph_snapshot');
    const memSignals = signals.filter((s) => s.type === 'memory_context' || s.type === 'memory_snapshot');

    const [temporal, structural, historical] = await Promise.allSettled([
      this.temporalCorrelation(incident, deploySignals),
      this.structuralCorrelation(incident, depSignals),
      this.historicalCorrelation(incident, memSignals),
    ]);

    const all = [
      ...(temporal.status === 'fulfilled' ? temporal.value : []),
      ...(structural.status === 'fulfilled' ? structural.value : []),
      ...(historical.status === 'fulfilled' ? historical.value : []),
    ];

    return this.rankCandidates(all);
  }

  // ── Temporal Correlation ──────────────────────────────────────────────────

  /**
   * Identify what changed in deployment / commit history just before the incident.
   * @param {object} incident
   * @param {object[]} deploymentSignals
   * @returns {Promise<object[]>} candidates
   */
  async temporalCorrelation(incident, deploymentSignals = []) {
    const candidates = [];
    const incidentTs = parseTs(incident.detectedAt ?? incident.timestamp);
    const incidentDomain = (incident.domain ?? '').toLowerCase();

    // Collect commits from signals
    let commits = [];
    for (const sig of deploymentSignals) {
      if (sig.payload?.commits) commits.push(...sig.payload.commits);
    }

    // Also try to fetch from LCIS
    if (commits.length === 0) {
      const state = await fetchLCIS('/api/deployment-state');
      if (state?.recentCommits) commits.push(...state.recentCommits);
    }

    // Try git log directly as last resort
    if (commits.length === 0) {
      try {
        const { execSync } = await import('node:child_process');
        const raw = execSync(
          'git log --format=\'{"hash":"%H","subject":"%s","author":"%an","date":"%aI"}\' -30',
          { encoding: 'utf8', timeout: 5000, cwd: REPO_ROOT }
        );
        commits = raw.trim().split('\n').filter(Boolean)
          .map((l) => { try { return JSON.parse(l); } catch { return null; } })
          .filter(Boolean);
      } catch { /* git unavailable */ }
    }

    // Domain neighbours from domain-intel for affinity
    const domainIntel = readOut('domain-intel.json');
    const neighbours = this._getDomainNeighbours(incidentDomain, domainIntel);

    for (const commit of commits) {
      const commitTs = parseTs(commit.date ?? commit.timestamp);
      const tScore = temporalScore(incidentTs, commitTs);
      if (tScore === 0) continue; // commit after incident or too old

      const subject = (commit.subject ?? '').toLowerCase();
      const domainHit = incidentDomain && subject.includes(incidentDomain);
      const domainScore = domainHit ? 1.0 : domainAffinityScore(incidentDomain, this._extractDomain(subject), neighbours);

      const confidence = clamp01(tScore * 0.6 + domainScore * 0.4);
      if (confidence < 0.1) continue;

      const deltaMin = Math.round((incidentTs - commitTs) / 60000);
      candidates.push({
        cause: `Deployment / code change: "${commit.subject}" (${commit.hash?.slice(0, 8) ?? 'unknown'})`,
        confidence,
        reasoning: `Committed ${deltaMin} minute(s) before the incident (temporal score ${tScore.toFixed(2)}, domain affinity ${domainScore.toFixed(2)}).`,
        evidence: [
          `commit: ${commit.hash ?? 'unknown'}`,
          `subject: ${commit.subject ?? 'unknown'}`,
          `author: ${commit.author ?? 'unknown'}`,
          `date: ${commit.date ?? 'unknown'}`,
          `delta: ${deltaMin}m before incident`,
        ],
        type: 'temporal',
      });
    }

    // If no commits → structural deployment signal
    const deployState = deploymentSignals.find((s) => s.type === 'deployment_state' && s.connected);
    if (deployState?.payload?.latestMigration) {
      candidates.push({
        cause: `Recent migration: ${deployState.payload.latestMigration}`,
        confidence: 0.35,
        reasoning: 'A recent database migration was detected. Schema changes can cause runtime failures.',
        evidence: [`migration: ${deployState.payload.latestMigration}`],
        type: 'temporal',
      });
    }

    if (candidates.length === 0) {
      candidates.push({
        cause: 'No recent deployment found within the correlation window',
        confidence: 0,
        reasoning: 'Temporal correlation found no commits or deployments in the 1-hour window before the incident.',
        evidence: ['git log: no matching commits', 'LCIS deployment-state: not available or empty'],
        type: 'temporal',
      });
    }

    return candidates;
  }

  // ── Structural Correlation ─────────────────────────────────────────────────

  /**
   * Identify the dependency path from the incident domain to its symptom via
   * the module/package dependency graph.
   * @param {object} incident
   * @param {object[]} depSignals
   * @returns {Promise<object[]>} candidates
   */
  async structuralCorrelation(incident, depSignals = []) {
    const candidates = [];
    const incidentDomain = (incident.domain ?? '').toLowerCase();

    // Try DependencyGraphBuilder directly
    const builder = await tryImport('../context-intelligence/DependencyGraphBuilder.mjs');
    let graph = null;
    if (builder && typeof builder.buildGraph === 'function') {
      graph = await builder.buildGraph().catch(() => null);
    }

    // Fallback: dep signal payload
    if (!graph) {
      const sig = depSignals.find((s) => s.connected && s.payload?.nodes);
      if (sig) graph = sig.payload;
    }

    // Fallback: graphify-out/graph.json
    if (!graph) {
      graph = readOut('graph.json');
    }

    if (!graph) {
      candidates.push({
        cause: 'Dependency graph unavailable — structural correlation skipped',
        confidence: 0,
        reasoning: 'Cannot trace the structural path without a dependency graph.',
        evidence: ['source: graphify-out/context-intelligence/dependency-graph.json — NOT CONNECTED'],
        type: 'structural',
      });
      return candidates;
    }

    // Identify high-blast-radius components touching this domain
    const blastData = await fetchLCIS('/api/blast', { q: incidentDomain }).catch(() => null);
    if (blastData?.affected) {
      for (const affected of blastData.affected.slice(0, 5)) {
        candidates.push({
          cause: `High-blast-radius component: ${affected.name ?? affected}`,
          confidence: clamp01(0.55 + (affected.score ?? 0) * 0.3),
          reasoning: `"${affected.name ?? affected}" has a broad blast radius in the dependency graph and is connected to the "${incidentDomain}" domain.`,
          evidence: [
            `blast_radius: ${affected.score ?? 'unknown'}`,
            `domain: ${incidentDomain}`,
            `source: LCIS /api/blast`,
          ],
          type: 'structural',
        });
      }
    }

    // Find nodes in the dependency graph belonging to the incident domain
    const nodes = (graph.nodes ?? graph.entities ?? []);
    const domainNodes = Array.isArray(nodes)
      ? nodes.filter((n) => {
          const name = (n.id ?? n.name ?? n.file ?? '').toLowerCase();
          return name.includes(incidentDomain) || (n.domain ?? '').toLowerCase() === incidentDomain;
        })
      : [];

    if (domainNodes.length > 0 && candidates.length === 0) {
      candidates.push({
        cause: `${domainNodes.length} module(s) in domain "${incidentDomain}" detected in dependency graph`,
        confidence: 0.45,
        reasoning: `Structural traversal identified ${domainNodes.length} node(s) belonging to the affected domain.`,
        evidence: domainNodes.slice(0, 5).map((n) => `node: ${n.id ?? n.name ?? JSON.stringify(n)}`),
        type: 'structural',
      });
    }

    // Money/tenant flag from domain
    const MONEY_DOMAINS = ['payments', 'orders', 'checkout', 'refunds', 'gift_cards', 'payouts'];
    const TENANT_DOMAINS = ['sites', 'identity', 'auth', 'tenancy'];
    if (MONEY_DOMAINS.some((d) => incidentDomain.includes(d))) {
      candidates.push({
        cause: `Money domain "${incidentDomain}" — canonical ledger RPC integrity at risk`,
        confidence: 0.7,
        reasoning: 'Failures in money domains have ledger integrity implications. Check canonical SECURITY DEFINER RPCs: create_checkout_order, confirm_order_payment_with_ledger, etc.',
        evidence: [
          'money domain: YES',
          'canonical RPCs: create_checkout_order, confirm_order_payment_with_ledger, complete_order_refund',
          'risk: idempotency key missing, double-spend, balance underflow (CHECK constraint)',
        ],
        type: 'structural',
      });
    }
    if (TENANT_DOMAINS.some((d) => incidentDomain.includes(d))) {
      candidates.push({
        cause: `Tenant/auth domain "${incidentDomain}" — RLS policy or JWT issuer mismatch`,
        confidence: 0.65,
        reasoning: 'Failures in auth/tenant domains often stem from RLS policy misconfigurations or JWT issuer confusion (customer HS256 vs merchant ES256).',
        evidence: [
          'tenant domain: YES',
          'JWT issuers: CUSTOMER_SESSION_SECRET (HS256) | LETBUYY_IDENTITY_PUBLIC_JWKS (ES256)',
          'risk: cross-tenant data leak via missing site_id predicate',
        ],
        type: 'structural',
      });
    }

    return candidates;
  }

  // ── Historical Correlation ─────────────────────────────────────────────────

  /**
   * Search LCIS memory for similar past incidents and extract their root causes.
   * @param {object} incident
   * @param {object[]} memSignals
   * @returns {Promise<object[]>} candidates
   */
  async historicalCorrelation(incident, memSignals = []) {
    const candidates = [];
    const query = [
      incident.description ?? '',
      incident.domain ?? '',
      incident.type ?? '',
    ].filter(Boolean).join(' ');

    // Try MemoryRetriever
    const retriever = await tryImport('../memory-engine/MemoryRetriever.mjs');
    if (retriever && typeof retriever.retrieve === 'function') {
      const memories = await retriever.retrieve(query, {
        collections: ['incidents', 'runbooks', 'architecture'],
        limit: 8,
        minScore: 0.4,
      }).catch(() => []);

      for (const mem of (memories ?? [])) {
        const payload = mem.payload ?? {};
        const rootCause = payload.rootCause ?? payload.cause ?? payload.summary ?? 'Unknown';
        candidates.push({
          cause: `Historical: ${rootCause}`,
          confidence: clamp01(mem.score ?? 0.4),
          reasoning: `Memory retrieval found a similar incident (score ${(mem.score ?? 0).toFixed(2)}) in collection "${mem.collection}".`,
          evidence: [
            `memory_id: ${mem.id}`,
            `collection: ${mem.collection}`,
            `score: ${mem.score?.toFixed(3) ?? 'unknown'}`,
            ...(payload.resolution ? [`resolution: ${payload.resolution}`] : []),
          ],
          type: 'historical',
        });
      }
    }

    // Also check LCIS memory-v2 snapshot
    if (candidates.length === 0) {
      const memSnap = memSignals.find((s) => s.payload);
      if (memSnap) {
        candidates.push({
          cause: 'Historical memory available (snapshot) — run MemoryRetriever for precise match',
          confidence: 0.2,
          reasoning: 'Memory snapshot is available but full retrieval was not performed.',
          evidence: ['source: graphify-out/memory-v2.json — NOT CONNECTED to live Qdrant'],
          type: 'historical',
        });
      } else {
        candidates.push({
          cause: 'No historical precedent found',
          confidence: 0,
          reasoning: 'Memory engine was not reachable and no snapshot matched this incident pattern.',
          evidence: ['source: Qdrant vector store — NOT CONNECTED', 'snapshot: not available'],
          type: 'historical',
        });
      }
    }

    return candidates;
  }

  // ── Ranking ────────────────────────────────────────────────────────────────

  /**
   * Merge and rank candidates. Deduplicates very similar causes (by confidence
   * bucket + type) and sorts descending by confidence.
   * @param {object[]} candidates
   * @returns {object[]}
   */
  rankCandidates(candidates) {
    // Filter zero-confidence explanatory-only entries when real candidates exist
    const meaningful = candidates.filter((c) => c.confidence > 0);
    const base = meaningful.length > 0 ? meaningful : candidates;

    // Sort descending
    const sorted = [...base].sort((a, b) => b.confidence - a.confidence);

    // Deduplicate: if same type and confidence within 0.05, merge evidence
    const deduped = [];
    for (const c of sorted) {
      const existing = deduped.find(
        (d) => d.type === c.type && Math.abs(d.confidence - c.confidence) < 0.05 && d.cause === c.cause
      );
      if (existing) {
        existing.evidence = [...new Set([...existing.evidence, ...c.evidence])];
      } else {
        deduped.push({ ...c });
      }
    }

    return deduped;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Extract a domain keyword from a commit subject line. */
  _extractDomain(subject) {
    const DOMAINS = ['payments', 'checkout', 'orders', 'products', 'auth', 'identity',
      'tenancy', 'refunds', 'shipping', 'themes', 'webhooks', 'workers', 'queue'];
    for (const d of DOMAINS) {
      if (subject.includes(d)) return d;
    }
    return null;
  }

  /** Return first-degree neighbour domains from domain-intel. */
  _getDomainNeighbours(domainKey, domainIntel) {
    if (!domainIntel || !domainKey) return [];
    try {
      const domains = Array.isArray(domainIntel) ? domainIntel : Object.values(domainIntel);
      const domain = domains.find((d) => (d.key ?? d.name ?? '').toLowerCase() === domainKey);
      if (!domain) return [];
      return [
        ...(domain.dependsOn ?? []),
        ...(domain.consumedBy ?? []),
      ].map((d) => (typeof d === 'string' ? d : d.key ?? d.name ?? '').toLowerCase());
    } catch { return []; }
  }
}

export default new RootCauseAnalyzer();
