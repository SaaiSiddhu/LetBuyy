#!/usr/bin/env node
/**
 * LCIS CLI — developer access to the deterministic LCIS intelligence engine.
 * Consumes @letbuyy/lcis-core. READ-ONLY (except --export <file>).
 */
import { Command } from 'commander';
import { z } from 'zod';
import {
  getEngine,
  envelope,
  Timer,
  LCIS_VERSION,
} from '@letbuyy/lcis-core';
import type { Evidence } from '@letbuyy/lcis-core';
import {
  resolveMode,
  renderEnvelope,
  exportToFile,
  type OutputMode,
} from './format';
import { createLivePlatform } from '@letbuyy/lcis-live';
import { getEisEngine } from '@letbuyy/lcis-execution';
import type { ChangeRequest } from '@letbuyy/lcis-execution';
import { getGovernanceEngine } from '@letbuyy/lcis-governance';
import { getOperationsEngine } from '@letbuyy/lcis-operations';
import { getEngineeringEngine } from '@letbuyy/lcis-engineering';
import type { FeatureRequest } from '@letbuyy/lcis-engineering';
import { getOrchestrationEngine } from '@letbuyy/lcis-orchestration';

// ---------------------------------------------------------------------------
// IO injection interface (for testing)
// ---------------------------------------------------------------------------

export interface IO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

const defaultIO: IO = {
  stdout: (s) => process.stdout.write(s + '\n'),
  stderr: (s) => process.stderr.write(s + '\n'),
};

// ---------------------------------------------------------------------------
// Arg validation schemas
// ---------------------------------------------------------------------------

const DepthSchema = z.coerce.number().int().min(1).max(10).default(3);
const LimitSchema = z.coerce.number().int().min(1).max(100).default(20);

// ---------------------------------------------------------------------------
// Shared option helpers
// ---------------------------------------------------------------------------

type CommonOpts = {
  json?: boolean;
  yaml?: boolean;
  table?: boolean;
  format?: string;
  export?: string;
  evidence?: boolean;
};

function addCommonOptions(cmd: Command): Command {
  return cmd
    .option('--json', 'Output as JSON envelope')
    .option('--yaml', 'Output as YAML envelope')
    .option('--table', 'Output as aligned table (default)')
    .option('--format <fmt>', 'Output format: json|yaml|table|csv|markdown')
    .option('--export <file>', 'Write output to a file')
    .option('--evidence', 'Include evidence in output');
}

function pickMode(opts: CommonOpts): OutputMode {
  if (opts.json) return 'json';
  if (opts.yaml) return 'yaml';
  if (opts.table) return 'table';
  return resolveMode(undefined, opts.format);
}

function writeOut(text: string, exportPath: string | undefined, io: IO): void {
  io.stdout(text);
  if (exportPath) {
    exportToFile(exportPath, text + '\n');
  }
}

// ---------------------------------------------------------------------------
// Error guard — never print a stack trace to the user
// ---------------------------------------------------------------------------

function userError(msg: string, io: IO): void {
  io.stderr(`Error: ${msg}`);
}

// ---------------------------------------------------------------------------
// run() — testable entry point
// ---------------------------------------------------------------------------

