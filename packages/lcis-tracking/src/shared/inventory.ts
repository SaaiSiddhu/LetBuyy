/**
 * Inventory readers — build the typed SnapshotInventory for the semantic diff from the
 * REAL structural artifacts (db-intel / infra-intel / graph metadata) via the read-only
 * ArtifactStore. Zod-validated loose: unknown artifact shapes degrade to empty inventories
 * with honest evidence, never a throw and never fabrication.
 */
import { type Evidence, type LcisEngine, evidence, notConnected } from '@letbuyy/lcis-core';
import { z } from 'zod';
import type { SnapshotInventory } from './types';

const NamedSchema = z.object({ name: z.string() }).loose();

const DbIntelSchema = z
  .object({
    tables: z.array(NamedSchema).optional(),
    rpcs: z.array(NamedSchema).optional(),
    policies: z.array(z.object({ name: z.string().optional(), table: z.string().optional() }).loose()).optional(),
    triggers: z.array(NamedSchema).optional(),
  })
  .loose();

const InfraIntelSchema = z
  .object({
    workers: z.array(NamedSchema).optional(),
    queues: z.array(NamedSchema).optional(),
    routes: z.array(z.object({ path: z.string().optional(), name: z.string().optional() }).loose()).optional(),
    packages: z.array(NamedSchema).optional(),
  })
  .loose();

export interface InventoryRead {
  readonly inventory: SnapshotInventory;
  readonly evidence: readonly Evidence[];
}

function names(list: readonly { name?: string }[] | undefined): string[] {
  return [...new Set((list ?? []).map((x) => x.name).filter((n): n is string => typeof n === 'string' && n.length > 0))].sort();
}

/** The CURRENT inventory, read from live structural artifacts. */
export function readCurrentInventory(core: LcisEngine, now: () => string): InventoryRead {
  const ev: Evidence[] = [];
  let tables: string[] = [];
  let rpcs: string[] = [];
  let policies: string[] = [];
  let triggers: string[] = [];
  let workers: string[] = [];
  let queues: string[] = [];
  let routes: string[] = [];
  let packages: string[] = [];

  const dbRaw = core.store.has('db-intel.json') ? core.store.tryRead('db-intel.json') : null;
  if (dbRaw !== null) {
    const parsed = DbIntelSchema.safeParse(dbRaw);
    if (parsed.success) {
      tables = names(parsed.data.tables);
      rpcs = names(parsed.data.rpcs);
      policies = [...new Set((parsed.data.policies ?? []).map((p) => p.name ?? `${p.table ?? 'unknown'}-policy`))].sort();
      triggers = names(parsed.data.triggers);
      ev.push(evidence('artifact-field', 'db-intel.json', `${tables.length} tables, ${rpcs.length} rpcs, ${policies.length} policies, ${triggers.length} triggers`, 'graphify-out/db-intel.json'));
    } else {
      ev.push(evidence('artifact-field', 'db-intel.json', 'unexpected shape — db inventory empty (not fabricated)', 'graphify-out/db-intel.json'));
    }
  } else {
    ev.push(notConnected('inventory:db', 'graphify-out/db-intel.json (run pnpm graph:db)'));
  }

  const infraRaw = core.store.has('infra-intel.json') ? core.store.tryRead('infra-intel.json') : null;
  if (infraRaw !== null) {
    const parsed = InfraIntelSchema.safeParse(infraRaw);
    if (parsed.success) {
      workers = names(parsed.data.workers);
      queues = names(parsed.data.queues);
      routes = [...new Set((parsed.data.routes ?? []).map((r) => r.path ?? r.name).filter((x): x is string => typeof x === 'string'))].sort();
      packages = names(parsed.data.packages);
      ev.push(evidence('artifact-field', 'infra-intel.json', `${workers.length} workers, ${queues.length} queues, ${routes.length} routes, ${packages.length} packages`, 'graphify-out/infra-intel.json'));
    } else {
      ev.push(evidence('artifact-field', 'infra-intel.json', 'unexpected shape — infra inventory empty (not fabricated)', 'graphify-out/infra-intel.json'));
    }
  } else {
    ev.push(notConnected('inventory:infra', 'graphify-out/infra-intel.json (run pnpm graph:infra)'));
  }

  return {
    inventory: { label: 'current', at: now(), tables, rpcs, policies, triggers, workers, queues, routes, packages },
    evidence: ev,
  };
}

/** An empty inventory (the honest zero for tests and absent archives). */
export function emptyInventory(label: string, at: string | null = null): SnapshotInventory {
  return { label, at, tables: [], rpcs: [], policies: [], triggers: [], workers: [], queues: [], routes: [], packages: [] };
}
