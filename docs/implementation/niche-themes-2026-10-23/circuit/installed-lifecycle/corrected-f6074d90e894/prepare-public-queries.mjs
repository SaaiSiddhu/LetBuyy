// Root's fresh-runtime preparation allocation. Reads only the public startup
// whitelist and supplied fixture source. Performs ZERO HTTP/database/UI calls.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = new URL('../../../../../../', import.meta.url), out = new URL('./', import.meta.url);
const receiptPath = 'docs/implementation/niche-theme-programme/editor-latest392-startup-admission.json';
const receiptBytes = readFileSync(new URL(receiptPath, root)), receipt = JSON.parse(receiptBytes);
assert.equal(sha(receiptBytes), 'f88fb010e7ded3a924376ab33ef3790468aad786f6f41c0d7bf341016e8cf6ae');
assert.equal(receipt.runId, 'f6074d90e894');
assert.deepEqual([...receipt.productionAppsReady].sort(), ['commerce', 'identity', 'merchant']);
assert.equal(receipt.tls.mode, 'manual-os-trusted');
const privateReference = receipt.privateStateReferenceOnly;
const privatePath = typeof privateReference === 'string' ? privateReference : privateReference.path;
assert(privatePath.startsWith('/private/tmp/'));
const state = JSON.parse(readFileSync(privatePath, 'utf8'));
assert.equal(state.runId, receipt.runId);
// Never serialize the state object, credentials, buyer/session or observation data.
const electronics = state.editorCatalog.products.electronics;
const collection = state.editorCatalog.collections.electronics;
assert.equal(collection.store_id, receipt.site.siteId);
assert.deepEqual(collection.product_ids, [electronics.id]);
assert.deepEqual(electronics.variantIds, []);
assert(Number.isInteger(electronics.version) && electronics.version > 0);
const product = collection.products.find(row => row.id === electronics.id);
assert(product && product.is_active && product.price === 1200);
const candidate = receipt.candidate;
const contractPath = resolve(candidate, 'packages/commerce-core/src/storefront-discovery.ts');
const factsPath = resolve(candidate, 'packages/commerce-core/src/circuit-facts.ts');
const fixturePath = resolve(candidate, 'services/api-gateway/src/__tests__/owned-db/threadline-qa-fixture.ts');
const { StorefrontDiscoveryQuerySchema, storefrontDiscoveryUrl } = await import(pathToFileURL(contractPath).href);
const { ElectronicsFactsSchema } = await import(pathToFileURL(factsPath).href);
const fixtureBytes = readFileSync(fixturePath), fixtureSource = fixtureBytes.toString('utf8');
const suppliedLine = fixtureSource.split('\n').find(line => line.trimStart().startsWith('{"key": "electronics",'));
assert(suppliedLine, 'Exact supplied electronics fixture record required');
const supplied = JSON.parse(suppliedLine.trim().replace(/,$/, '')).createFields;
const facts = ElectronicsFactsSchema.parse(supplied.metadata.electronics);
assert.equal(product.name, supplied.name); assert.equal(product.price, supplied.price);
assert.equal(facts.model, 'Synthetic H1');
const kinds = [...new Set(facts.connectors.map(row => row.kind))].sort();
assert.deepEqual(kinds, ['usb-a', 'usb-c']);
const scope = { limit: 20, sort: 'display_order', category: supplied.category,
    country_of_origin: supplied.country_of_origin, collection_id: collection.collection_id };
const apiPath = `/v1/storefront/${receipt.site.subdomain}/products`;
const uiPath = `/store/${receipt.site.subdomain}/search`;
const queries = [['name-positive', supplied.name], ['model', facts.model], ['connector-usb-c', 'usb-c'], ['connector-usb-a', 'usb-a']].map(([id, search]) => {
    const query = StorefrontDiscoveryQuerySchema.parse({ ...scope, search });
    return { id, query, apiUrl: receipt.origins.apiOrigin + storefrontDiscoveryUrl(apiPath, query),
        uiUrl: receipt.origins.commerceOrigin + storefrontDiscoveryUrl(uiPath, query),
        expectedProductIds: [electronics.id], expectedTotal: 1 };
});
const metadata = { runId: receipt.runId, site: receipt.site, origins: {
    apiOrigin: receipt.origins.apiOrigin, commerceOrigin: receipt.origins.commerceOrigin, checkoutOrigin: receipt.origins.checkoutOrigin },
    electronics: { id: electronics.id, productVersionAtStartup: electronics.version, variantIds: electronics.variantIds,
        nameAtStartup: product.name, priceAtStartup: product.price },
    collection: { id: collection.collection_id, storeId: collection.store_id, membershipVersionAtStartup: collection.membership_version,
        productIdsAtStartup: collection.product_ids } };
const result = { classification: 'PREPARED_AWAITING_ROOT_GET_RELEASE_AND_EDITOR_PUBLISHED_CIRCUIT_CONTEXT',
    recordedAt: new Date().toISOString(), startupReceipt: { path: receiptPath, sha256: sha(receiptBytes) },
    publicBindings: metadata, publicBindingsSha256: sha(JSON.stringify(metadata)),
    sourceInputs: [{ path: contractPath, sha256: sha(readFileSync(contractPath)) },
        { path: factsPath, sha256: sha(readFileSync(factsPath)) }, { path: fixturePath, sha256: sha(fixtureBytes) }],
    suppliedSearchTerms: { model: facts.model, connectorKinds: kinds, provenance: 'Validated supplied startup fixture source; current public DTO verification is pending the allocated GETs' },
    collectionScope: 'Actual one-hub startup collection; does not represent the uncreated planned CircuitAll4 cohort',
    queries, maxFutureHttpGets: 4, httpGetsExecuted: 0, publishedCircuitContext: null,
    fullCaseAcceptanceClaimed: false, stateCredentialsSerialized: false };
writeFileSync(new URL('prepared-public-queries.json', out), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ runId: receipt.runId, hubId: electronics.id, collectionId: collection.collection_id,
    preparedQueries: queries.length, httpGetsExecuted: 0, publishedCircuitContext: null }) + '\n');
