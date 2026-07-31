/**
 * DocApiQualityService — documentation and API quality analytics (LQAS).
 *
 * docs(): DocQuality
 *   totalSubjects = tables + functions from db-intel.json (CONNECTED when artifact present).
 *   documentedSubjects = graph nodes whose id/label contains '.md' or 'documentation'
 *     (deterministic structural proxy: the code graph indexes markdown/doc nodes; no doc/
 *     comment fields exist on tables or functions in db-intel as of the current artifact).
 *   ratio = documentedSubjects / totalSubjects (0 when totalSubjects === 0).
 *   Finding QA05 when ratio < 0.5.
 *   connection CONNECTED when db-intel present, NOT_CONNECTED otherwise.
 *
 * api(): ApiQuality
 *   routeCount from infra-intel.json routes[] (0 when absent or empty).
 *   typedRoutes = routes with a truthy handler or type field (0 when unknowable).
 *   Finding QA08 when typedRoutes < routeCount OR when infra-intel has no routes array
 *     (typing not determinable from artifacts).
 *   connection CONNECTED when infra-intel present, NOT_CONNECTED otherwise.
 *
 * Honesty contract:
 *   - Absent/malformed artifact → honest empty, never throw, never fabricate.
 *   - ratio 0 + QA05 finding when db-intel is absent.
 *   - routeCount 0 + QA08 finding when infra-intel is absent or has no routes.
 *   - All recommendations advisory: true (enforced by QualityFinding.connection).
 *
 * No IO beyond core.store.tryRead. No Date.now() / argless new Date() — clock injected.
 * No fetch / exec / fs / DB / AI.
 */
import { evidence, notConnected, type LcisEngine } from '@letbuyy/lcis-core';
import { z } from 'zod';
import { defaultNow } from '../shared/envelope';
import type { ApiQuality, DocQuality, QualityFinding } from '../shared/types';

// ── Artifact names ─────────────────────────────────────────────────────────────
const DB_INTEL = 'db-intel';
const INFRA_INTEL = 'infra-intel';

// ── Zod schemas (loose / passthrough — absent or malformed → honest empty) ────

/** A table entry — we only need the name; everything else is irrelevant for doc-quality. */
const tableSchema = z.object({ name: z.string() }).passthrough();

/** A function entry — same: we only need the name. */
const functionSchema = z.object({ name: z.string() }).passthrough();

const dbIntelSchema = z
  .object({
    tables: z.array(tableSchema).optional(),
    functions: z.array(functionSchema).optional(),
  })
  .passthrough();

/**
 * A route entry. infra-intel v1 does NOT have a routes[] array (the artifact only
 * exposes workers/secrets/ownership/summary). We include the schema defensively in
 * case a future version adds routes, but we correctly handle the absent-routes case.
 */
const routeSchema = z
  .object({
    handler: z.unknown().optional(),
    type: z.unknown().optional(),
  })
  .passthrough();

const infraIntelSchema = z
  .object({
    routes: z.array(routeSchema).optional(),
  })
  .passthrough();

