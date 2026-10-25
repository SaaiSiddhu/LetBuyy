// Root's finite early diagnostic: four SDK GETs and at most two repeat GETs
// solely to retain exact HTTP status, which the SDK does not return on success.
// No browser/session access, mutation, credential, fetch replacement or proxy.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { createLetbuyyApiClient } from '../../../../../../packages/typescript/api-client/src/index';
import { readElectronicsFacts, StorefrontDiscoveryQuerySchema, StorefrontDiscoveryMetadataSchema, storefrontDiscoveryUrl } from '../../../../../../packages/commerce-core/src/index';

const origin = 'http://127.0.0.1:57229', handle = 'syn-threadline-ui-d11a8917';
const siteId = '7dfc2cb7-b06e-411c-9b2a-0b44882705be', hubId = '169ce9c6-d30a-4abf-b1e0-58a771ab88bd';
const root = new URL('../../../../../../', import.meta.url), out = new URL('./', import.meta.url);
const paths = ['packages/typescript/api-client/src/index.ts', 'packages/commerce-core/src/storefront-discovery.ts',
    'packages/commerce-core/src/circuit-facts.ts', 'services/api-gateway/src/lib/storefront-discovery.ts',
    'database/supabase/migrations/386_storefront_discovery.sql', 'database/supabase/migrations/390_storefront_measurement_capabilities.sql',
    'packages/theme-engine/src/circuit-discovery.ts'];
const sourceHashes = () => Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex')]));
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const report: Record<string, unknown> = { classification: 'EARLY_REAL_PUBLIC_CANONICAL_SEARCH_DIAGNOSTIC_NOT_CIRCUIT_UI_ACCEPTANCE',
    runId: '9cd50e893016', gatewayOrigin: origin, handle, siteId, hubId,
    grant: { sourceThreadId: '01a164a4-a342-76d3-ab33-65e021ed57db', scope: '4 logical SDK GETs, maximum6 HTTP; published Dewdrop context; no Circuit activation' },
    startedAt: new Date().toISOString(), installedCircuitCasesCompleted: 0, installedCircuitStatus: 'NOT_RUN',
    sdkCalls: [], exactHttpReadbacks: [], sourceStartHashes: sourceHashes(), sourceEndHashes: {}, findings: [] };
