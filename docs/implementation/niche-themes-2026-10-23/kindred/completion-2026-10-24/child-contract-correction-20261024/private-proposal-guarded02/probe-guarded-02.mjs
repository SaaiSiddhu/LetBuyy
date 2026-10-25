import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { withKindredChildOutlets, CHILD_OUTLET } from './opt-in-child-outlets.mjs';

const root = '/Volumes/Projects/LetBuyy';
const work = '/private/tmp/kindred-child-output-20261024-miky7gjz';
const require = createRequire(`${root}/apps/merchant/web/package.json`);
const engine = require('@letbuyy/theme-engine');
const { LiquidRenderer: OriginalRenderer } = require(`${root}/packages/theme-engine/src/theme-renderer.ts`);
const { LiquidRenderer: ProposalRenderer } = require(`${work}/src/theme-renderer.ts`);
const { DEFAULT_THEME_SETTINGS } = require(`${root}/packages/theme-engine/src/theme-settings.ts`);
const artifactPath = `${root}/docs/implementation/niche-theme-programme/release-v2/proposals/81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f/letbuyy-summit-2.0.0.json`;
const artifactBytes = readFileSync(artifactPath);
const captured = JSON.parse(artifactBytes).document.liquidBundle;
const proposal = withKindredChildOutlets(captured);
const checks = [];
const check = (name, passed, detail = {}) => checks.push({ name, passed: Boolean(passed), ...detail });
const stable = value => JSON.stringify(value && typeof value === 'object' ? Array.isArray(value) ? value.map(item => JSON.parse(stable(item))) : Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(stable(value[key]))])) : value);
let forbiddenNetworkCalls = 0;
globalThis.fetch = async () => { forbiddenNetworkCalls++; throw new Error('Network forbidden in source-only render proposal'); };
const defaults = fields => Object.fromEntries(fields.filter(field => field.default !== undefined).map(field => [field.id, field.default]));
const render = async (Renderer, bundle, key = 'index', extra = {}) => new Renderer().render({
    context: { storeId: 'SOURCE_ONLY_NOT_A_RUNTIME_SITE', subdomain: 'source-only', path: '/', previewMode: false, locale: 'en-IN', searchParams: {} },
    storeTemplate: { themeId: 'letbuyy-summit', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key === 'index' ? 'index' : 'collection', layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: key,
    liquidContext: { shop: { name: 'Source-only witness' }, collection: { title: '', products: [], total: 0 }, section_products: {}, buyer_unavailable: true },
    ...extra,
});
const beforeRest = structuredClone(captured), afterRest = structuredClone(proposal);
const changedSections = [];
for (const type of Object.keys(captured.sections)) {
    if (captured.sections[type].source !== proposal.sections[type].source) changedSections.push(type);
    delete beforeRest.sections[type].source; delete afterRest.sections[type].source;
}
delete beforeRest.blocks.badge.source; delete afterRest.blocks.badge.source;
check('All non-source bundle values and declarations remain exact', stable(beforeRest) === stable(afterRest));
check('Only ten existing inline-parent section sources change', changedSections.length === 10);
check('Explicit opt-in helper is immutable', stable(captured) === stable(JSON.parse(artifactBytes).document.liquidBundle));
check('Explicit opt-in helper is idempotent', stable(withKindredChildOutlets(proposal)) === stable(proposal));
try { withKindredChildOutlets({ ...captured, package: { ...captured.package, slug: 'foreign' } }); check('Foreign package refused', false); } catch { check('Foreign package refused', true); }
for (const key of Object.keys(captured.templates)) {
    const first = await render(OriginalRenderer, captured, key), next = await render(ProposalRenderer, proposal, key);
    check(`Default no-child template ${key} preserves rendered HTML`, first.status === next.status && first.liquid?.contentForLayout === next.liquid?.contentForLayout && first.liquid?.layoutHtml === next.liquid?.layoutHtml, { baselineStatus: first.status, proposalStatus: next.status });
}

const block = (type, label, children = {}) => ({ type, settings: { label }, disabled: false, blocks: children, block_order: Object.keys(children) });
const scenario = (base, sectionType, parentType, children) => {
    const bundle = structuredClone(base), schema = bundle.sections[sectionType].schema;
    const declaration = schema.blocks.find(value => value.type === parentType);
    const fields = declaration.settings.length ? declaration.settings : bundle.blocks[parentType]?.schema.settings ?? [];
    const settings = defaults(fields);
    for (const field of fields) if (['text', 'textarea', 'richtext'].includes(field.type)) settings[field.id] = 'SOURCE_PARENT_LABEL';
    bundle.templates.index = { name: 'Source-only child proposal', layout: 'theme', order: ['source-only-section'], sections: {
        'source-only-section': { type: sectionType, settings: defaults(schema.settings), disabled: false, block_order: ['source-only-parent'], blocks: {
            'source-only-parent': { type: parentType, settings, disabled: false, blocks: children, block_order: Object.keys(children) },
        } },
    } };
    return bundle;
};
const html = result => result.liquid?.sections.find(section => section.id === 'source-only-section')?.html ?? '';
const matrix = [];
for (const [sectionType, file] of Object.entries(captured.sections)) {
    for (const declaration of file.schema.blocks) {
        if (declaration.type === '@app') continue;
        const children = { 'source-only-child': block('badge', `SOURCE_CHILD_${sectionType}`) };
        const before = scenario(captured, sectionType, declaration.type, children);
        const after = scenario(proposal, sectionType, declaration.type, children);
        engine.toThemeDocumentV2(before); engine.toThemeDocumentV2(after);
        const first = await render(OriginalRenderer, before), next = await render(ProposalRenderer, after);
        const marker = `SOURCE_CHILD_${sectionType}`;
        check(`Nested badge becomes visible under ${sectionType}/${declaration.type}`, next.status === 'rendered' && !html(first).includes(marker) && html(next).includes(marker));
        matrix.push({ sectionType, parentType: declaration.type, originalVisible: html(first).includes(marker), proposedVisible: html(next).includes(marker), renderStatus: next.status, warnings: next.warnings });
    }
}
const make = children => scenario(proposal, 'spotlight', 'badge', children);
const ordered = make({ 'source-first': block('badge', 'SOURCE_FIRST'), 'source-second': block('badge', 'SOURCE_SECOND') });
let output = html(await render(ProposalRenderer, ordered));
check('Nested sibling order follows canonical block_order', output.indexOf('SOURCE_FIRST') >= 0 && output.indexOf('SOURCE_FIRST') < output.indexOf('SOURCE_SECOND'));
ordered.templates.index.sections['source-only-section'].blocks['source-only-parent'].block_order.reverse();
output = html(await render(ProposalRenderer, ordered));
check('Reordered siblings change visible order without identity rewrite', output.indexOf('SOURCE_SECOND') >= 0 && output.indexOf('SOURCE_SECOND') < output.indexOf('SOURCE_FIRST'));
ordered.templates.index.sections['source-only-section'].blocks['source-only-parent'].blocks['source-first'].disabled = true;
output = html(await render(ProposalRenderer, ordered));
check('Hidden child is absent while sibling remains', !output.includes('SOURCE_FIRST') && output.includes('SOURCE_SECOND'));
ordered.templates.index.sections['source-only-section'].blocks['source-only-parent'].disabled = true;
output = html(await render(ProposalRenderer, ordered));
check('Hidden parent suppresses its descendants', !output.includes('SOURCE_FIRST') && !output.includes('SOURCE_SECOND'));
const deep = make({ 'source-child': block('badge', 'SOURCE_CHILD', { 'source-grandchild': block('badge', 'SOURCE_GRANDCHILD') }) });
engine.toThemeDocumentV2(deep);
check('Canonical depth-three grandchild is visible', html(await render(ProposalRenderer, deep)).includes('SOURCE_GRANDCHILD'));
deep.templates.index.sections['source-only-section'].blocks['source-only-parent'].blocks['source-child'].blocks['source-grandchild'].blocks = { 'source-too-deep': block('badge', 'SOURCE_TOO_DEEP') };
deep.templates.index.sections['source-only-section'].blocks['source-only-parent'].blocks['source-child'].blocks['source-grandchild'].block_order = ['source-too-deep'];
try { engine.toThemeDocumentV2(deep); check('Over-depth canonical document refused', false); } catch { check('Over-depth canonical document refused', true); }
const hostile = make({ 'source-hostile': block('badge', '<img src=x onerror=alert(1)>SOURCE_HOSTILE') });
output = html(await render(ProposalRenderer, hostile));
check('Child text remains escaped through sanitized child HTML outlet', output.includes('SOURCE_HOSTILE') && output.includes('&lt;img') && !output.includes('<img src="x"') && !output.includes('<img src=x'));
const denied = make({ 'source-child': block('badge', 'SOURCE_CHILD') }); denied.blocks.badge.schema.allowed_child_types = [];
try { engine.toThemeDocumentV2(denied); check('Explicit empty child allowlist remains denied', false); } catch { check('Explicit empty child allowlist remains denied', true); }
const { Liquid } = createRequire(`${root}/packages/theme-engine/package.json`)('liquidjs');
const outletEngine = new Liquid({ ownPropertyOnly: true, strictFilters: true, outputEscape: 'escape' });
const guarded = await outletEngine.parseAndRender(CHILD_OUTLET, { block: { sub_blocks: [
    { html: '<span>SOURCE_FIRST_PARTY</span>', is_app_block: false },
    { html: '<span>SOURCE_FORBIDDEN_APP</span>', is_app_block: true },
] } });
check('First-party opt-in outlet emits first-party HTML and excludes app seam HTML', guarded.includes('SOURCE_FIRST_PARTY') && !guarded.includes('SOURCE_FORBIDDEN_APP'));
for (const [sectionType, parentType] of [['spotlight', 'badge'], ['brand-marquee', 'brand']]) {
    const guardedScenario = scenario(proposal, sectionType, parentType, {
        'source-known': block('badge', 'SOURCE_KNOWN_FIRST_PARTY'),
        'source-forbidden-app': block('app:forbidden', 'unused'),
        'source-unknown': block('unknown-source-type', 'unused'),
    });
    const guardedRender = await render(ProposalRenderer, guardedScenario, 'index', { liquidAppBlocks: { 'source-forbidden-app': '<span>SOURCE_APP_MUST_STAY_DORMANT</span>' } });
    const rendered = html(guardedRender);
    check(`${sectionType}: first-party child renders while supplied app/unknown children stay dormant`, guardedRender.status === 'rendered' && rendered.includes('SOURCE_KNOWN_FIRST_PARTY') && !rendered.includes('SOURCE_APP_MUST_STAY_DORMANT') && !rendered.includes('Installed app'));
    if (parentType !== 'badge') {
        const renderedParent = guardedRender.liquid?.sections.find(section => section.id === 'source-only-section')?.blocks.find(parent => parent.id === 'source-only-parent');
        check('Inline child projection contains only installed first-party reusable types', renderedParent?.sub_blocks?.length === 1 && renderedParent.sub_blocks[0].type === 'badge');
    }
}
const allowed = make({ 'source-child': block('badge', 'SOURCE_ALLOWED_CHILD') }); allowed.blocks.badge.schema.allowed_child_types = ['badge'];
try { engine.toThemeDocumentV2(allowed); check('Explicit existing first-party allowlist retains allowed child', html(await render(ProposalRenderer, allowed)).includes('SOURCE_ALLOWED_CHILD')); } catch { check('Explicit existing first-party allowlist retains allowed child', false); }
const restricted = make({ 'source-child': block('badge', 'SOURCE_CHILD') }); restricted.blocks.badge.schema.allowed_child_types = ['different-type'];
try { engine.toThemeDocumentV2(restricted); check('Explicit allowlist excludes a different child', false); } catch { check('Explicit allowlist excludes a different child', true); }
const bound = make(Object.fromEntries(Array.from({length: 100}, (_, index) => [`source-count-${index}`, block('badge', `SOURCE_COUNT_${index}`)])));
try { engine.toThemeDocumentV2(bound); check('Canonical 100-child sibling boundary is retained', true); } catch { check('Canonical 100-child sibling boundary is retained', false); }
bound.templates.index.sections['source-only-section'].blocks['source-only-parent'].blocks['source-count-extra'] = block('badge', 'SOURCE_COUNT_EXTRA');
bound.templates.index.sections['source-only-section'].blocks['source-only-parent'].block_order.push('source-count-extra');
try { engine.toThemeDocumentV2(bound); check('Over-budget child siblings remain refused', false); } catch { check('Over-budget child siblings remain refused', true); }
check('No network call attempted', forbiddenNetworkCalls === 0);
check('Accepted artifact bytes unchanged', artifactBytes.equals(readFileSync(artifactPath)));
const prep = JSON.parse(readFileSync(`${work}/PREPARATION.json`, 'utf8'));
check('Main renderer source unchanged', createHash('sha256').update(readFileSync(`${root}/packages/theme-engine/src/theme-renderer.ts`)).digest('hex') === prep.baseRendererSHA256);
const result = { recordedAt: new Date().toISOString(), classification: 'PRIVATE_EXISTING_RENDERER_AND_EXPLICIT_KINDRED_SUCCESSOR_OUTLET_PROPOSAL_NOT_INSTALLED_OR_RELEASED', checks, totals: { pass: checks.filter(value => value.passed).length, fail: checks.filter(value => !value.passed).length }, matrix, changedSections, versionAssigned: false, artifactEmitted: false, mainApplied: false, networkCalls: forbiddenNetworkCalls, limits: ['Source/library render with synthetic data only; no buyer/browser/DB/provider proof', 'Current default/captured factories remain unchanged; source outlets require explicit successor/version admission', 'Shared renderer source closure and retained security/other-theme regressions require allocator and independent admission', 'APP activation is excluded; existing app branch/schema permissions were not changed'] };
writeFileSync(`${work}/PROBE_GUARDED02_RESULT.json`, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ classification: result.classification, totals: result.totals, parentContextsVisible: matrix.filter(value => value.proposedVisible).length, defaultTemplatesCompared: Object.keys(captured.templates).length, failures: checks.filter(value => !value.passed).map(value => value.name) }) + '\n');
process.exitCode = result.totals.fail ? 1 : 0;