// ── ID counter (stable across calls within a process; deterministic per-run) ──
let _idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++_idCounter}`;
}

// ── DocApiQualityService ───────────────────────────────────────────────────────

export class DocApiQualityService {
  constructor(
    private readonly core: LcisEngine,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private readonly _now: () => string = defaultNow,
  ) {}

  /**
   * Documentation quality: how many of the DB subjects (tables + functions) have a
   * corresponding documentation node in the code graph?
   *
   * Structural proxy for documentedSubjects:
   *   core.graph.search('documentation') ∪ core.graph.search('.md')
   *   (union by node id, deduplicated — graph nodes whose id/label contain these
   *   substrings are documentation nodes as indexed by Graphify).
   */
  docs(): DocQuality {
    const raw = this.core.store.tryRead(DB_INTEL);

    if (raw === null) {
      // Artifact absent — honest NOT_CONNECTED
      const finding: QualityFinding = {
        id: nextId('qa05'),
        rule: 'QA05',
        severity: 'low',
        subject: 'documentation',
        title: 'Documentation gap',
        detail: 'Documentation ratio is 0 — db-intel.json is not available (NOT CONNECTED). Cannot determine totalSubjects.',
        connection: 'NOT_CONNECTED',
        evidence: [
          notConnected(DB_INTEL, 'pnpm graph:db'),
        ],
      };
      return {
        documentedSubjects: 0,
        totalSubjects: 0,
        ratio: 0,
        findings: [finding],
        connection: 'NOT_CONNECTED',
      };
    }

    // Parse loosely — malformed fields degrade to empty arrays, never throw.
    const parsed = dbIntelSchema.safeParse(raw);
    const tables = parsed.success ? (parsed.data.tables ?? []) : [];
    const functions = parsed.success ? (parsed.data.functions ?? []) : [];

    const totalSubjects = tables.length + functions.length;

    // Structural proxy: graph nodes matching 'documentation' or '.md' substring.
    // Deduplicate by id.
    const docNodes = new Map<string, true>();
    for (const n of this.core.graph.search('documentation', 500)) {
      docNodes.set(n.id, true);
    }
    for (const n of this.core.graph.search('.md', 500)) {
      docNodes.set(n.id, true);
    }
    const documentedSubjects = docNodes.size;

    const ratio = totalSubjects > 0 ? documentedSubjects / totalSubjects : 0;

    const findings: QualityFinding[] = [];
    if (ratio < 0.5) {
      findings.push({
        id: nextId('qa05'),
        rule: 'QA05',
        severity: 'low',
        subject: 'documentation',
        title: 'Documentation gap',
        detail: `Documentation ratio is ${(ratio * 100).toFixed(1)}% (${documentedSubjects} doc node(s) in graph vs ${totalSubjects} DB subject(s)). Threshold: 50%.`,
        connection: 'CONNECTED',
        evidence: [
          evidence(
            'artifact-field',
            `${DB_INTEL}:tables+functions`,
            `totalSubjects=${totalSubjects}, documentedSubjects=${documentedSubjects}, ratio=${ratio.toFixed(4)}`,
            `graphify-out/${DB_INTEL}.json`,
          ),
        ],
      });
    }

    return {
      documentedSubjects,
      totalSubjects,
      ratio,
      findings,
      connection: 'CONNECTED',
    };
  }

  /**
   * API quality: how many routes have a typed contract?
   *
   * infra-intel.json (current version) has no routes[] array — routeCount = 0.
   * We emit a QA08 finding noting that typing cannot be determined from the artifact.
   * When a future version of infra-intel adds routes[], we count routes with a truthy
   * handler or type field as typedRoutes.
   */
  api(): ApiQuality {
    const raw = this.core.store.tryRead(INFRA_INTEL);

    if (raw === null) {
      // Artifact absent — honest NOT_CONNECTED
      const finding: QualityFinding = {
        id: nextId('qa08'),
        rule: 'QA08',
        severity: 'medium',
        subject: 'api-routes',
        title: 'API typing gap',
        detail: 'infra-intel.json is not available (NOT CONNECTED). API route typing cannot be determined.',
        connection: 'NOT_CONNECTED',
        evidence: [
          notConnected(INFRA_INTEL, 'pnpm graph:infra'),
        ],
      };
      return {
        routeCount: 0,
        typedRoutes: 0,
        findings: [finding],
        connection: 'NOT_CONNECTED',
      };
    }

    // Parse loosely.
    const parsed = infraIntelSchema.safeParse(raw);
    const routes = parsed.success ? (parsed.data.routes ?? []) : [];
    const routeCount = routes.length;

    // Count routes with a truthy handler or type field.
    // Cast via Record<string, unknown> so TypeScript accepts property access regardless
    // of how zod v4 infers the passthrough output type.
    const typedRoutes = routes.filter((r) => {
      const entry = r as Record<string, unknown>;
      return Boolean(entry['handler']) || Boolean(entry['type']);
    }).length;

    const findings: QualityFinding[] = [];

    if (routeCount === 0) {
      // infra-intel present but no routes[] — typing not determinable from artifacts.
      findings.push({
        id: nextId('qa08'),
        rule: 'QA08',
        severity: 'medium',
        subject: 'api-routes',
        title: 'API typing gap',
        detail: 'infra-intel.json does not contain a routes[] array. API route typing cannot be determined from available artifacts.',
        connection: 'CONNECTED',
        evidence: [
          evidence(
            'artifact-field',
            `${INFRA_INTEL}:routes`,
            'routes[] absent — typing unknowable from this artifact version',
            `graphify-out/${INFRA_INTEL}.json`,
          ),
        ],
      });
    } else if (typedRoutes < routeCount) {
      findings.push({
        id: nextId('qa08'),
        rule: 'QA08',
        severity: 'medium',
        subject: 'api-routes',
        title: 'API typing gap',
        detail: `${routeCount - typedRoutes} of ${routeCount} route(s) lack a typed contract (handler/type field absent).`,
        connection: 'CONNECTED',
        evidence: [
          evidence(
            'artifact-field',
            `${INFRA_INTEL}:routes`,
            `typedRoutes=${typedRoutes}, routeCount=${routeCount}`,
            `graphify-out/${INFRA_INTEL}.json`,
          ),
        ],
      });
    }

    return {
      routeCount,
      typedRoutes,
      findings,
      connection: 'CONNECTED',
    };
  }
}
