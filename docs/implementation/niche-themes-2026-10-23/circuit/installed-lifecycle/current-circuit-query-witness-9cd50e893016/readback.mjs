// Root's finite two-GET allocation after native392 cleanup. No browser, session,
// mutation, redirect, retry, interception or additional product/store request.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../../../../../../', import.meta.url), out = new URL('./', import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
const read = path => readFileSync(new URL(path, root));
const sourcePath = 'docs/implementation/theme-editor-2026-10-23/evidence/circuit-actual-name-model-search.json';
const observedBytes = read(sourcePath), observed = JSON.parse(observedBytes);
const publicationPath = 'docs/implementation/theme-editor-2026-10-23/evidence/circuit-reapply-B-proof.json';
const publicationBytes = read(publicationPath), publication = JSON.parse(publicationBytes);
const paths = ['packages/typescript/api-client/src/index.ts', 'packages/commerce-core/src/storefront-discovery.ts',
    'packages/commerce-core/src/circuit-facts.ts', 'services/api-gateway/src/lib/storefront-discovery.ts',
    'services/api-gateway/src/routes/storefront/public-routes.ts', 'database/supabase/migrations/390_storefront_measurement_capabilities.sql'];
const pins = () => Object.fromEntries(paths.map(path => [path, sha(read(path))]));
const report = { classification: 'TWO_CANONICAL_GET_CURRENT_BASELINE_QUERY_WITNESS_NOT_FULL_CASE_ACCEPTANCE',
    runId: '9cd50e893016', isolatedNative392: { runId: '3273631a2c5b', pass: 8, cleanupCompletedBeforeTheseGets: true },
    publicationContext: { kind: 'EDITOR_RECORDED_CONTEXT_NOT_INFERRED_FROM_PRODUCT_DTO', path: publicationPath,
        sha256: sha(publicationBytes), ...publication },
    uiQueryEvidence: { path: sourcePath, sha256: sha(observedBytes) },
    expectedSiteId: '7dfc2cb7-b06e-411c-9b2a-0b44882705be', expectedHubId: '169ce9c6-d30a-4abf-b1e0-58a771ab88bd',
    currentDatabaseCeilingFromEditorRecord: observed.currentDatabaseThroughMigration,
    startedAt: new Date().toISOString(), sourceBefore: pins(), fetchInvocations: 0, calls: [], status: 'IN_PROGRESS' };
try {
    assert.equal(observed.runId, report.runId); assert.equal(publication.packageVersion, '2.0.0');
    for (const [key, search, count] of [['name', 'Circuit lifecycle hub', 1], ['model', 'Synthetic H1', 0]]) {
        const ui = new URL(observed[key].url);
        assert.equal(ui.origin, 'http://syn-threadline-ui-d11a8917.localhost:57226');
        assert.equal(ui.pathname, '/store/syn-threadline-ui-d11a8917/search');
        assert.equal(ui.searchParams.get('collection_id'), 'a290425e-3d7f-4c76-9550-91d411415737');
        assert.equal(ui.searchParams.get('search'), search);
        const url = 'http://127.0.0.1:57229/v1/storefront/syn-threadline-ui-d11a8917/products' + ui.search;
        report.fetchInvocations++;
        const response = await fetch(url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000) });
        const text = await response.text();
        writeFileSync(new URL(key + '.public-response.json', out), text, { flag: 'wx' });
        const value = JSON.parse(text);
        report.calls.push({ key, uiUrl: ui.href, exactQueryString: ui.search, canonicalUrl: url,
            status: response.status, requestId: response.headers.get('x-request-id'), bodySha256: sha(text),
            rawPublicBody: key + '.public-response.json', total: value.meta?.total, productIds: value.data?.map(row => row.id) });
        assert.equal(response.status, 200); assert.equal(value.meta?.total, count);
        assert.deepEqual(value.data?.map(row => row.id), count ? [report.expectedHubId] : []);
        if (count) assert.equal(value.data[0].metadata?.electronics?.model, 'Synthetic H1');
    }
    report.status = 'BASELINE_MODEL_MISS_REPRODUCED_WITH_NAME_POSITIVE';
} catch (error) {
    report.status = 'FAILED_NO_RETRY'; report.error = { name: error.name, message: error.message };
    throw error;
} finally {
    report.sourceAfter = pins(); report.sourceConserved = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
    report.finishedAt = new Date().toISOString();
    writeFileSync(new URL('report.json', out), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ status: report.status, fetchInvocations: report.fetchInvocations, returnedPublicResponses: report.calls.length,
        sourceConserved: report.sourceConserved, modelFixLive: false }) + '\n');
}
