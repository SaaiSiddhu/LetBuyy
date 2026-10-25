// Ordinary canonical SDK GETs after the ONE Editor fixture is allocated.
// This is a bounded assertion driver: no server, seed, auth, browser access,
// alternate commerce implementation, network replacement or mutation channel.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createLetbuyyApiClient } from '../../../../../../packages/typescript/api-client/src/index';
import { StorefrontDiscoveryMetadataSchema, StorefrontDiscoveryQuerySchema, type StorefrontDiscoveryQueryInput } from '../../../../../../packages/commerce-core/src/index';
import { UuidSchema } from '../../../../../../packages/shared-types/src/index';

type ProductKey = 'electronics' | 'charger' | 'cable' | 'unknown';
export type ReadbackBindings = {
    editorRunId: string; gatewayOrigin: string; siteId: string; subdomain: string;
    releaseId: string; releaseDigest: string;
    productIds: Record<ProductKey, string>;
    collectionIds: { 'circuit-all': string; 'circuit-empty': string };
};
type PlannedRead = { id: string; caseId: string; query: StorefrontDiscoveryQueryInput;
    expected: ProductKey[]; total: number; ordered?: boolean; diagnostic?: boolean };

export function validateBindings(input: ReadbackBindings) {
    assert.ok(input && typeof input === 'object', 'Real allocated bindings required');
    assert.equal(typeof input.editorRunId, 'string'); assert.match(input.editorRunId, /^[a-z0-9-]{6,80}$/i);
    const origin = new URL(input.gatewayOrigin);
    assert.equal(origin.protocol, 'http:'); assert.equal(origin.origin, input.gatewayOrigin);
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) || origin.hostname.endsWith('.localhost'), 'Owned local origin only');
    assert.ok(!origin.username && !origin.password && !origin.search && !origin.hash);
    UuidSchema.parse(input.siteId); UuidSchema.parse(input.releaseId); assert.match(input.releaseDigest, /^[a-f0-9]{64}$/);
    assert.match(input.subdomain, /^[a-z0-9][a-z0-9-]{1,62}$/);
    for (const key of ['electronics', 'charger', 'cable', 'unknown'] as const) UuidSchema.parse(input.productIds?.[key]);
    assert.equal(new Set(Object.values(input.productIds)).size, 4);
    for (const key of ['circuit-all', 'circuit-empty'] as const) UuidSchema.parse(input.collectionIds?.[key]);
    assert.notEqual(input.collectionIds['circuit-all'], input.collectionIds['circuit-empty']);
    return input;
}

export function readPlan(bindings: ReadbackBindings): PlannedRead[] {
    validateBindings(bindings);
    const scope = { collection_id: bindings.collectionIds['circuit-all'], limit: 10 };
    const queries: PlannedRead[] = [
        { id: 'connector-or', caseId: 'CL-07', query: { connector: ['ac-plug', 'usb-a'] }, expected: ['electronics', 'charger'], total: 2 },
        { id: 'hub-three-power-facts', caseId: 'CL-08', query: { power_input_w: 65, power_output_w: 45, pass_through_output_w: 60 }, expected: ['electronics'], total: 1 },
        { id: 'charger-output', caseId: 'CL-08', query: { power_output_w: 65 }, expected: ['charger'], total: 1 },
        { id: 'cable-capacity', caseId: 'CL-08', query: { power_capacity_w: 100 }, expected: ['cable'], total: 1 },
        { id: 'different-power-facts-not-substituted', caseId: 'CL-08', query: { power_input_w: 65, power_output_w: 65 }, expected: [], total: 0 },
        { id: 'cable-units', caseId: 'CL-09', query: { length_mm: 1000, data_rate_mbps: 480 }, expected: ['cable'], total: 1 },
        { id: 'matching-charger-price', caseId: 'CL-09', query: { electronics_kind: 'charger', max_price: 1500 }, expected: [], total: 0 },
        { id: 'product-name-search', caseId: 'CL-10', query: { search: 'Circuit lifecycle hub', category: 'Accessories', country_of_origin: 'India' }, expected: ['electronics'], total: 1 },
        { id: 'genuine-empty-search', caseId: 'CL-10', query: { search: 'Circuit no such synthetic item 9471' }, expected: [], total: 0 },
        { id: 'price-asc-page-one', caseId: 'CL-11', query: { sort: 'price-asc', page: 1, limit: 2 }, expected: ['cable', 'unknown'], total: 4, ordered: true },
        { id: 'price-asc-page-two', caseId: 'CL-11', query: { sort: 'price-asc', page: 2, limit: 2 }, expected: ['electronics', 'charger'], total: 4, ordered: true },
        { id: 'price-desc-page-one', caseId: 'CL-11', query: { sort: 'price-desc', page: 1, limit: 2 }, expected: ['charger', 'electronics'], total: 4, ordered: true },
        { id: 'known-empty-membership', caseId: 'CL-13', query: { collection_id: bindings.collectionIds['circuit-empty'] }, expected: [], total: 0 },
        { id: 'model-only-search-diagnostic', caseId: 'CL-25', query: { search: 'Synthetic H1' }, expected: ['electronics'], total: 1, diagnostic: true },
    ];
    return queries.map(item => ({ ...item, query: StorefrontDiscoveryQuerySchema.parse({ ...scope, ...item.query }) }));
}