const sdkCalls = report.sdkCalls as Array<Record<string, unknown>>, http = report.exactHttpReadbacks as Array<Record<string, unknown>>;
const client = createLetbuyyApiClient({ baseUrl: origin });
const headers = () => ({ 'X-Request-ID': randomUUID() });
async function main() {
    try {
        const storeHeaders = headers();
        const store = await client.storefront.getStore(handle, { cache: 'no-store', headers: storeHeaders });
        sdkCalls.push({ operation: 'getStore', path: `/v1/storefront/${handle}`, requestIdSent: storeHeaders['X-Request-ID'], successfulHttpClass: '2xx', id: store.id });
        assert.equal(store.id, siteId);
        const release = record(store.current_theme_release), snapshot = record(release.snapshot), bundle = record(snapshot.liquidBundle);
        report.activePublishedContext = { themeId: store.theme_id, currentReleaseId: store.current_theme_release_id,
            exposedReleaseId: release.id, exposedPackageVersion: record(bundle.package).version, sourceDraftVersion: release.sourceDraftVersion, schemaManifestVersion: release.schema_manifest_version };

        const productHeaders = headers();
        const product = await client.storefront.getProduct(handle, hubId, { cache: 'no-store', headers: productHeaders });
        sdkCalls.push({ operation: 'getProduct', path: `/v1/storefront/${handle}/products/${hubId}`, requestIdSent: productHeaders['X-Request-ID'], successfulHttpClass: '2xx', id: product.id });
        assert.equal(product.id, hubId); assert.equal(product.name, 'Circuit lifecycle hub');
        const facts = readElectronicsFacts(product.metadata);
        assert.ok(facts, 'Actual public DTO must contain canonical validated electronics facts');
        assert.equal(facts.model, 'Synthetic H1');
        report.actualHub = { id: product.id, name: product.name, slug: product.slug, price: product.price,
            exposedVersion: record(product).version, facts, variants: product.variants };

        const cases = [
            { id: 'positive-product-name', search: product.name, expectedHub: true },
            { id: 'model-only', search: facts.model, expectedHub: true },
        ];
        const observations: Array<Record<string, unknown>> = [];
        for (const item of cases) {
            const query = StorefrontDiscoveryQuerySchema.parse({ search: item.search, limit: 20 }), requestHeaders = headers();
            const result = await client.storefront.listProducts(handle, query, { cache: 'no-store', headers: requestHeaders });
            const discovery = StorefrontDiscoveryMetadataSchema.parse(result.discovery), ids = result.data.map(row => row.id);
            assert.deepEqual(discovery.query, query);
            sdkCalls.push({ operation: item.id, query, requestIdSent: requestHeaders['X-Request-ID'], successfulHttpClass: '2xx', matchingUuids: ids, total: result.total });
            observations.push({ id: item.id, query, matchingUuids: ids, total: result.total, hasExpectedHub: ids.includes(hubId),
                publicRows: result.data, discovery });
        }
        report.searchObservations = observations;

        // The successful SDK response intentionally has no exact HTTP-status
        // field. These two ordinary canonical GET repeats use the granted6-HTTP
        // ceiling, preserve their raw response, and replace/intercept nothing.
        for (const observation of observations) {
            const path = storefrontDiscoveryUrl(`/v1/storefront/${handle}/products`, observation.query), requestHeaders = headers();
            const response = await fetch(new URL(path, origin), { method: 'GET', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json', ...requestHeaders } });
            const body: unknown = await response.json();
            http.push({ operation: observation.id, path, status: response.status, requestIdSent: requestHeaders['X-Request-ID'],
                requestIdReturned: response.headers.get('X-Request-ID'), response: body });
            assert.equal(response.status, 200);
        }
        assert.equal(observations[0].hasExpectedHub, true, 'Positive control must find the real existing hub');
        if (!observations[1].hasExpectedHub) {
            (report.findings as unknown[]).push({ id: 'CIRCUIT-SEARCH-MODEL-001', scope: 'CANONICAL_PUBLIC_API_WITH_REAL_OWNED_DATA_NOT_CIRCUIT_UI',
                positiveControl: 'Actual product name finds actual hub UUID', failingQuery: 'Synthetic H1',
                actualHubModel: facts.model, activeTheme: 'Dewdrop', expectedUuid: hubId,
                owner: 'Existing canonical storefront discovery owner plus Circuit search-copy owner',
                source: '386_storefront_discovery.sql:317 searches name/description/tags/books_author; Circuit search label promises models/connectors.',
                proposedScope: 'Root to choose bounded completion of existing canonical search or honest versioned copy correction. No local filter, seeded model title, parallel index or production change by this diagnostic.' });
            report.status = 'FAIL_MODEL_SEARCH_WITH_POSITIVE_CONTROL';
            process.exitCode = 1;
        } else report.status = 'PASS_CANONICAL_MODEL_DIAGNOSTIC';
    } catch (error) {
        report.status = 'DIAGNOSTIC_REFUSED_OR_FAILED'; report.error = error instanceof Error ? error.message : 'Diagnostic failed'; process.exitCode = 1;
    } finally {
        report.sourceEndHashes = sourceHashes(); report.finishedAt = new Date().toISOString();
        report.sourceStable = JSON.stringify(report.sourceStartHashes) === JSON.stringify(report.sourceEndHashes);
        report.logicalSdkGetCalls = sdkCalls.length; report.additionalStatusGetCalls = http.length;
        writeFileSync(new URL('report.json', out), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
        process.stdout.write(JSON.stringify({ status: report.status, sdkGetCalls: sdkCalls.length, statusGetCalls: http.length,
            findings: (report.findings as unknown[]).length, sourceStable: report.sourceStable, installedCircuitCasesCompleted: 0 }) + '\n');
    }
}
void main();
