import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeProductFacts } from '../src/product-facts-summary';
import { readProductNicheFacts, type ProductNicheFacts } from '../src/niche-product-facts';
import { AcceptedPersonalizationSchema } from '../src/madeyours-facts';

const accepted = AcceptedPersonalizationSchema.parse({ version: 1, facts_revision: 2, method: { id: 'engrave', label: 'Recorded engraving' }, style: { id: 'serif', label: 'Recorded serif' }, placement: { id: 'front', label: 'Recorded front' }, text: 'आशा' });
const facts = readProductNicheFacts({
    toys: { ageBands: ['6-8'], contents: [{ quantity: 2, label: 'Wooden figures' }], materials: 'Beech', warnings: [{ text: 'Small parts.', sourceLabel: 'Saved label', editionLabel: 'Set A' }], dimensions: { length: 25, width: 12, unit: 'cm' } },
    electronics: { manufacturer: 'Example', model: 'Accessory A', connectors: [{ kind: 'usb-c', role: 'data', count: 2 }], power_input_w: 100, power_output_w: 65, power_capacity_w: 240, pass_through_output_w: 85, data_rate_mbps: 480, video: { width_px: 3840, height_px: 2160, refresh_hz: 60 }, length_mm: 1000, box_contents: [{ label: 'Cable', quantity: 1 }], host_requirements: ['Named host feature'], compatible_devices: [{ manufacturer: 'Example', model: 'Device 7', reference: 'Saved device sheet', source_date: '2026-01-04' }] },
    food: { ingredients: 'Red lentils', allergens: { status: 'supplied', statement: 'Packed in a facility handling sesame.', source: 'Saved package label' }, netQuantity: { value: 250, unit: 'g' }, storage: 'Keep dry.' },
    furniture: { assembled: { width: 80, depth: 40, height: 75, unit: 'cm' }, package: { width: 34, depth: 18, height: 8, unit: 'in' }, weight: { value: 14, unit: 'kg' }, materials: ['Oak'], finish: 'Natural oil', assembly: { status: 'required', tools: '4 mm hex key', instructions: 'Use supplied fittings.' } },
    gifts: { contents: [{ label: 'Cup', quantity: 2, detail: '250 ml', care: 'Hand wash.' }], occasions: ['birthday'], suitabilityNote: 'Merchant-supplied set note.' },
    personalization: { version: 1, revision: 2, methods: [{ id: 'engrave', label: 'Recorded engraving', min_graphemes: 1, max_graphemes: 40, character_set: 'unicode-letters', styles: [{ id: 'serif', label: 'Recorded serif' }], placements: [{ id: 'front', label: 'Recorded front' }] }] },
    beauty: { routineStage: 'colour', format: 'Lip tint', netQuantity: { value: 6, unit: 'ml' }, ingredients: 'Common ingredient statement', directions: 'Saved directions', shades: [{ value: 'Rosewater', code: 'RW01', color: '#a36a65', ingredients: 'Rosewater ingredients' }, { value: 'Pink Clay', code: 'PC02', color: '#a36a65', ingredients: 'Pink Clay ingredients' }] },
    sports: { activity: 'Badminton', equipmentType: 'racket', length: { value: 68, unit: 'cm' }, gripCircumference: { value: 3.5, unit: 'in' }, weight: { value: 84, unit: 'g' }, material: 'Saved material', contents: ['One racket'], compatibility: { status: 'unconfirmed', note: 'Fit not confirmed.' } },
    books: { kind: 'book', authors: ['Recorded Author'], language: 'Hindi', format: 'paperback', edition: 'Second edition, 2024', publisher: 'Recorded Press', publication_year: 2024, pages: 180, dimensions_mm: { width: 140, height: 210 } },
});
const rows = (input: ReturnType<typeof summarizeProductFacts>, id: string) => input.find(section => section.id === id)!.rows;
const value = (input: ReturnType<typeof summarizeProductFacts>, id: string, label: string) => rows(input, id).find(row => row.label === label)?.value;
function freeze(value: unknown): void { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } }

