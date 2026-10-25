import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { furnitureFinishFixture, furnitureUnknownFixture, renderBoundFurniture } from './selected-finish-fixtures';
const requireEngine = createRequire(new URL('../../../../packages/theme-engine/package.json', import.meta.url));
const { JSDOM } = requireEngine('jsdom') as { JSDOM: new (html: string) => { window: { document: Document } } };

test('real binder/mapper/Liquid preserves resolved whole-group finish differences and a common initial panel', async () => {
    const { result, drop, bound, serviceCalls } = await renderBoundFurniture(furnitureFinishFixture());
    assert.equal(serviceCalls, 0); assert.equal(bound.id, furnitureFinishFixture().id);
    const variants = drop.variants as Record<string, unknown>[];
    const smoked = variants[1].furniture_display as Record<string, string>;
    assert.equal(smoked.assembled, '27 W in'); assert.equal(smoked.package, '740 W × 780 H mm');
    assert.doesNotMatch(smoked.assembled, /68|78|74|cm/); assert.doesNotMatch(smoked.package, /80 D|82 D|cm/);
    assert.equal(smoked.materials, 'Variant-only oak'); assert.match(smoked.assembly, /Assembly required.*Variant assembly instruction.*Supplied hex key/);
    const document = new JSDOM(result.liquid!.contentForLayout).window.document;
    const panel = document.querySelector('[data-lb-variant-facts]')!;
    assert.match(panel.querySelector('[data-lb-variant-facts-status]')!.textContent!, /Common product facts/);
    assert.equal(panel.querySelector('[data-lb-furniture-field="assembled"]')!.textContent, '68 W × 78 D × 74 H cm');
    const row = document.querySelector(`[data-lb-variant-facts-row][data-variant-id="${variants[1].id}"]`)!;
    for (const text of ['27 W in', '740 W × 780 H mm', '14.2 kg', 'Variant-only oak', 'Assembly required', 'Variant-only care.']) assert.ok(row.textContent!.includes(text), text);
    assert.equal(document.querySelectorAll('[data-lb-variant-facts-row]').length, 2);
    assert.match(document.querySelector('.hab-facts')!.textContent!, /Common product footprint only[\s\S]*no access or fit is guaranteed/);
});

test('a product and named option without supplied furniture facts keep every unknown explicit', async () => {
    const { result } = await renderBoundFurniture(furnitureUnknownFixture());
    const document = new JSDOM(result.liquid!.contentForLayout).window.document;
    const panel = document.querySelector('[data-lb-variant-facts]')!;
    for (const value of panel.querySelectorAll('[data-lb-furniture-field]')) assert.match(value.textContent!, /not supplied/i);
    const fallback = document.querySelector('[data-lb-variant-facts-row]')!;
    assert.match(fallback.textContent!, /Unspecified finish/);
    assert.equal(fallback.querySelectorAll('dd').length, 7);
    for (const value of fallback.querySelectorAll('dd')) assert.match(value.textContent!, /not supplied/i);
    assert.equal(document.querySelector('.hab-dimension-box'), null);
});
