import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ElectronicsFactsSchema, readElectronicsFacts, ProductVariantMetadataSchema, VARIANT_NICHE_FACT_SCHEMAS } from '../../../../../../packages/commerce-core/src/index.ts';
const cases = JSON.parse(readFileSync(new URL('validator-cases.json', import.meta.url), 'utf8'));
const hub = { kind: 'hub', model: 'Synthetic H1', power_input_w: 65, power_output_w: 45, pass_through_output_w: 60,
    connectors: [{ kind: 'usb-c', role: 'power-input', count: 1 }, { kind: 'usb-c', role: 'power-output', count: 2 }, { kind: 'usb-a', role: 'data', count: 1 }] };
test('canonical valid model/connector facts preserve original model, role/count and physically distinct power values', () => {
    const parsed = ElectronicsFactsSchema.parse(hub); assert.equal(parsed.model, 'Synthetic H1');
    assert.deepEqual(parsed.connectors, hub.connectors); assert.deepEqual([parsed.power_input_w, parsed.power_output_w, parsed.pass_through_output_w], [65, 45, 60]);
    assert.equal(ElectronicsFactsSchema.parse({ kind: 'other', model: 'नमूना H‑1 Δ' }).model, 'नमूना H‑1 Δ');
    assert.equal(ElectronicsFactsSchema.parse({ kind: 'other', model: 'MODEL-X-2' }).model, 'MODEL-X-2');
});
test('each alias/unknown/coerced/duplicate connector invalidates the whole canonical namespace, never a partly searchable model', () => {
    assert.equal(cases.length, 11);
    for (const row of cases) {
        const facts = { ...hub, model: 'REJECTED-CONNECTOR-MODEL', connectors: row.connectors };
        assert.equal(ElectronicsFactsSchema.safeParse(facts).success, false, row.label);
        assert.equal(readElectronicsFacts({ electronics: facts }), null, row.label);
    }
});
test('missing namespace stays unknown; malformed model/namespace and unsupported variant electronics never coerce to authority', () => {
    for (const metadata of [{}, { electronics: null }, { electronics: [] }, { electronics: 'Synthetic H1' }]) assert.equal(readElectronicsFacts(metadata), null);
    for (const facts of [{ ...hub, model: 987654321 }, { ...hub, model: ['Synthetic H1'] }, { ...hub, pass_through_output_w: 66 }, { ...hub, private_key: 'PRIVATE-NAMESPACE-TERM' }]) assert.equal(ElectronicsFactsSchema.safeParse(facts).success, false);
    assert.equal(ElectronicsFactsSchema.safeParse({ kind: 'other', connectors: [] }).success, true, 'model is optional; no invented value');
    assert.equal(Object.keys(VARIANT_NICHE_FACT_SCHEMAS).length, 5);
    assert.equal(Object.hasOwn(VARIANT_NICHE_FACT_SCHEMAS, 'electronics'), false);
    assert.equal(ProductVariantMetadataSchema.safeParse({ electronics: hub }).success, false);
});