test('all nine canonical fact namespaces produce recorded presentation without mutating frozen inputs', () => {
    assert.equal(Object.keys(facts).length, 9);
    const snapshot = structuredClone(facts); const original = structuredClone(snapshot); freeze(snapshot);
    const output = summarizeProductFacts(snapshot, accepted, { Shade: 'Pink Clay' });
    assert.deepEqual(output.map(section => section.id), ['selected-options', 'toys', 'electronics', 'food', 'furniture', 'gifts', 'personalization', 'beauty', 'sports', 'books']);
    assert.deepEqual(snapshot, original);
    assert.equal(value(output, 'toys', 'Contents'), '2 × Wooden figures'); assert.match(value(output, 'toys', 'Warnings')!, /Small parts.*\nSource: Saved label · Set A/);
    assert.equal(value(output, 'gifts', 'Contents'), '2 × Cup · 250 ml\nCare: Hand wash.');
    assert.equal(value(output, 'books', 'Edition'), 'Second edition, 2024'); assert.equal(value(output, 'books', 'Language'), 'Hindi');
    assert.doesNotMatch(JSON.stringify(output), /Free delivery|arrives tomorrow|clinically proven|hypoallergenic|allergen.free/i);
});
test('dimensions, food and equipment retain actual units and distinguish package size from assembled size', () => {
    const output = summarizeProductFacts(facts);
    assert.equal(value(output, 'food', 'Per-item net quantity'), '250 g');
    assert.equal(value(output, 'furniture', 'Assembled dimensions'), 'Width 80 cm · Depth 40 cm · Height 75 cm');
    assert.equal(value(output, 'furniture', 'Package dimensions'), 'Width 34 in · Depth 18 in · Height 8 in');
    assert.equal(value(output, 'furniture', 'Weight'), '14 kg');
    assert.equal(value(output, 'sports', 'Length'), '68 cm'); assert.equal(value(output, 'sports', 'Grip circumference'), '3.5 in'); assert.equal(value(output, 'sports', 'Weight'), '84 g');
    assert.equal(value(output, 'sports', 'Compatibility reference'), 'Not recorded with this order.');
    assert.equal(value(output, 'sports', 'Compatibility status'), 'Unconfirmed.');
});
test('electronic power capacity, output, input and pass-through stay separate rather than inventing compatibility', () => {
    const output = summarizeProductFacts(facts);
    for (const [label, expected] of [['Power input', '100 W'], ['Power output', '65 W'], ['Rated carrying capacity', '240 W'], ['Pass-through output', '85 W'], ['Data rate', '480 Mb/s'], ['Length', '1000 mm']]) assert.equal(value(output, 'electronics', label), expected);
    assert.equal(value(output, 'electronics', 'Video specification'), '3840 × 2160 px at 60 Hz');
    assert.equal(value(output, 'electronics', 'Connectors'), '2 × USB-C (data)');
    assert.equal(value(output, 'electronics', 'Referenced devices'), 'Example Device 7\nReference: Saved device sheet · 2026-01-04');
    assert.doesNotMatch(JSON.stringify(output), /works with every|universally compatible|certified by/i);
});
test('identical RGB shades use exact saved option values and never select the first or matching-colour row', () => {
    const output = summarizeProductFacts({ beauty: facts.beauty }, null, { Shade: 'Pink Clay' });
    assert.equal(value(output, 'beauty', 'Selected shade'), 'Pink Clay'); assert.equal(value(output, 'beauty', 'Shade code'), 'PC02');
    assert.equal(value(output, 'beauty', 'Selected-shade ingredients'), 'Pink Clay ingredients'); assert.doesNotMatch(JSON.stringify(output), /RW01|Rosewater ingredients/);
    const absent = summarizeProductFacts({ beauty: facts.beauty });
    assert.equal(value(absent, 'beauty', 'Selected shade'), 'Not recorded with this order.'); assert.equal(value(absent, 'beauty', 'Shade code'), 'Not recorded with this order.');
    assert.doesNotMatch(JSON.stringify(absent), /RW01|PC02|Rosewater ingredients|Pink Clay ingredients|#a36a65/);
    const unknown = summarizeProductFacts({ beauty: facts.beauty }, null, { Shade: 'Recorded legacy shade' });
    assert.equal(value(unknown, 'beauty', 'Selected shade'), 'Recorded legacy shade'); assert.equal(value(unknown, 'beauty', 'Shade code'), 'Not recorded with this order.');
});
test('accepted personalized text and recorded labels survive changed capabilities without reacceptance or current lookup', () => {
    const saved = structuredClone({ personalization: facts.personalization });
    const currentCatalog = structuredClone(saved.personalization!);
    currentCatalog.revision = 9; currentCatalog.methods[0].label = 'Different capability'; currentCatalog.methods[0].styles[0].label = 'Different style';
    const output = summarizeProductFacts(saved, accepted);
    assert.equal(value(output, 'personalization', 'Accepted text'), 'आशा'); assert.equal(value(output, 'personalization', 'Method'), 'Recorded engraving');
    assert.equal(value(output, 'personalization', 'Style'), 'Recorded serif'); assert.equal(value(output, 'personalization', 'Placement'), 'Recorded front');
    assert.doesNotMatch(JSON.stringify(output), /Different capability|Different style|Different placement/);
    assert.equal(currentCatalog.revision, 9); assert.deepEqual(summarizeProductFacts(saved, accepted), output);
    const unaccepted = summarizeProductFacts({ personalization: facts.personalization });
    assert.equal(value(unaccepted, 'personalization', 'Accepted text'), 'Not recorded with this order.'); assert.doesNotMatch(JSON.stringify(unaccepted), /Different capability/);
});
test('missing food measurements/allergens and stationery pages remain unknown despite suggestive option labels', () => {
    const food = readProductNicheFacts({ food: {} });
    const output = summarizeProductFacts(food, null, { Pack: '500 g' });
    assert.equal(value(output, 'selected-options', 'Pack'), '500 g');
    assert.equal(value(output, 'food', 'Per-item net quantity'), 'Not recorded with this order.'); assert.equal(value(output, 'food', 'Allergen statement'), 'Not recorded with this order.'); assert.doesNotMatch(JSON.stringify(rows(output, 'food')), /500 g|allergen.free/i);
    const stationery = summarizeProductFacts(readProductNicheFacts({ books: { kind: 'stationery', sheet_count: 10, paper_gsm: 120, included: ['One notebook'] } }));
    assert.equal(value(stationery, 'books', 'Sheet count'), '10'); assert.equal(value(stationery, 'books', 'Page count'), 'Not recorded with this order.'); assert.equal(value(stationery, 'books', 'Paper weight'), '120 g/m²');
});
test('private, inherited, getter and invalid namespaces cannot become order presentation', () => {
    let getterCalls = 0;
    const input = Object.assign(Object.create({ books: facts.books }), { food: facts.food, private_supplier: 'PRIVATE-SUPPLIER', internal_cost: 120, beauty: { ...facts.beauty, medicalCertification: 'UNVERIFIED-CLAIM' } }) as ProductNicheFacts;
    Object.defineProperty(input, 'gifts', { get() { getterCalls++; return facts.gifts; }, enumerable: true });
    const output = summarizeProductFacts(input); assert.equal(getterCalls, 0);
    assert.equal(value(output, 'food', 'Per-item net quantity'), '250 g'); assert.equal(value(output, 'beauty', 'Details'), 'Not recorded with this order.');
    assert.equal(output.some(section => section.id === 'books' || section.id === 'gifts'), false);
    assert.doesNotMatch(JSON.stringify(output), /PRIVATE-SUPPLIER|internal_cost|120|UNVERIFIED-CLAIM|medicalCertification/);
});
test('absent or malformed historical facts have an explicit unavailable result without invented zero values', () => {
    for (const input of [undefined, null, {}, { books: { kind: 'book', isbn: 'bad-isbn' } } as unknown as ProductNicheFacts]) {
        const output = summarizeProductFacts(input);
        assert.equal(output.length, 1); assert.deepEqual(output[0].rows, [{ label: 'Details', value: 'Not recorded with this order.' }]);
        assert.doesNotMatch(JSON.stringify(output), /bad-isbn/);
    }
});
test('plain-text formatter retains supplied hostile strings for normal host escaping and never dereferences references', () => {
    const attack = '<img src=x onerror="attack()"><script>attack()</script>';
    const input = readProductNicheFacts({ beauty: { ingredients: attack }, electronics: { fact_sheet: { reference: 'javascript:attack()', source_date: '2026-01-01' } } });
    const output = summarizeProductFacts(input, { ...accepted, text: attack });
    assert.equal(value(output, 'beauty', 'Product ingredient statement'), attack); assert.equal(value(output, 'personalization', 'Accepted text'), attack);
    assert.equal(value(output, 'electronics', 'Fact-sheet reference'), 'javascript:attack() · 2026-01-01');
    assert.ok(output.every(section => section.rows.every(row => typeof row.label === 'string' && typeof row.value === 'string')));
});

test('only represented namespaces or valid accepted personalization are emitted', () => {
    const output = summarizeProductFacts(readProductNicheFacts({ beauty: { format: 'Cream' } }));
    assert.deepEqual(output.map(section => section.id), ['beauty']);
    const invalidAccepted = { ...accepted, text: '' };
    assert.deepEqual(summarizeProductFacts({}, invalidAccepted).map(section => section.id), ['unavailable']);
});

test('exact saved option tuples are visible for every niche without inferring missing domain facts', () => {
    for (const [namespace, fact] of Object.entries(facts)) {
        const options = { Finish: 'Recorded oil', 'Seat size': 'Wide', 'आकार': 'बड़ा' };
        const output = summarizeProductFacts({ [namespace]: fact }, null, options);
        assert.deepEqual(rows(output, 'selected-options'), Object.entries(options).map(([label, value]) => ({ label, value })));
    }
    assert.deepEqual(summarizeProductFacts({}, null, { 'Pack size': 'Saved 250 g' })[0], { id: 'selected-options', title: 'Saved options', rows: [{ label: 'Pack size', value: 'Saved 250 g' }] });
    let calls = 0;
    const options = Object.assign(Object.create({ inherited: 'PRIVATE' }), { Finish: 'Saved finish' });
    Object.defineProperty(options, 'private', { enumerable: true, get() { calls++; return 'PRIVATE'; } });
    assert.deepEqual(rows(summarizeProductFacts({}, null, options), 'selected-options'), [{ label: 'Finish', value: 'Saved finish' }]);
    assert.equal(calls, 0);
});
