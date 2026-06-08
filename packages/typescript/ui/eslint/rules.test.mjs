import assert from 'node:assert/strict';
import plugin from './index.cjs';

function runRule(rule, visitorName, nodes) {
    const reports = [];
    const context = {
        report(report) {
            reports.push(report);
        },
    };
    const visitor = rule.create(context)[visitorName];
    assert.equal(typeof visitor, 'function', `${visitorName} visitor exists`);
    for (const node of nodes) visitor(node);
    return reports;
}

function jsx(name) {
    return { type: 'JSXOpeningElement', name: { type: 'JSXIdentifier', name } };
}

// --- no-raw-elements (unchanged behaviour: button/input/table only) ---
const rawElementReports = runRule(plugin.rules['no-raw-elements'], 'JSXOpeningElement', [
    jsx('button'),
    jsx('input'),
    jsx('table'),
    jsx('Button'),
    jsx('select'),
    jsx('textarea'),
]);

assert.equal(rawElementReports.length, 3, 'raw button/input/table are reported (select/textarea are NOT in this rule)');
assert.deepEqual(
    rawElementReports.map((report) => report.data.replacement),
    ['Button', 'Input', 'Table'],
    'reports include @letbuyy/ui replacements',
);
assert.ok(rawElementReports.every((report) => report.suggest?.length === 1), 'reports include replacement suggestions');

// --- no-raw-form-controls (new: select/textarea/dialog) ---
const formControlReports = runRule(plugin.rules['no-raw-form-controls'], 'JSXOpeningElement', [
    jsx('select'),
    jsx('textarea'),
    jsx('dialog'),
    jsx('input'),
    jsx('Select'),
]);
assert.equal(formControlReports.length, 3, 'raw select/textarea/dialog are reported');
assert.deepEqual(
    formControlReports.map((report) => report.data.replacement),
    ['Select', 'Textarea', 'Modal'],
    'form-control reports include @letbuyy/ui replacements',
);

// --- no-hardcoded-hex ---
const literalHexReports = runRule(plugin.rules['no-hardcoded-hex'], 'Literal', [
    { type: 'Literal', value: '#8B5CF6' },
    { type: 'Literal', value: 'text-[color:var(--lb-color-text)]' },
    { type: 'Literal', value: 'border #fff background' },
]);
assert.equal(literalHexReports.length, 2, 'literal hardcoded hex colors are reported');

const templateHexReports = runRule(plugin.rules['no-hardcoded-hex'], 'TemplateElement', [
    { type: 'TemplateElement', value: { raw: 'color: #111827;', cooked: 'color: #111827;' } },
]);
assert.equal(templateHexReports.length, 1, 'template hardcoded hex colors are reported');

// --- no-raw-color-functions (new: rgb()/hsl()) ---
const colorFnReports = runRule(plugin.rules['no-raw-color-functions'], 'Literal', [
    { type: 'Literal', value: 'rgb(139 92 246)' },
    { type: 'Literal', value: 'color: hsla(0,0%,0%,0.5)' },
    { type: 'Literal', value: 'bg-[var(--lb-color-surface)]' },
]);
assert.equal(colorFnReports.length, 2, 'raw rgb()/hsl() colors are reported, token vars are not');

// --- no-tailwind-default-color (new: Tailwind default palette utilities) ---
const tailwindReports = runRule(plugin.rules['no-tailwind-default-color'], 'Literal', [
    { type: 'Literal', value: 'bg-gray-500 text-white' },
    { type: 'Literal', value: 'border-slate-200' },
    { type: 'Literal', value: 'bg-[var(--lb-color-surface)] text-left rounded-md' },
    { type: 'Literal', value: 'flex items-center gap-2' },
]);
assert.equal(tailwindReports.length, 2, 'tailwind default-palette utilities are reported, token utilities are not');

// --- recommended config exposes all five rules ---
const recommended = plugin.configs.recommended.rules;
for (const ruleName of [
    '@letbuyy/ui/no-raw-elements',
    '@letbuyy/ui/no-hardcoded-hex',
    '@letbuyy/ui/no-raw-form-controls',
    '@letbuyy/ui/no-raw-color-functions',
    '@letbuyy/ui/no-tailwind-default-color',
]) {
    assert.ok(recommended[ruleName], `recommended config exposes ${ruleName}`);
}
assert.equal(recommended['@letbuyy/ui/no-raw-elements'], 'error', 'no-raw-elements stays error');
assert.equal(recommended['@letbuyy/ui/no-tailwind-default-color'], 'warn', 'tailwind rule ships at warn');

process.stdout.write('eslint rule self-test passed\n');
