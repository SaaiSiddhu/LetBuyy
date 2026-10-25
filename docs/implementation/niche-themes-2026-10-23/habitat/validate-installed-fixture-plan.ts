// Pure documentation validation. No fixture, SQL, HTTP, browser, cart or order write.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
    CreateProductSchema, UpdateProductSchema, ProductVariantMetadataSchema,
    FurnitureFactsSchema, FurnitureVariantFactsSchema, resolveFurnitureFacts, furnitureLengthMm,
    StorefrontDiscoveryQuerySchema, StorefrontDiscoveryMeasurementCapabilitiesSchema,
    ProductFactSnapshotSchema, buildVariantFactPresentation,
} from '../../../../packages/commerce-core/src/index';

type Recipe = { key: string; createFields: Record<string, unknown> };
type QueryCase = { id: string; query: unknown; expectedCapabilities?: unknown; runtimeStatus: string };
type Plan = {
    classification: string; sourceEditorPlan: { path: string; sha256: string };
    originalEditorFurnitureRecipe: Recipe; proposedRecipes: Recipe[];
    laterEdit: { updateFields: unknown }; queryCases: QueryCase[];
    lifecycleCases: Array<{ id: string; runtimeStatus: string; evidence: unknown[] }>;
    purchase: { runtimeStatus: string }; runtimeExecuted: boolean;
};
const root = new URL('../../../../', import.meta.url);
const planUrl = new URL('./installed-fixture-matrix.plan.json', import.meta.url);
const plan = JSON.parse(readFileSync(planUrl, 'utf8')) as Plan;
const hash = (url: URL) => createHash('sha256').update(readFileSync(url)).digest('hex');
// Shape-check bindings only; never runtime fixture identity and never sent anywhere.
const validationStoreId = '11111111-1111-4111-8111-111111111111';
const validationVariantIds = Object.fromEntries(['A', 'B', 'C', 'D'].map((key, index) => [key, `22222222-2222-4222-8222-22222222222${index}`]));
assert.equal(plan.runtimeExecuted, false);
assert.equal(hash(new URL(plan.sourceEditorPlan.path, root)), plan.sourceEditorPlan.sha256);
CreateProductSchema.parse({ ...plan.originalEditorFurnitureRecipe.createFields, store_id: validationStoreId });
const commands = plan.proposedRecipes.map(recipe => ({ key: recipe.key, command: CreateProductSchema.parse({ ...recipe.createFields, store_id: validationStoreId }) }));
for (const { command } of commands) {
    FurnitureFactsSchema.parse(command.metadata.furniture);
    for (const variant of command.variants) {
        ProductVariantMetadataSchema.parse(variant.metadata);
        FurnitureVariantFactsSchema.parse(variant.metadata?.furniture ?? {});
        for (const [name, value] of Object.entries(variant.options)) {
            const option = command.product_options.find(option => option.name === name);
            assert.ok(option?.values.includes(value), `${name}=${value} must be an actual supplied choice`);
        }
    }
}
const main = commands.find(recipe => recipe.key === 'furniture')!.command;
const common = FurnitureFactsSchema.parse(main.metadata.furniture);
const [a, b, c, d] = main.variants;
const resolved = [a, b, c, d].map(variant => resolveFurnitureFacts(common, FurnitureVariantFactsSchema.parse(variant.metadata?.furniture)));
assert.deepEqual(resolved[0].assembled, { unit: 'in', width: 48, depth: 30, height: 29.5 });
assert.deepEqual(resolved[0].package, { unit: 'in', width: 50, depth: 25 });
assert.equal(resolved[0].package!.height, undefined);
assert.deepEqual(resolved[3].assembled, { unit: 'in', width: 48 });
assert.equal(resolved[3].assembled!.depth, undefined);
assert.deepEqual(resolved[2], common);
assert.equal(c.stock, 0);
const aDisplay = buildVariantFactPresentation(a.metadata, main.metadata, a.price! * 100).furniture_display;
assert.deepEqual(aDisplay, {
    assembled: '48 W × 30 D × 29.5 H in', package: '50 W × 25 D in', weight: '11.5 kg',
    materials: 'Wood', assembly: 'Assembly required · Use the supplied sample instructions. · Tools: 4 mm hex key',
    care: 'Natural finish: wipe dry.',
});
const widthMm = furnitureLengthMm(resolved[0].assembled!.width!, resolved[0].assembled!.unit);
const depthMm = furnitureLengthMm(resolved[0].assembled!.depth!, resolved[0].assembled!.unit);
assert.equal(widthMm, 1219.2); assert.equal(depthMm, 762);
assert.ok(widthMm <= 121.92 * 10 && widthMm > 121.9199 * 10);
assert.ok(furnitureLengthMm(resolved[0].package!.width!, resolved[0].package!.unit) > 122 * 10);
const expectedSavedSnapshot = ProductFactSnapshotSchema.parse({ version: 1, facts: { furniture: resolved[0] }, selected_options: [{ name: 'Finish', value: 'Natural' }, { name: 'Width', value: '48 in' }] });
let editJson = JSON.stringify(plan.laterEdit.updateFields);
for (const [key, value] of Object.entries(validationVariantIds)) editJson = editJson.replaceAll(`{{VARIANT_${key}}}`, value);
// Envelope samples validate shape only. The real parent must use its current
// acknowledged version and a fresh idempotency UUID for the actual edit.
const edit = UpdateProductSchema.parse({ ...JSON.parse(editJson), version: 1, idempotency_key: '33333333-3333-4333-8333-333333333333' });
assert.ok(edit.variants?.length === 4);
assert.ok(edit.variants.every(variant => !Object.hasOwn(variant, 'stock')), 'Later metadata edits must not reset consumed inventory');
assert.notDeepEqual(edit.variants[0].metadata?.furniture, expectedSavedSnapshot.facts.furniture);
for (const row of plan.queryCases) {
    StorefrontDiscoveryQuerySchema.parse(row.query);
    if (row.expectedCapabilities) StorefrontDiscoveryMeasurementCapabilitiesSchema.parse(row.expectedCapabilities);
    assert.equal(row.runtimeStatus, 'NOT_RUN');
}
for (const row of plan.lifecycleCases) { assert.equal(row.runtimeStatus, 'NOT_RUN'); assert.deepEqual(row.evidence, []); }
assert.equal(plan.purchase.runtimeStatus, 'NOT_RUN');
const inputPaths = [plan.sourceEditorPlan.path, 'packages/commerce-core/src/index.ts', 'packages/commerce-core/src/habitat-facts.ts', 'packages/commerce-core/src/niche-product-facts.ts', 'packages/commerce-core/src/product-fact-presentation.ts', 'packages/commerce-core/src/product-fact-snapshot.ts', 'packages/commerce-core/src/storefront-discovery.ts'];
const receipt = {
    recordedAt: new Date().toISOString(), classification: 'CANONICAL_SCHEMA_AND_PURE_PRESENTATION_VALIDATION_ONLY',
    validatedCreateCommands: commands.length, originalEditorRecipeValidated: true, laterUpdateCommandValidated: true,
    queryCommandsValidated: plan.queryCases.length, runtimeLifecycleCases: plan.lifecycleCases.length,
    runtimeStatus: 'NOT_RUN', runtimeExecuted: false, validationOnlyBindingsNeverSent: true,
    normalization: { aWidthMm: widthMm, aDepthMm: depthMm, aPackageWidthMm: furnitureLengthMm(resolved[0].package!.width!, resolved[0].package!.unit) },
    aExpectedDisplay: aDisplay, aExpectedSavedSnapshot: expectedSavedSnapshot,
    warning: 'Expected saved snapshot is schema-checked documentation, never a cart/order command or a persistence receipt.',
    sha256: Object.fromEntries(inputPaths.map(path => [path, hash(new URL(path, root))])),
    planSha256: hash(planUrl), validatorSha256: hash(new URL('./validate-installed-fixture-plan.ts', import.meta.url)),
};
writeFileSync(new URL('./installed-fixture-schema-validation.json', import.meta.url), JSON.stringify(receipt, null, 2) + '\n');
process.stdout.write(JSON.stringify({ createCommandsValidated: commands.length, queryCommandsValidated: plan.queryCases.length, lifecycleCases: plan.lifecycleCases.length, runtimeStatus: 'NOT_RUN' }) + '\n');
