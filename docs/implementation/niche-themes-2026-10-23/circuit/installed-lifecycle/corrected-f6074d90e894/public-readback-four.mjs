// Finite Root allocation: at most four anonymous GETs, without retry or redirect.
// Dewdrop is the published context. This is NOT Circuit installed/UI acceptance.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const out = new URL('./', import.meta.url), root = new URL('../../../../../../', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const write = (name, value) => writeFileSync(new URL(name, out), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const preparedBytes = readFileSync(new URL('prepared-public-queries.json', out));
assert.equal(sha(preparedBytes), 'b8253e165b2d3c03d33c3178022e58924fe7d0bf5ade589a533379e3815d0144');
const prepared = JSON.parse(preparedBytes);
const contextPath = 'docs/implementation/theme-editor-2026-10-23/evidence/corrected-dewdrop-publication-A-proof.json';
const contextBytes = readFileSync(new URL(contextPath, root)), context = JSON.parse(contextBytes);
assert.equal(sha(contextBytes), '85109191680a2f4ad43f7f1b4363e5a32d4cd949f157c5f6d1e0cf91624974a1');
assert.equal(context.runId, 'f6074d90e894');
assert.equal(context.proofStatus, 200);
assert.equal(context.proof.releaseId, 'c68c4117-a6f1-430a-b321-ac76c5e7b145');
assert.equal(context.proof.sourceDraftVersion, 4);
assert.equal(context.publicReadback.httpStatus, 200);
assert.equal(context.publicReadback.expectedFound, true);
assert.equal(prepared.queries.length, 4);
assert.deepEqual(prepared.queries.map(q => q.id), ['name-positive', 'model', 'connector-usb-c', 'connector-usb-a']);
for (const q of prepared.queries) {
    const url = new URL(q.apiUrl);
    assert.equal(url.origin, 'http://127.0.0.1:62083');
    assert.equal(url.pathname, '/v1/storefront/syn-threadline-ui-33be9d94/products');
    assert.equal(url.searchParams.get('collection_id'), '270aa77e-0162-4b7d-a074-57712ab96e74');
}
const sourceBefore = prepared.sourceInputs.map(pin => ({ path: pin.path, sha256: sha(readFileSync(pin.path)) }));
assert.deepEqual(sourceBefore, prepared.sourceInputs);
const factsModule = prepared.sourceInputs.find(pin => pin.path.endsWith('/circuit-facts.ts'));
const { readElectronicsFacts } = await import(pathToFileURL(factsModule.path).href);
const allocation = {
    recordedAt: new Date().toISOString(), runId: 'f6074d90e894', maxActualHttpRequests: 4,
    grantedBy: 'Themes coordinator 01a164a4-a342-76d3-ab33-65e021ed57db',
    allocation: 'Explicit four prepared canonical GET release after verified Dewdrop public release; no authentication, mutation, retries, new endpoints, or Circuit UI acceptance.',
    context: { theme: 'Dewdrop', path: contextPath, sha256: sha(contextBytes), ...context.proof },
    queryPreparationSha256: sha(preparedBytes),
};
// Exclusive marker prevents accidentally spending the finite allocation twice.
write('public-get-allocation-consumed.json', allocation);
const report = {
    classification: 'FINITE_FOUR_PUBLIC_BACKEND392_CHECKS_WHILE_DEWDROP_PUBLISHED_NOT_CIRCUIT_UI_ACCEPTANCE',
    runId: 'f6074d90e894', startedAt: new Date().toISOString(), publicationContext: allocation.context,
    expectedSiteId: prepared.publicBindings.site.siteId,
    expectedHubId: prepared.publicBindings.electronics.id,
    startupProductVersionHistoricalOnly: prepared.publicBindings.electronics.productVersionAtStartup,
    currentProductVersion: 'NOT_INFERRED_FROM_PUBLIC_DTO', sourceBefore,
    fetchInvocations: 0, calls: [], noAuthenticationSupplied: true, redirectsFollowed: 0, retries: 0,
};
try {
    for (const query of prepared.queries) {
        const call = { id: query.id, canonicalUrl: query.apiUrl, exactQueryString: new URL(query.apiUrl).search };
        report.calls.push(call);
        report.fetchInvocations++;
        try {
            const response = await fetch(query.apiUrl, { method: 'GET', redirect: 'error', credentials: 'omit',
                headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
            const body = Buffer.from(await response.arrayBuffer());
            call.status = response.status;
            call.requestId = response.headers.get('x-request-id');
            call.bodySha256 = sha(body);
            call.rawPublicBody = `${query.id}.public-response.json`;
            writeFileSync(new URL(call.rawPublicBody, out), body, { flag: 'wx' });
            const dto = JSON.parse(body.toString('utf8'));
            call.total = dto.meta?.total;
            call.productIds = Array.isArray(dto.data) ? dto.data.map(row => row.id) : [];
            assert.equal(response.status, 200);
            assert.equal(typeof call.requestId, 'string');
            assert(call.requestId.length > 0);
            assert.equal(dto.success, true);
            assert.equal(call.total, query.expectedTotal);
            assert.deepEqual(call.productIds, query.expectedProductIds);
            const product = dto.data[0];
            const facts = readElectronicsFacts(product.metadata);
            assert(facts);
            assert.equal(product.store_id, report.expectedSiteId);
            assert.equal(product.name, 'Circuit lifecycle hub');
            assert.equal(product.price, 1200);
            assert.equal(product.stock, 8);
            assert.deepEqual(product.images, []);
            assert.deepEqual(product.product_options, []);
            assert.deepEqual(product.product_variants, []);
            assert.equal(facts.model, 'Synthetic H1');
            assert.equal(facts.power_input_w, 65);
            assert.equal(facts.power_output_w, 45);
            assert.equal(facts.pass_through_output_w, 60);
            assert.deepEqual(facts.connectors, [{ kind: 'usb-c', role: 'power-input', count: 1 },
                { kind: 'usb-c', role: 'power-output', count: 2 }, { kind: 'usb-a', role: 'data', count: 1 }]);
            assert.deepEqual(facts.box_contents, [{ label: 'Hub', quantity: 1 }]);
            assert.deepEqual(facts.compatible_devices, []);
            call.actualPublicProduct = { id: product.id, siteId: product.store_id, name: product.name,
                price: product.price, stock: product.stock, images: product.images,
                productOptions: product.product_options, productVariants: product.product_variants, electronics: facts };
            call.result = 'PASS';
        } catch (error) {
            call.result = 'FAIL';
            call.error = error instanceof Error ? error.message : String(error);
            if (query.id === 'name-positive') break;
        }
    }
} finally {
    report.sourceAfter = prepared.sourceInputs.map(pin => ({ path: pin.path, sha256: sha(readFileSync(pin.path)) }));
    report.sourceConserved = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
    report.status = report.fetchInvocations === 4 && report.calls.every(call => call.result === 'PASS') && report.sourceConserved
        ? 'PASS_ALL_FOUR_BACKEND_PUBLIC_SEARCH_CHECKS' : 'FAIL_OR_INCOMPLETE_NO_RETRY';
    report.finishedAt = new Date().toISOString();
    report.fullCaseAcceptanceClaimed = false;
    report.circuitThemeUiAcceptanceClaimed = false;
    write('public-readback-four-report.json', report);
}
process.stdout.write(JSON.stringify({ runId: report.runId, publishedTheme: 'Dewdrop', status: report.status,
    fetchInvocations: report.fetchInvocations, sourceConserved: report.sourceConserved,
    calls: report.calls.map(({ id, status, requestId, bodySha256, total, productIds, result }) =>
        ({ id, status, requestId, bodySha256, total, productIds, result })) }) + '\n');
if (report.status !== 'PASS_ALL_FOUR_BACKEND_PUBLIC_SEARCH_CHECKS') process.exitCode = 1;
