/** Read-only preparation. Never seeds a fixture or invents runtime identities. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { CreateProductSchema, UpdateProductSchema, GiftFactsSchema, validateGiftMediaRoles, rebindGiftMediaRoles } from '../../../../../packages/commerce-core/src/index';

const root = 'docs/implementation/niche-themes-2026-10-23/kindred/responsive-shopping-2026-10-23';
const planPath = 'docs/implementation/theme-editor-2026-10-23/evidence/fresh-fixture-data.plan.json';
const hookPath = 'services/api-gateway/src/__tests__/owned-db/threadline-qa-fixture.ts';
const receiptPath = 'docs/implementation/theme-editor-2026-10-23/evidence/fixture-preparation-source-release-14-products.json';
const hash = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
assert.equal(hash(planPath), receipt.plan.sha256);
const source = ts.createSourceFile(hookPath, fs.readFileSync(hookPath, 'utf8'), ts.ScriptTarget.Latest, true);
const recipesStatement = source.statements.find(statement => ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => declaration.name.getText(source) === 'EDITOR_PRODUCT_RECIPES'));
assert.ok(recipesStatement && ts.isVariableStatement(recipesStatement));
const recipesDeclaration = recipesStatement.declarationList.declarations.find(declaration => declaration.name.getText(source) === 'EDITOR_PRODUCT_RECIPES');
assert.ok(recipesDeclaration?.initializer);
// Data-only extraction: the shared hook itself is never imported or executed.
const recipes = JSON.parse(recipesDeclaration.initializer.getText(source));
assert.equal(recipes.length, 14);
assert.deepEqual(recipes, plan.products);
const recipe = recipes.find((item: {key: string}) => item.key === 'gifts');
assert.ok(recipe);
assert.equal(recipe.createFields.price, 1100);
assert.equal(recipe.createFields.stock, 8);
assert.deepEqual(recipe.createFields.product_options, []);
assert.deepEqual(recipe.createFields.variants, []);

// The allocated static origin is only a URL-schema probe; no installed media
// origin or store UUID is claimed. Runtime bindings remain null below.
const probeImages = recipe.mediaPaths.map((file: string) => new URL(file, 'http://127.0.0.1:43275').href);
const suppliedFields = {...recipe.createFields, images: probeImages};
const fieldResults = Object.entries(suppliedFields).map(([key, value]) => {
    const schema = CreateProductSchema.shape[key as keyof typeof CreateProductSchema.shape];
    assert.ok(schema, key);
    const parsed = schema.safeParse(value);
    assert.ok(parsed.success, `${key}: ${JSON.stringify(parsed.error?.issues)}`);
    return {field: key, status: 'PASS'};
});
const unbound = CreateProductSchema.safeParse(suppliedFields);
assert.equal(unbound.success, false);
if (unbound.success) throw new Error('Unbound command unexpectedly accepted');
assert.deepEqual(unbound.error.issues.map(issue => issue.path), [['store_id']]);
const base = GiftFactsSchema.parse(recipe.createFields.metadata.gifts);
assert.ok(validateGiftMediaRoles(base, probeImages));
const discoveryEdit = GiftFactsSchema.parse({...base, occasions: ['birthday', 'thank-you'], recipients: ['friend', 'colleague']});
assert.ok(UpdateProductSchema.shape.metadata.safeParse({gifts: discoveryEdit}).success);
const changedFacts = GiftFactsSchema.parse({...discoveryEdit, contents: discoveryEdit.contents!.map((row, index) => index === 0 ? {...row, detail: '250 ml'} : row)});
assert.ok(UpdateProductSchema.shape.metadata.safeParse({gifts: changedFacts}).success);
assert.equal(validateGiftMediaRoles({...base, mediaRoles: {openBox: 19}}, probeImages), false);
assert.equal(GiftFactsSchema.safeParse({...base, mediaRoles: {openBox: 0, closedBox: 0}}).success, false);
assert.deepEqual(rebindGiftMediaRoles(base, probeImages, [...probeImages].reverse())?.mediaRoles, {openBox: 1, closedBox: 0});
assert.deepEqual(rebindGiftMediaRoles(base, probeImages, [probeImages[1]])?.mediaRoles, {closedBox: 0});
const {mediaRoles: _roles, contents: _contents, ...unknownContents} = discoveryEdit;
assert.ok(GiftFactsSchema.safeParse(unknownContents).success);

const cases = [
    ['G01', 'Bind the single shared fixture', 'Use editor profile and the existing prepareThemeEditorQaStore hook; retain gifts product/collection IDs and shipping-rate ID from actual receipts. Do not run a second seed harness.'],
    ['G02', 'Install and publish Kindred v2', 'Use actual merchant theme UI; record admitted package/release/hash, draft version, save/publish receipt and reload. Installation must not seed catalog content.'],
    ['G03', 'Edit the existing gifts product', 'Use normal merchant product page to add birthday/thank-you and friend/colleague to the existing gifts metadata, preserve three contents rows and images, save and reload with actual version/idempotency.'],
    ['G04', 'Invalid media-role recovery', 'Attempt an out-of-range role and a duplicated role through available merchant controls/API negative control; no durable mutation. Record actual validation stage/status.'],
    ['G05', 'Unknown-facts recovery', 'On the same product, temporarily omit contents and role bindings; no made-up contents, fulfillment or imagery. Restore actual saved base facts before purchase.'],
    ['G06', 'Collection and search discovery', 'Use actual admitted options and counts; occasion/recipient/budget/sort combinations on both routes, independent clear URLs, repeated unrelated connector preservation, true empty response and recovery. No fabricated option/count; source-only static QA is separate.'],
    ['G07', 'PDP and supplied media', 'Confirm Mug 300 ml/Hand wash., Notebook, Pen; open/closed images from explicit roles. Base fixture has no product options or variants, so no wrapping selector or variant identity may be invented.'],
    ['G08', 'Keyboard and responsive browsing', 'Capture actual installed 320/768/1440 layouts and focus/activation, including hydrated header/menu behavior; record outstanding long-brand header defect independently.'],
    ['G09', 'Server cart and reload', 'Add one existing gifts product, await canonical server response, reload same owned buyer/store cart: quantity 1, unit price 1100 INR, selected options empty, approved immutable gift facts and saved primary image.'],
    ['G10', 'Client authority negative', 'Attempt unsupported price/snapshot fields and allowed display-property spoof separately; record actual contract response and unchanged server price/contents/image. Do not assert a status that was not observed.'],
    ['G11', 'Buyer identity', 'Register/sign in through real identity UI, reload account, carry the actual store-scoped session into checkout; do not inject a minted session or copy public-demo identity.'],
    ['G12', 'Hosted COD checkout', 'Through actual hosted checkout choose Bengaluru Karnataka 560001 and the shared flat 20 INR rate, confirm COD. Expected server subtotal 1100, shipping 20, discount 0, tax 0, total 1120 INR; reconcile if server differs. COD pending must not appear paid.'],
    ['G13', 'Idempotent retry', 'Repeat the same accepted order command with its same actual idempotency key using the existing harness/control; exactly the same order, no duplicate line/reservation/link. Not a second UI purchase claim.'],
    ['G14', 'Initial saved readback', 'Record buyer account/order UI, merchant order UI and actual Liquid order detail from the accepted saved order. Facts, quantity, monetary totals and primary image match accepted order; raw/private product snapshot absent.'],
    ['G15', 'Merchant mutation after purchase', 'On the same product change Mug detail to 250 ml and reorder/remove the supplied images through normal save. Keep actual receipts. Current catalog changes; saved order keeps original 300 ml/care/contents and accepted primary image.'],
    ['G16', 'Historical readback after mutation', 'Reload all three saved readbacks. Exact old snapshot/primary image remains; unavailable historical facts stay unavailable and never fall back to current catalog.'],
    ['G17', 'Stale cart review', 'Keep a separate accepted cart before G15; later checkout must follow actual CART_FACTS_CHANGED/review contract, with no second unintended order/reservation.'],
    ['G18', 'Tenant and buyer isolation', 'Use owner-allocated Buyer B/foreign-site controls; refuse foreign cart token/order IDs and verify no private facts or raw snapshot leakage. Positive own-order control first.'],
    ['G19', 'Conflict and resource recovery', 'Exercise a stale merchant version without overwriting latest edit, then verify cleanup only for allocated run resources and publish a lease-release receipt.'],
].map(([id, title, expectation]) => ({id, title, status: 'NOT_RUN', expectation, evidence: null}));
const output = {
    generatedAt: new Date().toISOString(), classification: 'SCHEMA_VALIDATED_PREPARATION_NOT_INSTALLED_ACCEPTANCE',
    sharedPlan: {path: planPath, sha256: hash(planPath), products: recipes.length, exactRecipesMatch: true},
    sharedHook: {path: hookPath, sha256: hash(hookPath), invoked: false, function: 'prepareThemeEditorQaStore', profile: 'editor'},
    receipt: {path: receiptPath, sha256: hash(receiptPath)},
    theme: {slug: 'letbuyy-summit', version: '2.0.0'},
    productRecipe: recipe,
    merchantEditPreparation: {metadata: {gifts: discoveryEdit}, laterFacts: changedFacts, fullUpdateCommand: 'NOT_RUN: bind real saved version/idempotency and preserve other current metadata'},
    validation: {status: 'PASS', fieldResults, missingRuntimeIdentity: unbound.error.issues, roleReferencesValid: true, duplicateRoleRejected: true, outOfImageRoleRejected: true, exactIdentityReorder: true, removedRoleNotGuessed: true, omittedContentsStayUnknown: true, fullBoundCreateCommand: 'NOT_RUN: shared builder validates after actual storeId and commerceOrigin allocation'},
    bindings: {runId: null, databaseLease: null, siteId: null, subdomain: null, commerceOrigin: null, merchantOrigin: null, identityOrigin: null, checkoutOrigin: null, giftsProductId: null, giftsVersion: null, giftsVariantIds: null, giftsCollectionId: null, shippingRateId: null, themeReleaseId: null, cartToken: null, buyerId: null, orderId: null},
    expectedPurchase: {quantity: 1, priceINR: 1100, stockBefore: 8, selectedOptions: [], variantSelection: 'Not applicable to current approved no-variant gifts row', subtotalINR: 1100, shippingINR: 20, taxINR: 0, discountINR: 0, totalINR: 1120, payment: 'COD; actual pending state must be observed'},
    cases, liveStatus: 'NOT_RUN', createdIds: [], tokensMinted: 0, ordersCreated: 0, databaseCalls: 0, networkCalls: 0,
    schemaSources: ['packages/commerce-core/src/index.ts', 'packages/commerce-core/src/kindred-facts.ts'].map(path => ({path, sha256: hash(path)})),
};
fs.writeFileSync(`${root}/installed-gifts-lifecycle.plan.json`, JSON.stringify(output, null, 2) + '\n');
console.info(JSON.stringify({status: 'PASS', exactSharedRecipes: recipes.length, schemaFields: fieldResults.length, liveCasesNotRun: cases.length, bindingsAllocated: 0, orders: 0, databaseCalls: 0}));