export async function run(argv: string[], io: IO = defaultIO): Promise<number> {
  let exitCode = 0;

  const program = new Command();

  program
    .name('lcis')
    .description('LCIS CLI — deterministic, evidence-cited intelligence for LetBuyy')
    .version(LCIS_VERSION)
    .allowUnknownOption(false);

  // -------------------------------------------------------------------------
  // blast <symbol>
  // -------------------------------------------------------------------------
  addCommonOptions(
    program
      .command('blast <symbol>')
      .description(
        'Blast-radius: affected files, domains, services, criticality, risk, evidence',
      )
      .option('--depth <n>', 'Traversal depth (1–10)', '3')
      .option('--domain <key>', 'Also run cross-domain analysis for this domain key')
      .action(async (symbol: string, opts: CommonOpts & { depth?: string; domain?: string }) => {
        const t = new Timer();
        try {
          const engine = getEngine();
          const depthResult = DepthSchema.safeParse(opts.depth);
          const depth = depthResult.success ? depthResult.data : 3;
          const mode = pickMode(opts);

          const blastResult = engine.blast.blast(symbol, depth);
          if (!blastResult) {
            userError(`Unknown symbol: "${symbol}". No node found in the graph.`, io);
            exitCode = 1;
            return;
          }

          const domainKey = opts.domain;
          const crossDomain = domainKey ? engine.blast.crossDomain(domainKey) : null;
          const impact = domainKey ? engine.blast.impact(domainKey) : null;

          const affectedDomains: string[] = [];
          const affectedServices: string[] = [];

          if (crossDomain && !('error' in crossDomain)) {
            affectedDomains.push(...crossDomain.blastRadius.affected);
            affectedDomains.push(...crossDomain.directConsumers.map((c) => c.domain));
            affectedServices.push(...crossDomain.services.apps);
            affectedServices.push(...crossDomain.services.workers);
          }

          if (impact && !('error' in impact)) {
            affectedDomains.push(...impact.breaks.domains.list);
            affectedServices.push(...impact.breaks.workers);
            affectedServices.push(...impact.breaks.deployments.apps);
            affectedServices.push(...impact.breaks.deployments.workers);
          }

          const uniqueDomains = [...new Set(affectedDomains)];
          const uniqueServices = [...new Set(affectedServices)];

          const deg = blastResult.node.degree;
          const criticality =
            deg > 50 ? 'critical' : deg > 20 ? 'high' : deg > 5 ? 'medium' : 'low';

          const summary = {
            symbol,
            resolvedId: blastResult.node.id,
            file: blastResult.node.file,
            loc: blastResult.node.loc,
            degree: blastResult.node.degree,
            impactedNodes: blastResult.impactedNodes,
            impactedFiles: blastResult.impactedFiles,
            graphLayers: blastResult.layers,
            criticality,
            topAffectedFiles: blastResult.topImpacted.map((n) => n.file),
            affectedDomains: uniqueDomains,
            affectedServices: uniqueServices,
            risk:
              impact && !('error' in impact)
                ? impact.risk
                : { money: false, tenant: false, note: 'No domain specified — pass --domain <key>' },
            artifact: blastResult.artifact,
          };

          const ev: Evidence[] = [
            {
              kind: 'graph-node',
              ref: blastResult.node.id,
              source: blastResult.artifact,
            },
            ...blastResult.topImpacted.slice(0, 5).map(
              (n): Evidence => ({
                kind: 'graph-node',
                ref: n.id,
                detail: n.file,
                source: blastResult.artifact,
              }),
            ),
          ];

          const env = envelope({ data: summary, source: 'blast-radius', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // -------------------------------------------------------------------------
  // explain <entity>
  // -------------------------------------------------------------------------
  addCommonOptions(
    program
      .command('explain <entity>')
      .description('Explain a domain, service, architecture, runtime, ownership, or risk')
      .option('--service <name>', 'Explain a named service instead of a domain')
      .action(async (entity: string, opts: CommonOpts & { service?: string }) => {
        const t = new Timer();
        try {
          const engine = getEngine();
          const mode = pickMode(opts);

          let explanation: Awaited<ReturnType<typeof engine.architecture.explainDomain>>;

          if (opts.service) {
            explanation = await engine.architecture.explainService(opts.service);
          } else if (entity === 'architecture') {
            explanation = await engine.architecture.explainArchitecture();
          } else if (entity === 'runtime') {
            explanation = await engine.architecture.explainRuntime();
          } else {
            // Try domain, then ownership, then risk
            try {
              explanation = await engine.architecture.explainDomain(entity);
            } catch {
              try {
                explanation = await engine.architecture.explainOwnership(entity);
              } catch {
                explanation = await engine.architecture.explainRisk(entity);
              }
            }
          }

          const env = envelope({
            data: explanation,
            source: 'architecture',
            executionTime: t.ms(),
            evidence: explanation.evidence,
          });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // -------------------------------------------------------------------------
  // verify <entity>
  // -------------------------------------------------------------------------
  addCommonOptions(
    program
      .command('verify <entity>')
      .description(
        'Verify: architecture|domains|services|runtime|dependencies|production',
      )
      .action(async (entity: string, opts: CommonOpts) => {
        const t = new Timer();
        try {
          const engine = getEngine();
          const mode = pickMode(opts);
          const key = entity.toLowerCase().replace(/[-_ ]/g, '');

          let result: Awaited<ReturnType<typeof engine.verification.verifyArchitecture>>;
          if (key === 'architecture') {
            result = await engine.verification.verifyArchitecture();
          } else if (key === 'domains') {
            result = await engine.verification.verifyDomains();
          } else if (key === 'services') {
            result = await engine.verification.verifyServices();
          } else if (key === 'runtime') {
            result = await engine.verification.verifyRuntime();
          } else if (key === 'dependencies' || key === 'deps') {
            result = await engine.verification.verifyDependencies();
          } else if (key === 'productionreadiness' || key === 'production') {
            result = await engine.verification.verifyProductionReadiness();
          } else {
            userError(
              `Unknown entity "${entity}". Valid: architecture|domains|services|runtime|dependencies|production`,
              io,
            );
            exitCode = 1;
            return;
          }

          const env = envelope({
            data: result,
            source: 'verification',
            executionTime: t.ms(),
            evidence: result.evidence,
          });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // -------------------------------------------------------------------------
  // memory <query>
  // -------------------------------------------------------------------------
  addCommonOptions(
    program
      .command('memory <query>')
      .description('BM25 search over governance/decision corpus')
      .option('--limit <n>', 'Max results (1–100)', '10')
      .option('--type <t>', 'Filter by memory type (decision|governance|runbook|migration|…)')
      .action((query: string, opts: CommonOpts & { limit?: string; type?: string }) => {
        const t = new Timer();
        try {
          const engine = getEngine();
          const mode = pickMode(opts);
          const limitResult = LimitSchema.safeParse(opts.limit);
          const limit = limitResult.success ? limitResult.data : 10;

          const hits = engine.memory.search(query, { limit, type: opts.type });

          if (hits.length === 0) {
            io.stdout(`No memory hits for query: "${query}"`);
            return;
          }

          const ev: Evidence[] = hits.slice(0, 5).map(
            (h): Evidence => ({
              kind: 'doc',
              ref: h.source,
              detail: h.section,
            }),
          );

          const env = envelope({ data: hits, source: 'memory', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // -------------------------------------------------------------------------
  // decision <subject>
  // -------------------------------------------------------------------------
  addCommonOptions(
    program
      .command('decision <subject>')
      .description('Decision intelligence: risks|fixes|readiness|launch|scale|dimensions|<id>')
      .action((subject: string, opts: CommonOpts) => {
        const t = new Timer();
        try {
          const engine = getEngine();
          const mode = pickMode(opts);
          const s = subject.toLowerCase().replace(/[-_ ]/g, '');

          let data: unknown;
          let src: string;

          if (s === 'risks') {
            data = engine.decision.rankRisks();
            src = 'decision/risks';
          } else if (s === 'fixes') {
            data = engine.decision.rankFixes();
            src = 'decision/fixes';
          } else if (s === 'readiness') {
            data = engine.decision.systemReadiness();
            src = 'decision/readiness';
          } else if (s === 'launch') {
            data = engine.decision.launchVerdict();
            src = 'decision/launch';
          } else if (s === 'scale') {
            data = engine.decision.scaleTiers();
            src = 'decision/scale';
          } else if (s === 'dimensions') {
            data = engine.decision.dimensionReadiness();
            src = 'decision/dimensions';
          } else {
            // Try as a specific decision trace by id
            const traced = engine.decision.trace(subject);
            if (traced.rank === -1 && traced.formula === 'not found') {
              userError(
                `Unknown subject "${subject}". Valid: risks|fixes|readiness|launch|scale|dimensions|<id>`,
                io,
              );
              exitCode = 1;
              return;
            }
            data = traced;
            src = 'decision/trace';
          }

          const env = envelope({ data, source: src, executionTime: t.ms(), evidence: [] });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // -------------------------------------------------------------------------
  // health
  // -------------------------------------------------------------------------
  addCommonOptions(
    program
      .command('health')
      .description('Engine health: node/edge counts, cache stats, commit, version')
      .action((opts: CommonOpts) => {
        const t = new Timer();
        try {
          const engine = getEngine();
          const mode = pickMode(opts);
          const stats = engine.store.cacheStats();
          const nodeCount = engine.graph.nodeCount();
          const edgeCount = engine.graph.edgeCount();
          const commit = engine.graph.commit() ?? 'unknown';

          const health = {
            version: LCIS_VERSION,
            nodeCount,
            edgeCount,
            cacheHits: stats.hits,
            cacheMisses: stats.misses,
            cacheSize: stats.size,
            cacheHitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
            graphCommit: commit,
            status: nodeCount > 0 ? 'healthy' : 'degraded',
          };

          const ev: Evidence[] = [
            {
              kind: 'artifact-field',
              ref: commit,
              detail: 'graph commit hash',
              source: 'graphify-out/graph.json',
            },
          ];
          const env = envelope({ data: health, source: 'engine/health', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // -------------------------------------------------------------------------
  // graph stats (subcommand)
  // -------------------------------------------------------------------------
  const graphCmd = program.command('graph').description('Graph-level queries');

  addCommonOptions(
    graphCmd
      .command('stats')
      .description('Node count, edge count, commit hash, cache stats')
      .action((opts: CommonOpts) => {
        const t = new Timer();
        try {
          const engine = getEngine();
          const mode = pickMode(opts);
          const stats = engine.store.cacheStats();

          const data = {
            nodeCount: engine.graph.nodeCount(),
            edgeCount: engine.graph.edgeCount(),
            commit: engine.graph.commit() ?? 'unknown',
            cacheHits: stats.hits,
            cacheMisses: stats.misses,
            cacheSize: stats.size,
            hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
          };

          const ev: Evidence[] = [
            {
              kind: 'artifact-field',
              ref: 'graphify-out/graph.json',
              detail: 'graph artifact',
            },
          ];
          const env = envelope({ data, source: 'graph/stats', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // -------------------------------------------------------------------------
  // live (subcommands): health | status | adapters | investigate <subject>
  // -------------------------------------------------------------------------
  const liveCmd = program.command('live').description('Live platform: health, status, adapters, investigate');

  addCommonOptions(
    liveCmd
      .command('health')
      .description('Health of all live adapters (Supabase, GitHub, Cloudflare, Vercel). Honest NOT_CONNECTED when creds absent.')
      .action(async (opts: CommonOpts) => {
        const t = new Timer();
        try {
          const mode = pickMode(opts);
          const platform = createLivePlatform();
          const result = await platform.health();
          const ev: Evidence[] = result.adapters.map((a) => ({
            kind: 'artifact-field',
            ref: `adapter:${a.adapter}`,
            detail: `status=${a.status}${a.missingEnvVars && a.missingEnvVars.length > 0 ? ` missing=${a.missingEnvVars.join(',')}` : ''}`,
            source: 'lcis-live',
          }));
          const env = envelope({ data: result, source: 'live/health', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  addCommonOptions(
    liveCmd
      .command('status')
      .description('Snapshot status of all live adapters including collected facts.')
      .action(async (opts: CommonOpts) => {
        const t = new Timer();
        try {
          const mode = pickMode(opts);
          const platform = createLivePlatform();
          const result = await platform.status();
          const ev: Evidence[] = result.adapters.map((a) => ({
            kind: 'artifact-field',
            ref: `adapter:${a.adapter}`,
            detail: `status=${a.status} confidence=${a.confidence}`,
            source: 'lcis-live',
          }));
          const env = envelope({ data: result, source: 'live/status', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  addCommonOptions(
    liveCmd
      .command('adapters')
      .description('List registered live adapters and their metadata.')
      .action((opts: CommonOpts) => {
        const t = new Timer();
        try {
          const mode = pickMode(opts);
          const platform = createLivePlatform();
          const list = platform.adapters();
          const ev: Evidence[] = list.map((a) => ({
            kind: 'artifact-field',
            ref: `adapter:${a.name}`,
            source: 'lcis-live',
          }));
          const env = envelope({ data: list, source: 'live/adapters', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  addCommonOptions(
    liveCmd
      .command('investigate <subject>')
      .description('Correlate subject blast radius (lcis-core) with live adapter facts. NOT_CONNECTED adapters listed honestly.')
      .action(async (subject: string, opts: CommonOpts) => {
        const t = new Timer();
        try {
          const mode = pickMode(opts);
          const platform = createLivePlatform();
          const result = await platform.investigate(subject);
          const ev: Evidence[] = [
            ...result.evidence.map((e): Evidence => (typeof e === 'string' ? { kind: 'doc', ref: e } : (e as Evidence))),
            ...result.notConnected.map((name): Evidence => ({
              kind: 'artifact-field',
              ref: `adapter:${name}`,
              detail: 'NOT_CONNECTED — no provider credentials present',
              source: 'lcis-live',
            })),
          ];
          const env = envelope({ data: result, source: 'live/investigate', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // -------------------------------------------------------------------------
  // db (subcommands): status | tables | policies | migrations | drift | health
  // -------------------------------------------------------------------------
  const dbCmd = program.command('db').description('Database live intelligence (Supabase adapter)');

  addCommonOptions(
    dbCmd
      .command('status')
      .description('Full Supabase adapter snapshot (status, facts, confidence).')
      .action(async (opts: CommonOpts) => {
        const t = new Timer();
        try {
          const mode = pickMode(opts);
          const platform = createLivePlatform();
          const status = await platform.status();
          const snap = status.adapters.find((a) => a.adapter === 'supabase');
          const data = snap ?? { adapter: 'supabase', status: 'NOT_CONNECTED', note: 'adapter not registered' };
          const ev: Evidence[] = [{ kind: 'artifact-field', ref: 'adapter:supabase', detail: `status=${(data as { status: string }).status}`, source: 'lcis-live' }];
          const env = envelope({ data, source: 'db/status', executionTime: t.ms(), evidence: ev });
          writeOut(renderEnvelope(env, mode, Boolean(opts.evidence)), opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  addCommonOptions(
    dbCmd
      .command('tables')
      .description('Table facts from the Supabase live snapshot.')
      .action(async (opts: CommonOpts) => {
        const t = new Timer();
        try {
          const mode = pickMode(opts);
          const platform = createLivePlatform();
          const status = await platform.status();
          const snap = status.adapters.find((a) => a.adapter === 'supabase');
          const facts = ((snap?.payload as { facts?: Array<{ kind: string }> } | null)?.facts ?? []).filter((f) => f.kind === 'table');
          const ev: Evidence[] = [{ kind: 'artifact-field', ref: 'adapter:supabase', detail: `${facts.length} table facts`, source: 'lcis-live' }];
          const env = envelope({ data: { facts, notConnected: !snap || snap.status !== 'CONNECTED' }, source: 'db/tables', executionTime: t.ms(), evidence: ev });
          writeOut(renderEnvelope(env, mode, Boolean(opts.evidence)), opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  addCommonOptions(
    dbCmd
      .command('policies')
      .description('RLS policy facts from the Supabase live snapshot.')
      .action(async (opts: CommonOpts) => {
        const t = new Timer();
        try {
          const mode = pickMode(opts);
          const platform = createLivePlatform();
          const status = await platform.status();
          const snap = status.adapters.find((a) => a.adapter === 'supabase');
          const facts = ((snap?.payload as { facts?: Array<{ kind: string }> } | null)?.facts ?? []).filter((f) => f.kind === 'policy');
          const ev: Evidence[] = [{ kind: 'artifact-field', ref: 'adapter:supabase', detail: `${facts.length} policy facts`, source: 'lcis-live' }];
          const env = envelope({ data: { facts, notConnected: !snap || snap.status !== 'CONNECTED' }, source: 'db/policies', executionTime: t.ms(), evidence: ev });
          writeOut(renderEnvelope(env, mode, Boolean(opts.evidence)), opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  addCommonOptions(
    dbCmd
      .command('migrations')
      .description('Migration facts from the Supabase live snapshot.')
      .action(async (opts: CommonOpts) => {
        const t = new Timer();
        try {
          const mode = pickMode(opts);
          const platform = createLivePlatform();
          const status = await platform.status();
          const snap = status.adapters.find((a) => a.adapter === 'supabase');
          const facts = ((snap?.payload as { facts?: Array<{ kind: string }> } | null)?.facts ?? []).filter((f) => f.kind === 'migration');
          const ev: Evidence[] = [{ kind: 'artifact-field', ref: 'adapter:supabase', detail: `${facts.length} migration facts`, source: 'lcis-live' }];
          const env = envelope({ data: { facts, notConnected: !snap || snap.status !== 'CONNECTED' }, source: 'db/migrations', executionTime: t.ms(), evidence: ev });
          writeOut(renderEnvelope(env, mode, Boolean(opts.evidence)), opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  addCommonOptions(
    dbCmd
      .command('drift')
      .description('Schema drift findings from Supabase adapter verification (missing-rls, schema-drift).')
      .action(async (opts: CommonOpts) => {
        const t = new Timer();
        try {
          const mode = pickMode(opts);
          const platform = createLivePlatform();
          const adapter = platform.adapter('supabase');
          if (!adapter) {
            userError('supabase adapter not registered', io);
            exitCode = 1;
            return;
          }
          const verifications = await adapter.verify();
          const findings = verifications.findings ?? [];
          const ev: Evidence[] = findings.slice(0, 5).map((f: { rule?: string; table?: string; detail?: string }): Evidence => ({
            kind: 'artifact-field',
            ref: `supabase:${f.rule ?? 'unknown'}`,
            detail: f.table ? `table=${f.table} — ${f.detail ?? ''}` : (f.detail ?? ''),
            source: 'lcis-live',
          }));
          const env = envelope({ data: { findings, findingCount: findings.length }, source: 'db/drift', executionTime: t.ms(), evidence: ev });
          writeOut(renderEnvelope(env, mode, Boolean(opts.evidence)), opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  addCommonOptions(
    dbCmd
      .command('health')
      .description('Health of the Supabase adapter only.')
      .action(async (opts: CommonOpts) => {
        const t = new Timer();
        try {
          const mode = pickMode(opts);
          const platform = createLivePlatform();
          const adapter = platform.adapter('supabase');
          if (!adapter) {
            userError('supabase adapter not registered', io);
            exitCode = 1;
            return;
          }
          const result = await adapter.health();
          const ev: Evidence[] = [{
            kind: 'artifact-field',
            ref: 'adapter:supabase',
            detail: `status=${result.status}${result.missingEnvVars && result.missingEnvVars.length > 0 ? ` missing=${result.missingEnvVars.join(',')}` : ''}`,
            source: 'lcis-live',
          }];
          const env = envelope({ data: result, source: 'db/health', executionTime: t.ms(), evidence: ev });
          writeOut(renderEnvelope(env, mode, Boolean(opts.evidence)), opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // -------------------------------------------------------------------------
  // github status
  // -------------------------------------------------------------------------
  const githubCmd = program.command('github').description('GitHub live intelligence');

  addCommonOptions(
    githubCmd
      .command('status')
      .description('GitHub adapter health and deployment facts.')
      .action(async (opts: CommonOpts) => {
        const t = new Timer();
        try {
          const mode = pickMode(opts);
          const platform = createLivePlatform();
          const h = await platform.health();
          const snap = h.adapters.find((a) => a.adapter === 'github');
          const data = snap ?? { adapter: 'github', status: 'NOT_CONNECTED' };
          const ev: Evidence[] = [{ kind: 'artifact-field', ref: 'adapter:github', detail: `status=${(data as { status: string }).status}`, source: 'lcis-live' }];
          const env = envelope({ data, source: 'github/status', executionTime: t.ms(), evidence: ev });
          writeOut(renderEnvelope(env, mode, Boolean(opts.evidence)), opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // -------------------------------------------------------------------------
  // cloudflare status
  // -------------------------------------------------------------------------
  const cloudflareCmd = program.command('cloudflare').description('Cloudflare live intelligence');

  addCommonOptions(
    cloudflareCmd
      .command('status')
      .description('Cloudflare adapter health and edge facts.')
      .action(async (opts: CommonOpts) => {
        const t = new Timer();
        try {
          const mode = pickMode(opts);
          const platform = createLivePlatform();
          const h = await platform.health();
          const snap = h.adapters.find((a) => a.adapter === 'cloudflare');
          const data = snap ?? { adapter: 'cloudflare', status: 'NOT_CONNECTED' };
          const ev: Evidence[] = [{ kind: 'artifact-field', ref: 'adapter:cloudflare', detail: `status=${(data as { status: string }).status}`, source: 'lcis-live' }];
          const env = envelope({ data, source: 'cloudflare/status', executionTime: t.ms(), evidence: ev });
          writeOut(renderEnvelope(env, mode, Boolean(opts.evidence)), opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // -------------------------------------------------------------------------
  // vercel status
  // -------------------------------------------------------------------------
  const vercelCmd = program.command('vercel').description('Vercel live intelligence');

  addCommonOptions(
    vercelCmd
      .command('status')
      .description('Vercel adapter health and deployment facts.')
      .action(async (opts: CommonOpts) => {
        const t = new Timer();
        try {
          const mode = pickMode(opts);
          const platform = createLivePlatform();
          const h = await platform.health();
          const snap = h.adapters.find((a) => a.adapter === 'vercel');
          const data = snap ?? { adapter: 'vercel', status: 'NOT_CONNECTED' };
          const ev: Evidence[] = [{ kind: 'artifact-field', ref: 'adapter:vercel', detail: `status=${(data as { status: string }).status}`, source: 'lcis-live' }];
          const env = envelope({ data, source: 'vercel/status', executionTime: t.ms(), evidence: ev });
          writeOut(renderEnvelope(env, mode, Boolean(opts.evidence)), opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // -------------------------------------------------------------------------
  // investigate (subcommands): database | deployment | edge
  // -------------------------------------------------------------------------
  const investigateCmd = program.command('investigate').description('Cross-adapter investigation');

  for (const subject of ['database', 'deployment', 'edge'] as const) {
    addCommonOptions(
      investigateCmd
        .command(subject)
        .description(`Investigate the "${subject}" subject: correlate blast-radius with live adapter facts.`)
        .action(async (opts: CommonOpts) => {
          const t = new Timer();
          try {
            const mode = pickMode(opts);
            const platform = createLivePlatform();
            const result = await platform.investigate(subject);
            const ev: Evidence[] = [
              ...result.evidence.map((e): Evidence => (typeof e === 'string' ? { kind: 'doc', ref: e } : (e as Evidence))),
              ...result.notConnected.map((name): Evidence => ({
                kind: 'artifact-field',
                ref: `adapter:${name}`,
                detail: 'NOT_CONNECTED — no provider credentials present',
                source: 'lcis-live',
              })),
            ];
            const env = envelope({ data: result, source: `investigate/${subject}`, executionTime: t.ms(), evidence: ev });
            writeOut(renderEnvelope(env, mode, Boolean(opts.evidence)), opts.export, io);
          } catch (err: unknown) {
            userError(err instanceof Error ? err.message : String(err), io);
            exitCode = 1;
          }
        }),
    );
  }

  // -------------------------------------------------------------------------
  // plan (Phase-4 command group)
  // Consumes @letbuyy/lcis-execution (EIS engine). READ-ONLY — pure reasoning;
  // no fetch/exec/spawn/writeFile/network. Every plan embeds evidence/confidence/
  // sources/timestamp from the EIS. Unresolved requests are handled honestly
  // (empty plan, exit 0, no error).
  // -------------------------------------------------------------------------

  /** Build a ChangeRequest from shared plan subcommand args/options. */
  function buildChangeRequest(
    words: string[],
    opts: { domain?: string | string[]; seedTable?: string | string[]; symbol?: string | string[] },
  ): ChangeRequest {
    const text = words.join(' ').trim() || '(unspecified)';
    const toArray = (v: string | string[] | undefined): string[] =>
      v === undefined ? [] : Array.isArray(v) ? v : [v];
    return {
      text,
      domains: toArray(opts.domain),
      tables: toArray(opts.seedTable),
      symbols: toArray(opts.symbol),
    };
  }

  /** Options shared across all plan subcommands. */
  type PlanOpts = CommonOpts & {
    domain?: string | string[];
    seedTable?: string | string[];
    symbol?: string | string[];
  };

  /**
   * Add EIS seed options + the shared common options to a plan subcommand.
   * NOTE: --table is already claimed by addCommonOptions so seed-table uses --seed-table.
   */
  function addPlanOptions(cmd: Command): Command {
    cmd
      .option('--domain <d...>', 'Seed domains (repeatable)')
      .option('--seed-table <t...>', 'Seed tables (repeatable)')
      .option('--symbol <s...>', 'Seed symbols (repeatable)');
    return addCommonOptions(cmd);
  }

  /** Wrap an EIS plan artifact in the shared LcisEnvelope and emit it. */
  function emitPlan(
    planData: { evidence?: readonly unknown[]; confidence?: number } & Record<string, unknown>,
    source: string,
    executionTimeMs: number,
    opts: CommonOpts,
    io: IO,
  ): void {
    const evidence = (planData.evidence ?? []) as Evidence[];
    const env = envelope({
      data: planData,
      source,
      executionTime: executionTimeMs,
      evidence,
    });
    const mode = pickMode(opts);
    const out = renderEnvelope(env, mode, Boolean(opts.evidence));
    writeOut(out, opts.export, io);
  }

  const planCmd = program
    .command('plan')
    .description(
      'EIS planning intelligence (Phase-4): change / execution / migration / tests / security / rollback / launch / release',
    );

  // plan change <text...>
  addPlanOptions(
    planCmd
      .command('change <text...>')
      .description('Analyse a change request — seeds, blast radius, complexity, risk, sequence')
      .action(async (words: string[], opts: PlanOpts) => {
        const t = new Timer();
        try {
          const eis = getEisEngine();
          const req = buildChangeRequest(words, opts);
          const result = eis.analyze(req);
          emitPlan(result as unknown as Record<string, unknown>, 'plan/change', t.ms(), opts, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // plan execution <text...>
  addPlanOptions(
    planCmd
      .command('execution <text...>')
      .description('Execution plan: work breakdown, milestones, critical path, checklist')
      .action(async (words: string[], opts: PlanOpts) => {
        const t = new Timer();
        try {
          const eis = getEisEngine();
          const req = buildChangeRequest(words, opts);
          const result = eis.execution.planImplementation(req);
          emitPlan(result as unknown as Record<string, unknown>, 'plan/execution', t.ms(), opts, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // plan migration <text...>
  addPlanOptions(
    planCmd
      .command('migration <text...>')
      .description('Migration plan: targets, steps, data-loss risks, readiness, simulated impact')
      .action(async (words: string[], opts: PlanOpts) => {
        const t = new Timer();
        try {
          const eis = getEisEngine();
          const req = buildChangeRequest(words, opts);
          const result = eis.migration.analyzeMigration(req);
          emitPlan(result as unknown as Record<string, unknown>, 'plan/migration', t.ms(), opts, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // plan tests <text...>
  addPlanOptions(
    planCmd
      .command('tests <text...>')
      .description('Test plan: required, missing, regression, smoke, load, security, acceptance')
      .action(async (words: string[], opts: PlanOpts) => {
        const t = new Timer();
        try {
          const eis = getEisEngine();
          const req = buildChangeRequest(words, opts);
          const result = eis.testing.generateTestPlan(req);
          emitPlan(result as unknown as Record<string, unknown>, 'plan/tests', t.ms(), opts, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // plan security <text...>
  addPlanOptions(
    planCmd
      .command('security <text...>')
      .description('Security test targets derived from the change blast radius')
      .action(async (words: string[], opts: PlanOpts) => {
        const t = new Timer();
        try {
          const eis = getEisEngine();
          const req = buildChangeRequest(words, opts);
          const targets = eis.testing.generateSecurityPlan(req);
          // generateSecurityPlan returns TestTarget[] — wrap it in a synthetic plan
          // object so the envelope pattern is consistent with every other subcommand.
          const planData = {
            request: req,
            targets,
            count: targets.length,
            evidence: targets.flatMap((t) => t.evidence),
            confidence: targets.length > 0 ? 0.8 : 0.3,
            sources: ['graphify-out/graph.json'],
            timestamp: new Date().toISOString(),
          };
          emitPlan(planData, 'plan/security', t.ms(), opts, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // plan rollback <text...>
  addPlanOptions(
    planCmd
      .command('rollback <text...>')
      .description('Rollback plan: readiness, steps, irreversible changes, estimated recovery')
      .action(async (words: string[], opts: PlanOpts) => {
        const t = new Timer();
        try {
          const eis = getEisEngine();
          const req = buildChangeRequest(words, opts);
          const result = eis.rollback.generateRollbackPlan(req);
          emitPlan(result as unknown as Record<string, unknown>, 'plan/rollback', t.ms(), opts, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // plan launch <text...>  (async — evaluateLaunch is async)
  addPlanOptions(
    planCmd
      .command('launch <text...>')
      .description('Launch plan: GO / CONDITIONAL_GO / NO_GO decision, blockers, checklist')
      .action(async (words: string[], opts: PlanOpts) => {
        const t = new Timer();
        try {
          const eis = getEisEngine();
          const req = buildChangeRequest(words, opts);
          const result = await eis.launch.evaluateLaunch(req);
          emitPlan(result as unknown as Record<string, unknown>, 'plan/launch', t.ms(), opts, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // plan release <text...>  (the full 8-plan set; async)
  addPlanOptions(
    planCmd
      .command('release <text...>')
      .description('Full release plan: all 8 EIS plans (change/execution/migration/tests/rollback/launch/verification + graph)')
      .action(async (words: string[], opts: PlanOpts) => {
        const t = new Timer();
        try {
          const eis = getEisEngine();
          const req = buildChangeRequest(words, opts);
          const full = await eis.planAll(req);
          // planAll returns a FullPlan — collect evidence + confidence from all 8 plans
          const allEvidence: Evidence[] = [
            ...full.change.evidence,
            ...full.execution.evidence,
            ...full.migration.evidence,
            ...full.tests.evidence,
            ...full.rollback.evidence,
            ...full.launch.evidence,
            ...full.verification.evidence,
          ] as Evidence[];
          const avgConfidence =
            (full.change.confidence +
              full.execution.confidence +
              full.migration.confidence +
              full.tests.confidence +
              full.rollback.confidence +
              full.launch.confidence +
              full.verification.confidence) /
            7;
          const planData = {
            request: req,
            planCount: 8,
            change: full.change,
            execution: full.execution,
            executionGraph: full.executionGraph,
            migration: full.migration,
            tests: full.tests,
            rollback: full.rollback,
            launch: full.launch,
            verification: full.verification,
            evidence: allEvidence,
            confidence: avgConfidence,
            sources: ['graphify-out/graph.json', 'graphify-out/domain-intel.json'],
            timestamp: new Date().toISOString(),
          };
          emitPlan(planData, 'plan/release', t.ms(), opts, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );


  // -------------------------------------------------------------------------
  // GDIS Governance commands (Phase-5): drift | compliance | governance |
  // readiness | ownership | security-drift | architecture-health | domain-health
  // All READ-ONLY: no fetch/exec/spawn/writeFile/network calls.
  // -------------------------------------------------------------------------

  // lcis drift
  addCommonOptions(
    program
      .command('drift')
      .description('GDIS: architecture / security / ownership / test / operational drift findings')
      .action((opts: CommonOpts) => {
        const t = new Timer();
        try {
          const gov = getGovernanceEngine();
          const mode = pickMode(opts);
          const report = gov.drift.generateDriftReport();
          const ev: Evidence[] = report.evidence.slice(0, 6) as Evidence[];
          const env = envelope({ data: report, source: 'governance/drift', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis compliance
  addCommonOptions(
    program
      .command('compliance')
      .description('GDIS: R001-R008 compliance evaluation, score, violations')
      .action((opts: CommonOpts) => {
        const t = new Timer();
        try {
          const gov = getGovernanceEngine();
          const mode = pickMode(opts);
          const report = gov.compliance.generateComplianceReport();
          const ev: Evidence[] = report.evidence.slice(0, 6) as Evidence[];
          const env = envelope({ data: report, source: 'governance/compliance', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis governance
  addCommonOptions(
    program
      .command('governance')
      .description('GDIS: full constitutional report — drift + compliance + ownership + security + readiness + healthScore')
      .action(async (opts: CommonOpts) => {
        const t = new Timer();
        try {
          const gov = getGovernanceEngine();
          const mode = pickMode(opts);
          const report = await gov.generateGovernanceReport();
          const ev: Evidence[] = report.evidence.slice(0, 8) as Evidence[];
          const env = envelope({ data: report, source: 'governance/report', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis readiness
  addCommonOptions(
    program
      .command('readiness')
      .description('GDIS: readiness scores, overall band, summary across all system dimensions')
      .action(async (opts: CommonOpts) => {
        const t = new Timer();
        try {
          const gov = getGovernanceEngine();
          const mode = pickMode(opts);
          const report = await gov.readiness.generateReadinessReport();
          const ev: Evidence[] = report.evidence.slice(0, 6) as Evidence[];
          const env = envelope({ data: report, source: 'governance/readiness', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis ownership
  addCommonOptions(
    program
      .command('ownership')
      .description('GDIS: ownership gaps, coverage by entity type, summary')
      .action((opts: CommonOpts) => {
        const t = new Timer();
        try {
          const gov = getGovernanceEngine();
          const mode = pickMode(opts);
          const report = gov.ownership.generateOwnershipReport();
          const ev: Evidence[] = report.evidence.slice(0, 6) as Evidence[];
          const env = envelope({ data: report, source: 'governance/ownership', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis security-drift
  addCommonOptions(
    program
      .command('security-drift')
      .description('GDIS: security drift findings by kind — missing auth, RLS gaps, JWT drift, etc.')
      .action((opts: CommonOpts) => {
        const t = new Timer();
        try {
          const gov = getGovernanceEngine();
          const mode = pickMode(opts);
          const report = gov.security.generateSecurityDriftReport();
          const ev: Evidence[] = report.evidence.slice(0, 6) as Evidence[];
          const env = envelope({ data: report, source: 'governance/security-drift', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis architecture-health
  addCommonOptions(
    program
      .command('architecture-health')
      .description('GDIS: architecture health — score, structural drift findings, compliance (R001)')
      .action((opts: CommonOpts) => {
        const t = new Timer();
        try {
          const gov = getGovernanceEngine();
          const mode = pickMode(opts);
          const view = gov.generateArchitectureHealth();
          const ev: Evidence[] = view.evidence.slice(0, 6) as Evidence[];
          const env = envelope({ data: view, source: 'governance/architecture-health', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis domain-health
  addCommonOptions(
    program
      .command('domain-health')
      .description('GDIS: domain health — readiness + domain-drift findings, score, summary')
      .action(async (opts: CommonOpts) => {
        const t = new Timer();
        try {
          const gov = getGovernanceEngine();
          const mode = pickMode(opts);
          const view = await gov.generateDomainHealth();
          const ev: Evidence[] = view.evidence.slice(0, 6) as Evidence[];
          const env = envelope({ data: view, source: 'governance/domain-health', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // -------------------------------------------------------------------------
  // LCOS Operations commands (Phase-6)
  // Consumes @letbuyy/lcis-operations (getOperationsEngine). READ-ONLY — pure
  // observation/analysis; no fetch/exec/spawn/writeFile/network. Every report
  // embeds evidence/confidence/sources/timestamp/liveConnected. Live values are
  // honestly NOT_CONNECTED + exact source when adapters are not credentialed.
  // -------------------------------------------------------------------------

  // lcis runtime
  addCommonOptions(
    program
      .command('runtime')
      .description('LCOS: runtime operations report — workers, queues, crons, health, signals')
      .action((opts: CommonOpts) => {
        const t = new Timer();
        try {
          const ops = getOperationsEngine();
          const mode = pickMode(opts);
          const report = ops.runtime();
          const ev: Evidence[] = report.evidence.slice(0, 6) as Evidence[];
          const env = envelope({ data: report, source: 'operations/runtime', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis commerce
  addCommonOptions(
    program
      .command('commerce')
      .description('LCOS: commerce operations report — orders, payments, inventory, refunds')
      .action((opts: CommonOpts) => {
        const t = new Timer();
        try {
          const ops = getOperationsEngine();
          const mode = pickMode(opts);
          const report = ops.commerce();
          const ev: Evidence[] = report.evidence.slice(0, 6) as Evidence[];
          const env = envelope({ data: report, source: 'operations/commerce', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis merchant
  addCommonOptions(
    program
      .command('merchant')
      .description('LCOS: merchant operations report — store health, adoption, risk')
      .action((opts: CommonOpts) => {
        const t = new Timer();
        try {
          const ops = getOperationsEngine();
          const mode = pickMode(opts);
          const report = ops.merchant();
          const ev: Evidence[] = report.evidence.slice(0, 6) as Evidence[];
          const env = envelope({ data: report, source: 'operations/merchant', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis customer
  addCommonOptions(
    program
      .command('customer')
      .description('LCOS: customer operations report — sessions, funnel, conversion, retention')
      .action((opts: CommonOpts) => {
        const t = new Timer();
        try {
          const ops = getOperationsEngine();
          const mode = pickMode(opts);
          const report = ops.customer();
          const ev: Evidence[] = report.evidence.slice(0, 6) as Evidence[];
          const env = envelope({ data: report, source: 'operations/customer', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis deployment
  addCommonOptions(
    program
      .command('deployment')
      .description('LCOS: deployment operations report — deploy state, versions, migration status')
      .action((opts: CommonOpts) => {
        const t = new Timer();
        try {
          const ops = getOperationsEngine();
          const mode = pickMode(opts);
          const report = ops.deployment();
          const ev: Evidence[] = report.evidence.slice(0, 6) as Evidence[];
          const env = envelope({ data: report, source: 'operations/deployment', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis incident
  addCommonOptions(
    program
      .command('incident')
      .description('LCOS: incident operations report — open incidents, root causes, blast radius')
      .action((opts: CommonOpts) => {
        const t = new Timer();
        try {
          const ops = getOperationsEngine();
          const mode = pickMode(opts);
          const report = ops.incident();
          const ev: Evidence[] = report.evidence.slice(0, 6) as Evidence[];
          const env = envelope({ data: report, source: 'operations/incident', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis security  (NOTE: lcis security-drift from Phase-5 remains; this is operations-level)
  addCommonOptions(
    program
      .command('security')
      .description('LCOS: security operations report — posture, attack surface, RLS, JWT health')
      .action((opts: CommonOpts) => {
        const t = new Timer();
        try {
          const ops = getOperationsEngine();
          const mode = pickMode(opts);
          const report = ops.security();
          const ev: Evidence[] = report.evidence.slice(0, 6) as Evidence[];
          const env = envelope({ data: report, source: 'operations/security', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis forecast
  addCommonOptions(
    program
      .command('forecast')
      .description('LCOS: forecast report — deterministic trend projections; series NOT_CONNECTED when no history')
      .action((opts: CommonOpts) => {
        const t = new Timer();
        try {
          const ops = getOperationsEngine();
          const mode = pickMode(opts);
          const report = ops.forecast();
          const ev: Evidence[] = report.evidence.slice(0, 6) as Evidence[];
          const env = envelope({ data: report, source: 'operations/forecast', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis operations  (composite)
  addCommonOptions(
    program
      .command('operations')
      .description('LCOS: composite operations report — all 8 areas + answers (healthy/degraded/failing/atRisk/investigate)')
      .action((opts: CommonOpts) => {
        const t = new Timer();
        try {
          const ops = getOperationsEngine();
          const mode = pickMode(opts);
          const report = ops.operationsReport();
          const ev: Evidence[] = report.evidence.slice(0, 8) as Evidence[];
          const env = envelope({ data: report, source: 'operations/composite', executionTime: t.ms(), evidence: ev });
          const out = renderEnvelope(env, mode, Boolean(opts.evidence));
          writeOut(out, opts.export, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // -------------------------------------------------------------------------
  // EINS Engineering commands (Phase-7)
  // Consumes @letbuyy/lcis-engineering (getEngineeringEngine). READ-ONLY —
  // pure reasoning; no fetch/exec/spawn/writeFile/network. Every output embeds
  // evidence/confidence/sources/timestamp. Gibberish requests are honestly empty
  // (unresolved=true or empty tasks), exit 0, no stack trace.
  // -------------------------------------------------------------------------

  /**
   * Build a FeatureRequest from variadic word args + EINS seed options.
   * Accepts --domain, --seed-table, --symbol to match the EIS buildChangeRequest
   * helper above. File seeds are not exposed via CLI options but the type allows them.
   */
  function buildFeatureRequest(
    words: string[],
    opts: { domain?: string | string[]; seedTable?: string | string[]; symbol?: string | string[] },
  ): FeatureRequest {
    const text = words.join(' ').trim() || '(unspecified)';
    const toArray = (v: string | string[] | undefined): string[] =>
      v === undefined ? [] : Array.isArray(v) ? v : [v];
    return {
      text,
      domains: toArray(opts.domain),
      tables: toArray(opts.seedTable),
      symbols: toArray(opts.symbol),
    };
  }

  /** Options shared across all EINS subcommands. */
  type EinsOpts = CommonOpts & {
    domain?: string | string[];
    seedTable?: string | string[];
    symbol?: string | string[];
  };

  /** Add EINS seed options + common options to a command. */
  function addEinsOptions(cmd: Command): Command {
    cmd
      .option('--domain <d...>', 'Seed domains (repeatable)')
      .option('--seed-table <t...>', 'Seed tables (repeatable)')
      .option('--symbol <s...>', 'Seed symbols (repeatable)');
    return addCommonOptions(cmd);
  }

  /** Wrap an EINS artifact in the shared LcisEnvelope and emit it. */
  function emitEins(
    artifactData: { evidence?: readonly unknown[]; confidence?: number } & Record<string, unknown>,
    source: string,
    executionTimeMs: number,
    opts: CommonOpts,
    ioTarget: IO,
  ): void {
    const evidence = (artifactData.evidence ?? []) as Evidence[];
    const env = envelope({
      data: artifactData,
      source,
      executionTime: executionTimeMs,
      evidence,
    });
    const mode = pickMode(opts);
    const out = renderEnvelope(env, mode, Boolean(opts.evidence));
    writeOut(out, opts.export, ioTarget);
  }

  // lcis engineering <text...>  → generateFullEngineeringPackage (flagship)
  addEinsOptions(
    program
      .command('engineering <text...>')
      .description(
        'EINS flagship: full engineering package — blueprint, tasks, agent plan, graph, GO/CONDITIONAL_GO/NO_GO decision',
      )
      .action(async (words: string[], opts: EinsOpts) => {
        const t = new Timer();
        try {
          const eins = getEngineeringEngine();
          const req = buildFeatureRequest(words, opts);
          const result = await eins.generateFullEngineeringPackage(req);
          emitEins(result as unknown as Record<string, unknown>, 'engineering/package', t.ms(), opts, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis blueprint <text...>  → generateBlueprint (async)
  addEinsOptions(
    program
      .command('blueprint <text...>')
      .description(
        'EINS blueprint: impact + change + migration + tests + verification + rollback + launch + governance + operations gates',
      )
      .action(async (words: string[], opts: EinsOpts) => {
        const t = new Timer();
        try {
          const eins = getEngineeringEngine();
          const req = buildFeatureRequest(words, opts);
          const result = await eins.generateBlueprint(req);
          emitEins(result as unknown as Record<string, unknown>, 'engineering/blueprint', t.ms(), opts, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis tasks <text...>  → generateTasks (sync)
  addEinsOptions(
    program
      .command('tasks <text...>')
      .description(
        'EINS tasks: ordered engineering task list across all layers (migration → rpc → gateway → … → launch)',
      )
      .action((words: string[], opts: EinsOpts) => {
        const t = new Timer();
        try {
          const eins = getEngineeringEngine();
          const req = buildFeatureRequest(words, opts);
          const tasks = eins.generateTasks(req);
          // Wrap the array + provenance in a synthetic plan object for envelope consistency.
          const planData = {
            request: req,
            tasks,
            count: tasks.length,
            evidence: tasks.flatMap((task) => task.evidence),
            confidence: tasks.length > 0 ? 0.8 : 0.3,
            sources: ['graphify-out/graph.json'],
            timestamp: new Date().toISOString(),
          };
          emitEins(planData, 'engineering/tasks', t.ms(), opts, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis rollout <text...>  → generateLaunchPlan (async)
  addEinsOptions(
    program
      .command('rollout <text...>')
      .description(
        'EINS rollout plan: GO/CONDITIONAL_GO/NO_GO launch decision with blockers, checklist, readiness score',
      )
      .action(async (words: string[], opts: EinsOpts) => {
        const t = new Timer();
        try {
          const eins = getEngineeringEngine();
          const req = buildFeatureRequest(words, opts);
          const result = await eins.generateLaunchPlan(req);
          emitEins(result as unknown as Record<string, unknown>, 'engineering/rollout', t.ms(), opts, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis rollback <text...>  → generateRollbackPlan (sync)
  addEinsOptions(
    program
      .command('rollback <text...>')
      .description(
        'EINS rollback plan: readiness, steps, irreversible changes, estimated recovery time',
      )
      .action((words: string[], opts: EinsOpts) => {
        const t = new Timer();
        try {
          const eins = getEngineeringEngine();
          const req = buildFeatureRequest(words, opts);
          const result = eins.generateRollbackPlan(req);
          emitEins(result as unknown as Record<string, unknown>, 'engineering/rollback', t.ms(), opts, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis eng-verify <text...>  → generateVerificationPlan (sync)
  // Named eng-verify to avoid collision with the existing Phase-2 `lcis verify` command.
  addEinsOptions(
    program
      .command('eng-verify <text...>')
      .description(
        'EINS verification plan: required checks, coverage gaps, acceptance criteria (not the Phase-2 `verify` command)',
      )
      .action((words: string[], opts: EinsOpts) => {
        const t = new Timer();
        try {
          const eins = getEngineeringEngine();
          const req = buildFeatureRequest(words, opts);
          const result = eins.generateVerificationPlan(req);
          emitEins(result as unknown as Record<string, unknown>, 'engineering/verification', t.ms(), opts, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // lcis agent-plan <text...>  → generateAgentPlan (sync)
  addEinsOptions(
    program
      .command('agent-plan <text...>')
      .description(
        'EINS agent plan: agent task graph across agent types (backend/db/frontend/testing/docs/verification/devops)',
      )
      .action((words: string[], opts: EinsOpts) => {
        const t = new Timer();
        try {
          const eins = getEngineeringEngine();
          const req = buildFeatureRequest(words, opts);
          const result = eins.generateAgentPlan(req);
          emitEins(result as unknown as Record<string, unknown>, 'engineering/agent-plan', t.ms(), opts, io);
        } catch (err: unknown) {
          userError(err instanceof Error ? err.message : String(err), io);
          exitCode = 1;
        }
      }),
  );

  // -------------------------------------------------------------------------
  // EAOS Execution commands (Phase-8)
  // Consumes @letbuyy/lcis-orchestration (getOrchestrationEngine). READ-ONLY —
  // EAOS TRACKS execution; humans/agents execute. No fetch/exec/spawn/writeFile.
  // Every output embeds evidence/confidence/sources/timestamp/liveConnected:false;
  // live execution progress is honestly NOT_CONNECTED (no tracker wired).
  // -------------------------------------------------------------------------

  const executionGroup = program
    .command('execution')
    .description(
      'EAOS: execution & agent orchestration intelligence — report, graph, status, timeline, blockers, rollout, health',
    );

  /** Wire one EAOS subcommand: `lcis execution <name> <text...>` → facade method. */
  function addExecutionCommand(
    name: string,
    description: string,
    invoke: (
      eaos: ReturnType<typeof getOrchestrationEngine>,
      req: FeatureRequest,
    ) => Promise<{ evidence?: readonly unknown[]; confidence?: number } & Record<string, unknown>>,
  ): void {
    addEinsOptions(
      executionGroup
        .command(`${name} <text...>`)
        .description(description)
        .action(async (words: string[], opts: EinsOpts) => {
          const t = new Timer();
          try {
            const eaos = getOrchestrationEngine();
            const req = buildFeatureRequest(words, opts);
            const result = await invoke(eaos, req);
            emitEins(result, `execution/${name}`, t.ms(), opts, io);
          } catch (err: unknown) {
            userError(err instanceof Error ? err.message : String(err), io);
            exitCode = 1;
          }
        }),
    );
  }

  type EaosData = { evidence?: readonly unknown[]; confidence?: number } & Record<string, unknown>;

  addExecutionCommand(
    'report',
    'EAOS flagship: full execution package — execution/agent/artifact/validation/status/rollout/timeline + overall health',
    async (eaos, req) => (await eaos.generateFullExecutionPackage(req)) as unknown as EaosData,
  );
  addExecutionCommand(
    'graph',
    'EAOS execution graph: nodes with derived PLANNED/READY/BLOCKED status, critical path, parallelizable work',
    async (eaos, req) => (await eaos.generateExecutionReport(req)) as unknown as EaosData,
  );
  addExecutionCommand(
    'status',
    'EAOS status: per-dimension progress metrics, honest NOT_CONNECTED ETA, blocked reasons',
    async (eaos, req) => (await eaos.generateStatusReport(req)) as unknown as EaosData,
  );
  addExecutionCommand(
    'timeline',
    'EAOS timeline: milestones, critical moments, planned state transitions (live durations NOT_CONNECTED)',
    async (eaos, req) => (await eaos.generateTimelineReport(req)) as unknown as EaosData,
  );
  addExecutionCommand(
    'blockers',
    'EAOS blockers: blocked tasks (EO02), launch blockers, blocked reasons',
    async (eaos, req) => (await eaos.generateBlockersReport(req)) as unknown as EaosData,
  );
  addExecutionCommand(
    'rollout',
    'EAOS rollout: GO/CONDITIONAL_GO/NO_GO launch verdict, rollback readiness, release blockers',
    async (eaos, req) => (await eaos.generateRolloutReport(req)) as unknown as EaosData,
  );
  addExecutionCommand(
    'health',
    'EAOS health: execution/agent/validation/rollout area healths + merged overall band',
    async (eaos, req) => (await eaos.generateHealthReport(req)) as unknown as EaosData,
  );

  // -------------------------------------------------------------------------
  // version
  // -------------------------------------------------------------------------
  program
    .command('version')
    .description('Print LCIS version')
    .action(() => {
      io.stdout(LCIS_VERSION);
    });

  // -------------------------------------------------------------------------
  // Error handler — suppress stack traces
  // -------------------------------------------------------------------------
  program.exitOverride((err) => {
    if (err.exitCode === 0) process.exit(0);
    userError(err.message, io);
    process.exit(1);
  });

  try {
    await program.parseAsync(argv, { from: 'user' });
  } catch (err: unknown) {
    userError(err instanceof Error ? err.message : String(err), io);
    return 1;
  }

  return exitCode;
}

// ---------------------------------------------------------------------------
// Shebang guard
// ---------------------------------------------------------------------------

const _url = import.meta.url;
if (_url) {
  const { pathToFileURL } = await import('node:url');
  if (_url === pathToFileURL(process.argv[1]!).href) {
    const code = await run(process.argv.slice(2));
    if (code !== 0) process.exit(code);
  }
}
