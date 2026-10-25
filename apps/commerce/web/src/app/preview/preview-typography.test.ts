import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { DEFAULT_THEME_SETTINGS, EXPERIENCE_FONT_REGISTRY, fontFamilyWithFallback, type ThemeSettings } from '@letbuyy/theme-engine';

const source = readFileSync(new URL('./preview-content.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('preview-content.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(['FONT_MAP', 'COLOR_PATTERN', 'normalizeColor', 'normalizeFont', 'normalizeBorderRadius', 'cssColor', 'cssRadius', 'buildThemeCss']);
const selected = parsed.statements.filter(node => {
    if (ts.isFunctionDeclaration(node)) return node.name !== undefined && names.has(node.name.text);
    return ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && names.has(declaration.name.text));
});
assert.equal(selected.length, names.size, 'Execute the actual production CSS builder and its actual local dependencies');
const executable = ts.transpileModule(selected.map(node => node.getText(parsed)).join('\n') + '\nreturn { buildThemeCss, normalizeFont };', {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const production = new Function('DEFAULT_THEME_SETTINGS', 'EXPERIENCE_FONT_REGISTRY', 'fontFamilyWithFallback', executable)(
    DEFAULT_THEME_SETTINGS, EXPERIENCE_FONT_REGISTRY, fontFamilyWithFallback,
) as { buildThemeCss(settings: ThemeSettings): string; normalizeFont(value: unknown): string | undefined };

function css(body: unknown, heading: unknown) {
    return production.buildThemeCss({ ...DEFAULT_THEME_SETTINGS, fontFamily: body as string, headingFontFamily: heading as string });
}
function declarations(text: string) {
    return new Map([...text.matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]));
}
function resolved(text: string, name: string): string | undefined {
    const values = declarations(text);
    let value = values.get(name);
    for (let depth = 0; value?.startsWith('var(') && depth < 4; depth++) {
        const alias = /^var\((--[a-z-]+)\)$/.exec(value);
        assert.ok(alias, `Expected a complete existing font-token alias: ${value}`);
        value = values.get(alias[1]);
    }
    return value;
}
const legacy = ['Inter', 'Outfit', 'Poppins', 'Lora', 'Space Grotesk', 'Playfair Display', 'Nunito', 'Open Sans', 'DM Sans', 'Montserrat'];

test('Dewdrop keeps Lato body and Cormorant serif headings as distinct safe stacks', () => {
    const output = css('Lato', 'Cormorant Garamond');
    assert.equal(resolved(output, '--font-main'), fontFamilyWithFallback('Lato') + ', system-ui, sans-serif');
    assert.equal(resolved(output, '--font-heading'), fontFamilyWithFallback('Cormorant Garamond') + ', system-ui, sans-serif');
    assert.match(resolved(output, '--font-heading')!, /"Cormorant Garamond", Georgia, "Times New Roman", serif/);
});
test('every canonical registered family is accepted by the actual draft normalizer and CSS builder', () => {
    for (const family of Object.keys(EXPERIENCE_FONT_REGISTRY)) {
        assert.equal(production.normalizeFont(family), family);
        const output = css(family, family);
        assert.equal(resolved(output, '--font-main'), fontFamilyWithFallback(family) + ', system-ui, sans-serif');
        assert.equal(resolved(output, '--font-heading'), fontFamilyWithFallback(family) + ', system-ui, sans-serif');
    }
});
test('all ten existing approved families retain their prior safe mapped stacks', () => {
    for (const family of legacy) {
        assert.equal(production.normalizeFont(family), family);
        const output = css(family, family);
        assert.equal(resolved(output, '--font-main'), fontFamilyWithFallback(family) + ', system-ui, sans-serif');
        assert.equal(resolved(output, '--font-heading'), fontFamilyWithFallback(family) + ', system-ui, sans-serif');
    }
});
test('body and heading remain distinct in the existing font roles', () => {
    for (const [body, heading] of [['Inter', 'Playfair Display'], ['Lato', 'Cormorant Garamond'], ['Cormorant Garamond', 'Lato']]) {
        const output = css(body, heading);
        assert.equal(resolved(output, '--font-main'), fontFamilyWithFallback(body) + ', system-ui, sans-serif');
        assert.equal(resolved(output, '--font-heading'), fontFamilyWithFallback(heading) + ', system-ui, sans-serif');
        assert.notEqual(resolved(output, '--font-main'), resolved(output, '--font-heading'));
    }
});
test('unknown, prototype and hostile font names never become CSS; fallback stays approved', () => {
    const untrusted: unknown[] = ['Unregistered Font', 'inherit', '__proto__', 'constructor', 'toString', '"Inter";color:red;/*', '</style><script>bad()</script>', 'url(https://example.invalid/font)', null, 12, {}];
    for (const family of untrusted) {
        assert.equal(production.normalizeFont(family), undefined);
        const output = css(family, family);
        assert.equal(resolved(output, '--font-main'), fontFamilyWithFallback('Inter') + ', system-ui, sans-serif');
        assert.equal(resolved(output, '--font-heading'), resolved(output, '--font-main'));
        assert.doesNotMatch(output, /\[object Object\]|\[native code\]|<script>|example\.invalid|color:red/);
    }
});
test('unknown headings follow the safe selected body while unknown bodies retain a known heading', () => {
    assert.equal(resolved(css('Lato', 'Unknown Heading'), '--font-heading'), fontFamilyWithFallback('Lato') + ', system-ui, sans-serif');
    const output = css('Unknown Body', 'Cormorant Garamond');
    assert.equal(resolved(output, '--font-main'), fontFamilyWithFallback('Inter') + ', system-ui, sans-serif');
    assert.equal(resolved(output, '--font-heading'), fontFamilyWithFallback('Cormorant Garamond') + ', system-ui, sans-serif');
});
test('the existing shared Liquid stylesheet import is retained', () => {
    assert.ok(parsed.statements.some(node => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === '../store/[subdomain]/liquid-theme.css'));
});
test('existing CSS declaration names and body/heading selector contracts are unchanged', () => {
    const output = css('Inter', 'Playfair Display');
    assert.deepEqual([...declarations(output).keys()], ['--primary', '--secondary', '--accent', '--background', '--text', '--foreground', '--radius', '--font-main', '--font-heading', '--enable-animations', '--enable-shadows', '--is-dark', '--text-secondary', '--text-muted', '--text-hint', '--text-inverse', '--border-color', '--surface', '--surface-hover', '--card-bg', '--card-bg-secondary', '--card-text', '--card-text-muted', '--card-border', '--header-bg-scrolled', '--header-shadow', '--footer-bg', '--footer-text', '--footer-text-muted', '--input-bg', '--input-border', '--input-text', '--input-placeholder']);
    assert.match(output, /body\s*\{[^}]*font-family:\s*var\(--font-main\);/);
    assert.match(output, /h1, h2, h3, h4, h5, h6\s*\{\s*font-family:\s*var\(--font-heading\);\s*font-weight:\s*600;\s*letter-spacing:\s*0;/);
    assert.equal(resolved(output, '--radius'), `${DEFAULT_THEME_SETTINGS.borderRadius}px`);
});