export async function runPublicReadback(bindings: ReadbackBindings) {
    const plan = readPlan(bindings), client = createLetbuyyApiClient({ baseUrl: bindings.gatewayOrigin });
    const store = await client.storefront.getStore(bindings.subdomain, { cache: 'no-store' });
    assert.equal(store.id, bindings.siteId, 'API must resolve the allocated site');
    assert.equal(store.current_theme_release?.id, bindings.releaseId, 'Another theme lease must not be labelled as the active Circuit release');
    const hub = await client.storefront.getProduct(bindings.subdomain, bindings.productIds.electronics, { cache: 'no-store' });
    assert.equal(hub.id, bindings.productIds.electronics); assert.equal(hub.name, 'Circuit lifecycle hub'); assert.equal(Number(hub.price), 1200, 'Run baseline queries before CL-22 catalog mutation');
    const results: Array<Record<string, unknown>> = [];
    for (const item of plan) {
        const startedAt = new Date().toISOString(), requestIdSent = crypto.randomUUID();
        let observed: Record<string, unknown> | undefined;
        try {
            const response = await client.storefront.listProducts(bindings.subdomain, item.query, { cache: 'no-store', headers: { 'X-Request-ID': requestIdSent } });
            observed = { ids: response.data.map(row => row.id), total: response.total, page: response.page, limit: response.limit,
                hasMore: response.has_more, publicRows: response.data, discovery: response.discovery };
            const discovery = StorefrontDiscoveryMetadataSchema.parse(response.discovery);
            const actualIds = response.data.map(row => row.id), expectedIds = item.expected.map(key => bindings.productIds[key]);
            assert.deepEqual(discovery.query, StorefrontDiscoveryQuerySchema.parse(item.query));
            // This route publishes page/per_page/total, without the optional
            // total_is_exact marker used by other list contracts. Compare its
            // actual total with the exact normal-UI fixture membership instead.
            assert.equal(response.total, item.total);
            assert.equal(response.page, item.query.page); assert.equal(response.limit, item.query.limit);
            assert.equal(new Set(actualIds).size, actualIds.length);
            assert.deepEqual(discovery.matches.map(row => row.product_id), actualIds);
            assert.deepEqual(item.ordered ? actualIds : [...actualIds].sort(), item.ordered ? expectedIds : [...expectedIds].sort());
            results.push({ id: item.id, caseId: item.caseId, status: 'PASS', query: item.query, actualIds, expectedIds,
                total: response.total, page: response.page, limit: response.limit, hasMore: response.has_more,
                sdkTotalIsExactMarker: response.total_is_exact,
                discovery, requestIdSent, startedAt, finishedAt: new Date().toISOString() });
        } catch (error) {
            results.push({ id: item.id, caseId: item.caseId, status: 'FAIL', diagnostic: item.diagnostic ?? false, query: item.query,
                error: error instanceof Error ? error.message : 'Readback failed', observed, requestIdSent, startedAt, finishedAt: new Date().toISOString() });
        }
    }
    return { classification: 'REAL_ALLOCATED_PUBLIC_API_READBACK_ONLY', editorRunId: bindings.editorRunId,
        siteId: bindings.siteId, releaseId: bindings.releaseId, releaseDigest: bindings.releaseDigest,
        browserCasesCompleted: 0, mutationCommands: 0, finalAcceptanceClaimed: false, results };
}

async function main() {
    const args = process.argv.slice(2); assert.equal(args.length, 6, 'Use --bindings PATH --allocation PATH --output NEW_PATH');
    const values = Object.fromEntries([0, 2, 4].map(i => [args[i], args[i + 1]]));
    assert.deepEqual(Object.keys(values).sort(), ['--allocation', '--bindings', '--output']);
    const allocationBytes = readFileSync(values['--allocation']);
    const allocation = JSON.parse(allocationBytes.toString()) as { runId: string; siteId: string; owner: string; status: string };
    const bindings = validateBindings(JSON.parse(readFileSync(values['--bindings'], 'utf8')) as ReadbackBindings);
    assert.equal(allocation.runId, bindings.editorRunId); assert.equal(allocation.siteId, bindings.siteId);
    assert.equal(allocation.status, 'ALLOCATED'); assert.equal(allocation.owner, 'Circuit');
    const report = await runPublicReadback(bindings);
    const evidence = { ...report, allocationSha256: createHash('sha256').update(allocationBytes).digest('hex') };
    writeFileSync(values['--output'], JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
    const failed = report.results.filter(item => item.status === 'FAIL').length;
    process.stdout.write(JSON.stringify({ output: values['--output'], publicReadChecks: report.results.length, failed, browserCasesCompleted: 0 }) + '\n');
    if (failed) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main().catch(error => { process.stderr.write((error instanceof Error ? error.message : 'Readback refused') + '\n'); process.exitCode = 1; });
