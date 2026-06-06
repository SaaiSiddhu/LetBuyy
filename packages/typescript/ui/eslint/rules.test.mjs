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

const rawElementReports = runRule(plugin.rules['no-raw-elements'], 'JSXOpeningElement', [
    { type: 'JSXOpeningElement', name: { type: 'JSXIdentifier', name: 'button' } },
    { type: 'JSXOpeningElement', name: { type: 'JSXIdentifier', name: 'input' } },
    { type: 'JSXOpeningElement', name: { type: 'JSXIdentifier', name: 'table' } },
    { type: 'JSXOpeningElement', name: { type: 'JSXIdentifier', name: 'Button' } },
]);

assert.equal(rawElementReports.length, 3, 'raw button/input/table are reported');
assert.deepEqual(
    rawElementReports.map((report) => report.data.replacement),
    ['Button', 'Input', 'Table'],
    'reports include @letbuyy/ui replacements',
);
assert.ok(rawElementReports.every((report) => report.suggest?.length === 1), 'reports include replacement suggestions');

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
assert.ok(plugin.configs.recommended.rules['@letbuyy/ui/no-raw-elements'], 'recommended config exposes raw-element rule');

process.stdout.write('eslint rule self-test passed\n');
