import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AcceptedPersonalizationSchema, CreateProductSchema, PersonalizationCartDraftSchema,
  PersonalizationDraftSchema, PersonalizationFactsSchema, ProductEditVariantSchema,
  ProductFactSnapshotSchema, ProductVariantSchema, UpdateProductSchema,
  countPersonalizationGraphemes, reviewPersonalization, validatePersonalizationRevisionTransition,
} from '@letbuyy/commerce-core';
import { CheckoutContactSchema, CheckoutDeliverySchema, CheckoutPaymentIntentSchema, CheckoutConfirmSchema, StorefrontCartLineInputSchema } from '@letbuyy/checkout-core';

// Static data validation only. No fixture startup, network, identity, seed or browser harness.
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');
const planPath = resolve(here, 'installed-buyer-fixture.plan.json');
const plan = JSON.parse(readFileSync(planPath, 'utf8'));
const incorporationPath = resolve(here, 'installed-buyer-fixture-incorporation.json');
const incorporation = existsSync(incorporationPath) ? JSON.parse(readFileSync(incorporationPath, 'utf8')) : null;
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const checks: Array<{ name: string; result: 'PASS'; scope: 'STATIC_DATA_CONTRACT_ONLY' }> = [];
function checked(name: string, action: () => void) {
  action(); checks.push({ name, result: 'PASS', scope: 'STATIC_DATA_CONTRACT_ONLY' });
}
function onlyDeferredIssues(schema: { safeParse(input: unknown): { success: boolean; error?: { issues: Array<{ path: PropertyKey[] }> } } }, value: unknown, keys: string[]) {
  const parsed = schema.safeParse(value);
  assert.equal(parsed.success, false, 'Full commands deliberately lack actual runtime bindings');
  assert.ok(parsed.error);
  assert.deepEqual([...new Set(parsed.error.issues.map(issue => String(issue.path[0])))].sort(), [...keys].sort());
}
const recipe = plan.proposedRecipe;
const fields = recipe.createFields;
const facts = PersonalizationFactsSchema.parse(fields.metadata.personalization);
const expectedAccepted: Record<string, unknown> = {};
const expectedSnapshots: Record<string, unknown> = {};
const uiSetupPath = resolve(here, 'installed-buyer-ui-setup.plan.json');
const uiSetup = existsSync(uiSetupPath) ? JSON.parse(readFileSync(uiSetupPath, 'utf8')) : null;
const uiSetupExpectedSnapshots: Record<string, unknown> = {};
checked('Pinned Editor plan matches the recorded original or incorporated contribution', () => {
  const editorPath = resolve(repo, plan.editorPlan.path);
  assert.equal(sha(editorPath), incorporation?.sharedPlan.sha256 ?? plan.editorPlan.sha256);
  const editor = JSON.parse(readFileSync(editorPath, 'utf8'));
  const expectedKey = incorporation?.sharedPlan.personalizationMatches ?? plan.editorPlan.recipeExpectedAtValidation;
  const expected = expectedKey === 'proposedRecipe' ? plan.proposedRecipe : plan.originalRecipe;
  assert.deepEqual(editor.products.find((value: { key: string }) => value.key === 'personalization'), expected);
});
checked('Contributed CreateProduct fields validate; only actual store UUID is deferred', () => {
  onlyDeferredIssues(CreateProductSchema, { ...fields, images: [] }, ['store_id']);
  assert.equal(recipe.key, 'personalization');
  for (const variant of fields.variants) ProductVariantSchema.parse(variant);
  assert.deepEqual(fields.variants.map((value: { options: unknown }) => value.options), [{ Cover: 'Moss' }, { Cover: 'Oat' }, { Cover: 'Slate unavailable' }]);
  assert.deepEqual(fields.variants.map((value: { stock: number }) => value.stock), [4, 4, 0]);
  assert.equal(fields.stock, 8);
  assert.equal(fields.price, 690);
  for (const path of recipe.mediaPaths) assert.ok(existsSync(resolve(repo, `apps/commerce/web/public${path}`)));
});
checked('All drafted input shapes validate with the canonical draft schema', () => {
  for (const value of Object.values(plan.drafts)) PersonalizationDraftSchema.parse(value);
});
for (const name of ['asha', 'kabir', 'unicodeHindi', 'nfcAfterConsent', 'changedMethod', 'changedStyle', 'changedPlacement']) {
  checked(`Canonical review accepts expected ${name} data and strict frozen snapshot`, () => {
    const review = reviewPersonalization(facts, plan.drafts[name]);
    assert.equal(review.valid, true);
    if (!review.valid) throw new Error(name);
    assert.equal(review.accepted.text, plan.drafts[name].text);
    expectedAccepted[name] = AcceptedPersonalizationSchema.parse(review.accepted);
    expectedSnapshots[name] = ProductFactSnapshotSchema.parse({ version: 1, facts: { personalization: facts }, selected_options: [{ name: 'Cover', value: 'Moss' }], personalization: review.accepted });
  });
}
checked('NFC proposal requires explicit separate consent and review', () => {
  const before = plan.drafts.nfcBeforeConsent;
  assert.notEqual(before.text, before.text.normalize('NFC'));
  const review = reviewPersonalization(facts, before);
  assert.equal(review.valid, false);
  if (review.valid) throw new Error('Non-NFC must not be accepted');
  assert.equal(review.issues.find(issue => issue.code === 'NORMALIZE_TEXT')?.suggested_text, plan.drafts.nfcAfterConsent.text);
});
checked('Markup, overlength and emoji are rejected by canonical domain review', () => {
  for (const name of ['invalidMarkup', 'invalidLength', 'invalidEmoji']) assert.equal(reviewPersonalization(facts, plan.drafts[name]).valid, false);
  assert.equal(countPersonalizationGraphemes(plan.drafts.invalidLength.text), 19);
});
checked('Actual Liquid cart templates preserve option properties and strict personalization; runtime identity/echo remain deferred', () => {
  for (const command of Object.values(plan.cartPayloadTemplates) as Array<{ lines: Array<Record<string, unknown>> }>) {
    assert.deepEqual(Object.keys(command), ['lines']);
    for (const line of command.lines) {
      assert.deepEqual(Object.keys(line).sort(), ['personalization', 'product_id', 'properties', 'quantity', 'variant_id']);
      assert.deepEqual(line.properties, { Cover: (line.variant_id as { $runtime: string }).$runtime.includes('.moss.') ? 'Moss' : 'Oat' });
      const draft = line.personalization as Record<string, unknown>;
      const { review_fingerprint: _echo, facts_revision: _revision, ...draftFields } = draft;
      PersonalizationCartDraftSchema.omit({ review_fingerprint: true }).parse({ ...draftFields, facts_revision: facts.revision });
      const { personalization: _personalization, product_id: _product, variant_id: _variant, ...rest } = line;
      StorefrontCartLineInputSchema.omit({ personalization: true, product_id: true, variant_id: true }).parse(rest);
      assert.deepEqual(draft.review_fingerprint, { $runtime: `reviewContexts.${(line.variant_id as { $runtime: string }).$runtime.split('.')[1]}.review_fingerprint` });
    }
  }
});
checked('Later product patch fields and variant edits validate; actual version/key/UUIDs are deferred', () => {
  const { version: _version, idempotency_key: _key, variants, ...patch } = plan.postPurchaseCatalogPatchTemplate;
  onlyDeferredIssues(UpdateProductSchema, patch, ['idempotency_key', 'version']);
  for (const { id: _id, ...variant } of variants) ProductEditVariantSchema.parse(variant);
  const next = patch.metadata.personalization;
  assert.deepEqual(validatePersonalizationRevisionTransition(facts, next), { ok: true, changed: true, invalidatesReview: true });
  assert.deepEqual(validatePersonalizationRevisionTransition(facts, { ...next, revision: 1 }), { ok: false, code: 'REVISION_NOT_ADVANCED' });
});
if (uiSetup) checked('Current ordinary-UI setup correctly advances baseline1 to2, then post-purchase3', () => {
  assert.equal(uiSetup.proposalSha256, sha(planPath));
  assert.deepEqual(uiSetup.baseFacts, plan.originalRecipe.createFields.metadata.personalization);
  const setup = PersonalizationFactsSchema.parse(uiSetup.setupFacts);
  const after = PersonalizationFactsSchema.parse(uiSetup.afterPurchaseFacts);
  assert.equal(setup.revision, 2); assert.equal(after.revision, 3);
  assert.deepEqual(validatePersonalizationRevisionTransition(uiSetup.baseFacts, setup), { ok: true, changed: true, invalidatesReview: true });
  assert.deepEqual(validatePersonalizationRevisionTransition(setup, after), { ok: true, changed: true, invalidatesReview: true });
  assert.deepEqual(validatePersonalizationRevisionTransition(uiSetup.baseFacts, { ...setup, revision: 1 }), { ok: false, code: 'REVISION_NOT_ADVANCED' });
  for (const name of ['asha', 'kabir', 'unicodeHindi', 'nfcAfterConsent']) {
    const review = reviewPersonalization(setup, plan.drafts[name]);
    assert.equal(review.valid, true); if (!review.valid) throw new Error(name);
    uiSetupExpectedSnapshots[name] = ProductFactSnapshotSchema.parse({ version: 1, facts: { personalization: setup }, selected_options: [{ name: 'Cover', value: 'Moss' }], personalization: review.accepted });
  }
  assert.equal(uiSetup.runtimeStatus, 'NOT_RUN'); assert.deepEqual(uiSetup.runtimeObservations, []);
});
checked('Existing checkout step static fields validate while normal identity/intent/quote fields remain deferred', () => {
  const { idempotency_key: _contactKey, email: _email, ...contact } = plan.checkoutPayloadTemplates.contact;
  CheckoutContactSchema.omit({ email: true, idempotency_key: true }).parse(contact);
  const { idempotency_key: _deliveryKey, shipping_quote: _quote, ...delivery } = plan.checkoutPayloadTemplates.delivery;
  CheckoutDeliverySchema.omit({ idempotency_key: true, shipping_quote: true }).parse(delivery);
  const { idempotency_key: _intentKey, ...intent } = plan.checkoutPayloadTemplates.paymentIntent;
  CheckoutPaymentIntentSchema.omit({ idempotency_key: true }).parse(intent);
  CheckoutConfirmSchema.omit({ idempotency_key: true }).parse({});
});
checked('Every runtime case remains NOT_RUN with no invented observations or purchase counts', () => {
  assert.equal(plan.executed, false); assert.equal(plan.runtimeStatus, 'NOT_RUN');
  assert.equal(plan.executionSummary.run, 0); assert.equal(plan.executionSummary.passed, 0);
  assert.equal(plan.executionSummary.failed, 0); assert.equal(plan.executionSummary.notRun, plan.cases.length);
  for (const row of plan.cases) { assert.equal(row.status, 'NOT_RUN'); assert.equal(row.observed, null); assert.deepEqual(row.evidence, []); }
  for (const key of ['observedOrderId', 'observedOrderDelta', 'observedInventoryDelta']) assert.equal(plan.purchaseExpected[key], null);
});
checked('Frozen backend/core/SDK/factory/discovery bytes remain unchanged', () => {
  for (const file of plan.frozenSourceCheckpoint) assert.equal(sha(resolve(repo, file.path)), file.sha256, file.path);
});
const result = {
  classification: 'STATIC_DATA_CONTRACT_ONLY_ALL_RUNTIME_CASES_NOT_RUN',
  preparedAt: new Date().toISOString(), planSha256: sha(planPath),
  schemaValidatedFields: checks, expectedAccepted, expectedSnapshots,
  currentUiSetup: uiSetup ? { profile: 'installed-buyer-ui-setup.plan.json', sha256: sha(uiSetupPath), setupFactsRevision: 2, postPurchaseFactsRevision: 3, expectedSnapshots: uiSetupExpectedSnapshots, runtimeStatus: 'NOT_RUN' } : null,
  nfc: { beforeCodePoints: [...plan.drafts.nfcBeforeConsent.text].map((value: string) => `U+${value.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`), suggestion: plan.drafts.nfcAfterConsent.text, consentAndRenewedReviewRequired: true },
  deferred: ['Actual store/product/variant UUIDs', 'Real normal identity sessions', 'Server-produced review context/fingerprint', 'Live full CreateProduct/UpdateProduct/cart commands', 'Cart/session/checkout capability and keys', 'Actual delivery quote and money', 'Every installed browser/DB/runtime case'],
  runtimeCases: { status: 'NOT_RUN', cases: plan.cases.map((row: { id: string }) => ({ id: row.id, status: 'NOT_RUN' })), passed: 0, observations: [] },
  resourcesStarted: [], productionSourcesEdited: [],
};
writeFileSync(resolve(here, 'installed-buyer-fixture-validation.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ classification: result.classification, staticDataChecks: checks.length, runtimeStatus: 'NOT_RUN', runtimeCases: plan.cases.length, runtimePassed: 0 })}\n`);
