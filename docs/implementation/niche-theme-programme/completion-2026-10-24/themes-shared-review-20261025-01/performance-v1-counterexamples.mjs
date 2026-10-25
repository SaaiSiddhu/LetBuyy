// Pure review counterexamples against exact sealed preparation functions.
// SQL/child-process seams are inert model stubs. No native, network, Docker or DB execution.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { StorefrontDiscoveryQuerySchema } from '../../../../../packages/commerce-core/src/storefront-discovery.ts';

// Use the target suite's declaring runtime dependency, not an undeclared root import.
const { z } = createRequire(new URL('../../../../../services/api-gateway/package.json', import.meta.url))('zod');

const file = '/private/tmp/letbuyy-circuit-performance-prep-20261025-01/circuit-indexed-performance-qualification.manual.ts';
const source = readFileSync(file, 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
assert.equal(sha(source), 'f311aaaaa156dc9cbf21dd19efce7b9a1fa8eb4cd7dbc80056c177498e8d148d');
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const names = ['jsonObjectAt', 'nodes', 'innerPlan'];
const functions = tree.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
assert.equal(functions.length, 3);
const emitted = ts.transpileModule(functions.map(node => node.getText(tree)).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const siteId = '11111111-1111-4111-8111-111111111111', pid = 123;
const queryText = 'WITH base AS MATERIALIZED (SELECT * FROM public.products p WHERE p.store_id = p_store_id) SELECT * FROM base';
const products = { 'Node Type': 'Seq Scan', 'Relation Name': 'products' };
const foreignIndex = { 'Node Type': 'Index Scan', 'Relation Name': 'unrelated_relation', 'Index Cond': `(store_id = '${siteId}'::uuid)` };
const productIndex = { 'Node Type': 'Index Scan', 'Relation Name': 'products', 'Index Cond': `(store_id = '${siteId}'::uuid)` };
const plan = child => ({ 'Query Text': queryText, Plan: { 'Node Type': 'Nested Loop', Plans: [products, child] } });
const f = { n: 1000, site: { siteId } }, c = { key: 'manufacturer-evidence', query: { electronics_manufacturer: 'MakerA', compatibility_evidence: 'supplied' } };
function probe(logText) {
  let stubSqlCalls = 0, stubLogCalls = 0;
  const context = vm.createContext({
    assert, z, sha, StorefrontDiscoveryQuerySchema,
    q: value => "'" + value.replaceAll("'", "''") + "'",
    j: value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb",
    owned: { runId: 'pure-review-model', container: 'model-no-container', scriptLarge() {
      stubSqlCalls++; return JSON.stringify({ pid, marker: 'lbperf-pure-review-model-1000-manufacturer-evidence' });
    } },
    spawnSync() { stubLogCalls++; return { status: 0, stdout: logText, stderr: '' }; },
    record() {}, f, c,
  });
  vm.runInContext(emitted + '\nglobalThis.result = innerPlan(f,c);', context, { timeout: 1000 });
  return { accepted: context.result.indexedTenantPredicate, attributedPid: context.result.pid, productsNodes: context.result.products.length,
    acceptedIndexRelations: Array.from(context.result.indexNodes, node => node['Relation Name']), stubSqlCalls, stubLogCalls };
}
const wrongRelation = probe(`[${pid}] LOG: duration: 1 ms plan:\n${JSON.stringify(plan(foreignIndex))}\n`);
assert.equal(wrongRelation.accepted, true);
assert.deepEqual(wrongRelation.acceptedIndexRelations, ['unrelated_relation']);
const wrongPid = probe(`[${pid}] LOG: duration: 1 ms plan:\nMISSING_JSON_RECORD\n[456] LOG: duration: 2 ms plan:\n${JSON.stringify(plan(productIndex))}\n`);
assert.equal(wrongPid.accepted, true);
assert.equal(wrongPid.attributedPid, pid);
const report = { recordedAt: new Date().toISOString(), classification: 'PURE_MODEL_COUNTEREXAMPLES_USING_EXACT_SEALED_V1_FUNCTIONS_NOT_NATIVE',
  suiteSha256: sha(source), reproduced: [
    { finding: 'PERF-R02', counterexample: 'Sequential products scan plus unrelated relation index is wrongly accepted', observed: wrongRelation },
    { finding: 'PERF-R05', counterexample: 'Missing JSON for expected PID skips forward and accepts another PID record', observed: wrongPid },
  ], actualSQLCalls: 0, actualChildProcesses: 0, DockerDatabaseBrowserProviderNetworkActions: 0 };
writeFileSync(new URL('./PERFORMANCE_V1_COUNTEREXAMPLES.json', import.meta.url), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ counterexamplesReproduced: report.reproduced.length, nativeActions: 0 }) + '\n');
