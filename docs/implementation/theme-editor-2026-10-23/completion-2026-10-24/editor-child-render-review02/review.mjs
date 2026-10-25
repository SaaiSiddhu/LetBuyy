import Module, { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import dns from 'node:dns';

const root = '/Volumes/Projects/LetBuyy';
const prepPath = process.argv[2];
const prep = JSON.parse(readFileSync(prepPath, 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const checks = [], findings = [], compileTrace = new Map();
const check = (id, passed, detail = {}) => checks.push({ id, passed: Boolean(passed), ...detail });
let networkAttempts = 0;
const denyNetwork = () => { networkAttempts++; throw new Error('Independent source review forbids network'); };
globalThis.fetch = denyNetwork;
for (const target of [http, https]) { target.request = denyNetwork; target.get = denyNetwork; }
net.connect = denyNetwork; net.createConnection = denyNetwork;
dns.lookup = denyNetwork; dns.resolve = denyNetwork;
const originalCompile = Module.prototype._compile;
Module.prototype._compile = function (content, filename) {
    if (filename.startsWith(root + '/packages/') || filename.startsWith(prep.work + '/src/') || filename.includes('/components/theme-editor/')) {
        compileTrace.set(filename, { path: filename, sourceSHA256AtCompile: sha(readFileSync(filename)), compiledSHA256: sha(content) });
    }
    return originalCompile.call(this, content, filename);
};
const require = createRequire(root + '/apps/merchant/web/package.json');
const grant = JSON.parse(readFileSync(prep.grant, 'utf8'));
const declaredInputs = [...grant.currentMainInputs, grant.sealedRenderer, grant.sealedOutletHelper, grant.sealedHandoff].map(item => {
    const path = item.path.startsWith('/') ? item.path : root + '/' + item.path;
    return { path, sha256: item.sha256 };
});
for (const input of declaredInputs) {
    if (sha(readFileSync(input.path)) !== input.sha256) throw new Error('Declared review input drift: ' + input.path);
}
const domain = require('@letbuyy/theme-engine');
const { LiquidRenderer: MainRenderer } = require(root + '/packages/theme-engine/src/theme-renderer.ts');
const { LiquidRenderer: CandidateRenderer } = require(prep.work + '/src/theme-renderer.ts');
const actions = require(root + '/apps/merchant/web/src/components/theme-editor/editor-block-actions.ts');
const { DEFAULT_THEME_SETTINGS } = require(root + '/packages/theme-engine/src/theme-settings.ts');
const { withKindredChildOutlets, CHILD_OUTLET } = await import(grant.sealedOutletHelper.path.startsWith('/')
    ? grant.sealedOutletHelper.path : root + '/' + grant.sealedOutletHelper.path);
const artifactPath = root + '/docs/implementation/niche-theme-programme/release-v2/proposals/81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f/letbuyy-summit-2.0.0.json';
const artifactBytes = readFileSync(artifactPath);
const captured = JSON.parse(artifactBytes).document.liquidBundle;
const candidate = withKindredChildOutlets(captured);
const defaults = fields => Object.fromEntries(fields.filter(field => field.default !== undefined).map(field => [field.id, field.default]));
const block = (label, children = {}, type = 'badge') => ({ type, settings: { label }, disabled: false, blocks: children, block_order: Object.keys(children) });
const sectionId = 'review-section', parentId = 'review-parent';
const render = (Renderer, bundle, key = 'index', extra = {}) => new Renderer().render({
    context: { storeId: 'INDEPENDENT_SOURCE_ONLY', subdomain: 'independent-source-only', path: '/', previewMode: false, locale: 'en-IN', searchParams: {} },
    storeTemplate: { themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key === 'index' ? 'index' : 'collection', layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: key,
    liquidContext: { shop: { name: 'Independent source review' }, collection: { title: '', products: [], total: 0 }, section_products: {}, buyer_unavailable: true },
    ...extra,
});
const selectedSection = result => result.liquid?.sections.find(section => section.id === sectionId);
const html = result => selectedSection(result)?.html ?? '';
const scenario = (base, sectionType, parentType, children) => {
    const bundle = structuredClone(base), schema = bundle.sections[sectionType].schema;
    const declaration = schema.blocks.find(item => item.type === parentType);
    const fields = declaration.settings.length ? declaration.settings : bundle.blocks[parentType]?.schema.settings ?? [];
    const settings = defaults(fields);
    for (const field of fields) if (['text', 'textarea', 'richtext'].includes(field.type)) settings[field.id] = 'REVIEW_PARENT';
    bundle.templates.index = { name: 'Independent source witness', layout: 'theme', order: [sectionId], sections: {
        [sectionId]: { type: sectionType, settings: defaults(schema.settings), disabled: false, block_order: [parentId], blocks: {
            [parentId]: { type: parentType, settings, disabled: false, blocks: children, block_order: Object.keys(children) },
        } },
    } };
    return bundle;
};
let fatal = null;
const matrix = [], defaultParity = [], editorCapability = [];
try {
    check('distinct_actual_renderer_classes', MainRenderer !== CandidateRenderer);
    const beforeRest = structuredClone(captured), afterRest = structuredClone(candidate), changedSections = [];
    for (const key of Object.keys(captured.sections)) {
        if (captured.sections[key].source !== candidate.sections[key].source) changedSections.push(key);
        delete beforeRest.sections[key].source; delete afterRest.sections[key].source;
    }
    delete beforeRest.blocks.badge.source; delete afterRest.blocks.badge.source;
    check('declarations_settings_defaults_composition_unchanged', stable(beforeRest) === stable(afterRest));
    check('only_ten_inline_section_sources_changed', changedSections.length === 10, { changedSections });
    check('outlet_transform_immutable', stable(captured) === stable(JSON.parse(artifactBytes).document.liquidBundle));
    check('outlet_transform_idempotent', stable(candidate) === stable(withKindredChildOutlets(candidate)));
    let refused = false;
    try { withKindredChildOutlets({ ...captured, package: { ...captured.package, slug: 'foreign-source-only' } }); } catch { refused = true; }
    check('outlet_transform_foreign_package_refused', refused);
    for (const key of Object.keys(captured.templates)) {
        const baseline = await render(MainRenderer, captured, key), proposed = await render(CandidateRenderer, candidate, key);
        const a = { status: baseline.status, html: baseline.liquid?.contentForLayout, layout: baseline.liquid?.layoutHtml };
        const b = { status: proposed.status, html: proposed.liquid?.contentForLayout, layout: proposed.liquid?.layoutHtml };
        const pass = a.status === 'rendered' && b.status === 'rendered' && typeof a.html === 'string' && stable(a) === stable(b);
        check('default_parity_' + key, pass);
        defaultParity.push({ key, baselineStatus: a.status, proposedStatus: b.status, baselineSHA256: sha(stable(a)), proposedSHA256: sha(stable(b)), pass });
    }
    const manifest = domain.buildLiquidThemePackagePersistencePayload(candidate).schemaManifest;
    for (const [sectionType, section] of Object.entries(captured.sections)) {
        for (const declaration of section.schema.blocks.filter(item => item.type !== '@app')) {
            const marker = 'REVIEW_CHILD_' + sectionType;
            const children = { 'review-child': block(marker) };
            const before = scenario(captured, sectionType, declaration.type, children);
            const after = scenario(candidate, sectionType, declaration.type, children);
            const document = domain.toThemeDocumentV2(after), reloaded = domain.fromThemeDocumentV2(document);
            const baseline = await render(MainRenderer, before), proposed = await render(CandidateRenderer, reloaded);
            const visible = baseline.status === 'rendered' && proposed.status === 'rendered' && !html(baseline).includes(marker) && html(proposed).includes(marker);
            check('visible_child_' + sectionType + '_' + declaration.type, visible);
            check('roundtrip_identity_' + sectionType, stable(after.templates.index.sections[sectionId]) === stable(reloaded.templates.index.sections[sectionId]));
            matrix.push({ sectionType, parentType: declaration.type, baselineChildVisible: html(baseline).includes(marker), proposedChildVisible: html(proposed).includes(marker), roundtripPreserved: stable(after.templates.index.sections[sectionId]) === stable(reloaded.templates.index.sections[sectionId]) });
            const catalog = actions.editorBlockCatalog(manifest.section_schemas[sectionType], candidate);
            const uiSection = { id: sectionId, type: sectionType, order: 10, visible: true, settings: {}, blocks: [{ id: parentId, type: declaration.type, order: 10, visible: true, settings: {}, children: [] }] };
            const canAdd = actions.canAddEditorBlock(uiSection, catalog, parentId, 'badge');
            const reusableParent = Object.hasOwn(candidate.blocks, declaration.type);
            check('current_editor_capability_observed_' + sectionType, canAdd === reusableParent, { reusableParent, canAdd });
            editorCapability.push({ sectionType, parentType: declaration.type, reusableParent, currentEditorCanAdd: canAdd, candidateChildVisible: visible, remainingIntegration: !canAdd });
        }
    }
    const make = children => scenario(candidate, 'spotlight', 'badge', children);
    const siblings = make({ 'review-a': block('REVIEW_A'), 'review-b': block('REVIEW_B') });
    let output = html(await render(CandidateRenderer, siblings));
    check('sibling_order', output.includes('REVIEW_A') && output.indexOf('REVIEW_A') < output.indexOf('REVIEW_B'));
    siblings.templates.index.sections[sectionId].blocks[parentId].block_order.reverse();
    output = html(await render(CandidateRenderer, siblings));
    check('sibling_reorder_identity', output.includes('REVIEW_B') && output.indexOf('REVIEW_B') < output.indexOf('REVIEW_A'));
    siblings.templates.index.sections[sectionId].blocks[parentId].blocks['review-a'].disabled = true;
    output = html(await render(CandidateRenderer, siblings));
    check('hidden_child', !output.includes('REVIEW_A') && output.includes('REVIEW_B'));
    siblings.templates.index.sections[sectionId].blocks[parentId].disabled = true;
    output = html(await render(CandidateRenderer, siblings));
    check('hidden_parent', !output.includes('REVIEW_A') && !output.includes('REVIEW_B'));
    const deep = make({ 'review-child': block('REVIEW_CHILD', { 'review-grandchild': block('REVIEW_GRANDCHILD') }) });
    const reloadedDeep = domain.fromThemeDocumentV2(domain.toThemeDocumentV2(deep));
    check('depth_three_visible_after_roundtrip', html(await render(CandidateRenderer, reloadedDeep)).includes('REVIEW_GRANDCHILD'));
    const parent = deep.templates.index.sections[sectionId].blocks[parentId];
    parent.blocks['review-child'].blocks['review-grandchild'].blocks = { 'review-too-deep': block('REVIEW_TOO_DEEP') };
    parent.blocks['review-child'].blocks['review-grandchild'].block_order = ['review-too-deep'];
    refused = false; try { domain.toThemeDocumentV2(deep); } catch { refused = true; }
    check('depth_four_refused', refused);
    for (const [label, allowedTypes, expected] of [['missing', undefined, true], ['empty', [], false], ['allowed', ['badge'], true], ['different', ['different-type'], false]]) {
        const input = make({ 'review-child': block('REVIEW_ALLOWLIST') });
        if (allowedTypes === undefined) delete input.blocks.badge.schema.allowed_child_types;
        else input.blocks.badge.schema.allowed_child_types = allowedTypes;
        let accepted = false; try { domain.toThemeDocumentV2(input); accepted = true; } catch {}
        check('canonical_allowlist_' + label, accepted === expected);
        if (accepted) check('visible_allowlist_' + label, html(await render(CandidateRenderer, input)).includes('REVIEW_ALLOWLIST'));
    }
    const bounded = make(Object.fromEntries(Array.from({ length: 100 }, (_, i) => ['review-count-' + i, block('REVIEW_COUNT_' + i + '_END')])));
    const boundedReload = domain.fromThemeDocumentV2(domain.toThemeDocumentV2(bounded));
    output = html(await render(CandidateRenderer, boundedReload));
    check('all_one_hundred_children_visible', Array.from({ length: 100 }, (_, i) => output.includes('REVIEW_COUNT_' + i + '_END')).every(Boolean));
    bounded.templates.index.sections[sectionId].blocks[parentId].blocks['review-count-extra'] = block('REVIEW_COUNT_EXTRA');
    bounded.templates.index.sections[sectionId].blocks[parentId].block_order.push('review-count-extra');
    refused = false; try { domain.toThemeDocumentV2(bounded); } catch { refused = true; }
    check('one_hundred_one_children_refused', refused);
    const hostile = make({ 'review-hostile': block('<img src=x onerror=alert(1)><script>REVIEW_ACTIVE</script>REVIEW_HOSTILE {{7|times:7}}') });
    output = html(await render(CandidateRenderer, hostile));
    check('hostile_setting_escaped_not_reparsed', output.includes('REVIEW_HOSTILE {{7|times:7}}') && output.includes('&lt;img') && !/<img\b|<script\b/i.test(output));
    for (const [sectionType, type] of [['spotlight', 'badge'], ['brand-marquee', 'brand']]) {
        const input = scenario(candidate, sectionType, type, {
            'review-firstparty': block('REVIEW_KNOWN'),
            'review-app': block('REVIEW_APP_SETTING', {}, 'app:forbidden'),
            'review-unknown': block('REVIEW_UNKNOWN', {}, 'unknown-review-type'),
        });
        const rendered = await render(CandidateRenderer, input, 'index', { liquidAppBlocks: { 'review-app': '<span>REVIEW_INJECTED_APP_HTML</span>' } });
        output = html(rendered);
        check('firstparty_only_output_' + sectionType, output.includes('REVIEW_KNOWN') && !output.includes('REVIEW_INJECTED_APP_HTML') && !output.includes('REVIEW_UNKNOWN') && !output.includes('REVIEW_APP_SETTING'));
        if (type === 'brand') {
            const projected = selectedSection(rendered)?.blocks.find(item => item.id === parentId)?.sub_blocks ?? [];
            check('inline_projected_children_firstparty_only', projected.length === 1 && projected[0].type === 'badge');
        }
    }
    const { Liquid } = createRequire(root + '/packages/theme-engine/package.json')('liquidjs');
    const isolatedOutlet = await new Liquid({ ownPropertyOnly: true, strictFilters: true, outputEscape: 'escape' }).parseAndRender(CHILD_OUTLET, { block: { sub_blocks: [{ html: '<span>REVIEW_ALLOWED</span>', is_app_block: false }, { html: '<span>REVIEW_APP_DORMANT</span>', is_app_block: true }] } });
    check('outlet_excludes_supplied_app_html', isolatedOutlet.includes('REVIEW_ALLOWED') && !isolatedOutlet.includes('REVIEW_APP_DORMANT'));
    findings.push({ id: 'EDITOR-INLINE-CHILD-UI-04', status: 'OPEN_EXECUTABLY_REPRODUCED', affectedContexts: editorCapability.filter(item => item.remainingIntegration), description: 'Visible candidate inline children are still unavailable through current sealed Editor03 child-add eligibility.' });
    findings.push({ id: 'EDITOR-FIRSTPARTY-CHILD-OUTPUT-01', status: 'KINDRED_PRIVATE_SOURCE_CANDIDATE_REVIEWED_ONLY', otherThemes: 'Not transformed or closed by this Kindred-only outlet helper; versioned owner integration required.' });
} catch (error) {
    fatal = { name: error?.name ?? 'Error', message: String(error?.message ?? error).slice(0, 500) };
    check('harness_completed', false, { fatal });
} finally {
    Module.prototype._compile = originalCompile;
}
check('zero_network_attempts', networkAttempts === 0);
check('frozen_artifact_unchanged', artifactBytes.equals(readFileSync(artifactPath)));
for (const input of declaredInputs) check('declared_input_preserved_' + input.path, sha(readFileSync(input.path)) === input.sha256);
const overlayChanges = [];
for (const item of prep.manifest) {
    const main = root + '/packages/theme-engine/src/' + item.relativePath;
    const copy = prep.work + '/src/' + item.relativePath;
    if (sha(readFileSync(main)) !== item.mainSHA256 || sha(readFileSync(copy)) !== item.reviewSHA256) overlayChanges.push(item.relativePath);
}
check('all_ninety_two_main_and_overlay_inputs_preserved', overlayChanges.length === 0, { overlayChanges });
const cachedFiles = Object.keys(require.cache).filter(path => existsSync(path)).sort().map(path => ({ path, sha256AfterRun: sha(readFileSync(path)) }));
const trace = [...compileTrace.values()].sort((a, b) => a.path.localeCompare(b.path));
check('compiled_source_trace_unchanged', trace.every(item => sha(readFileSync(item.path)) === item.sourceSHA256AtCompile));
const result = {
    recordedAt: new Date().toISOString(), classification: 'ONE_FINITE_INDEPENDENT_CURRENT_SOURCE_KINDRED_RENDER_REVIEW_NO_INSTALLED_CREDIT',
    grant: { path: prep.grant, sha256: sha(readFileSync(prep.grant)) },
    actualRuntime: { version: process.version, executable: process.execPath, scriptSHA256: sha(readFileSync(import.meta.filename)) },
    preparation: { path: prepPath, sha256: sha(readFileSync(prepPath)), privateOverlay: prep.work, catalogueRebinding: prep.rebinding },
    declaredInputs, artifact: { path: artifactPath, sha256: sha(artifactBytes) },
    checks, totals: { pass: checks.filter(item => item.passed).length, fail: checks.filter(item => !item.passed).length },
    defaultParity, matrix, editorCapability, findings, networkAttempts, fatal,
    graph: { compileTrace: trace, cachedFiles, explicitESMHelper: declaredInputs.find(item => item.path.endsWith('opt-in-child-outlets.mjs')), scope: 'Actual in-process CJS compilation/source hashes plus current require.cache files and explicit ESM helper. This is not a complete trace of the tsx loader ESM vendor graph.' },
    preservation: { mainWrites: 0, frozenWrites: 0, originalOwnerProposalWrites: 0, browser: 0, database: 0, native: 0, build: 0, server: 0, provider: 0 },
    limits: ['Private source-library rendering with synthetic values only', 'No editor UI Save/reload/preview/publish or installed case promotion', 'No successor version/package emitted or accepted', 'Full shared sandbox/other-theme/performance gates remain allocation-owned', 'All10 certification false; historical58 and initial50 are not additive'],
};
writeFileSync(prep.output + '/RESULT.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ totals: result.totals, defaultTemplates: defaultParity.length, visibleParentContexts: matrix.filter(item => item.proposedChildVisible).length, editorInlineGaps: editorCapability.filter(item => item.remainingIntegration).length, tracedSourceModules: trace.length, cachedFiles: cachedFiles.length, networkAttempts, fatal, failedChecks: checks.filter(item => !item.passed).map(item => item.id) }) + '\n');
process.exitCode = result.totals.fail ? 1 : 0;
