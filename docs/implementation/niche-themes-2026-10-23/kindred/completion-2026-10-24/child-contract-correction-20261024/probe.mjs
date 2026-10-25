// Pure captured-bundle/document/production-renderer witness. No live site or UI.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = '/Volumes/Projects/LetBuyy';
const require = createRequire(`${root}/apps/merchant/web/package.json`);
const engine = require('@letbuyy/theme-engine');
const { LiquidRenderer } = require(`${root}/packages/theme-engine/src/theme-renderer.ts`);
const { DEFAULT_THEME_SETTINGS } = require(`${root}/packages/theme-engine/src/theme-settings.ts`);
const artifactPath = `${root}/docs/implementation/niche-theme-programme/release-v2/proposals/81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f/letbuyy-summit-2.0.0.json`;
const before = readFileSync(artifactPath);
const bundle = structuredClone(JSON.parse(before).document.liquidBundle);
const parentId = 'source-only-parent', childId = 'source-only-child', sectionId = 'source-only-spotlight';
bundle.templates.index = {
    name: 'Source-only child contract witness', layout: 'theme', order: [sectionId],
    sections: {
        [sectionId]: {
            type: 'spotlight', settings: {}, disabled: false, block_order: [parentId],
            blocks: {
                [parentId]: {
                    type: 'badge', settings: { label: 'SOURCE_PARENT_LABEL' }, disabled: false,
                    block_order: [childId], blocks: {
                        [childId]: { type: 'badge', settings: { label: 'SOURCE_CHILD_LABEL' }, disabled: false, block_order: [], blocks: {} },
                    },
                },
            },
        },
    },
};
const parsed = engine.parseLiquidThemePackageBundle(bundle);
const document = engine.toThemeDocumentV2(parsed);
const roundtrip = engine.fromThemeDocumentV2(document);
const result = await new LiquidRenderer().render({
    context: { storeId: 'SOURCE_ONLY_NOT_A_RUNTIME_SITE', subdomain: 'source-only', path: '/', previewMode: true, locale: 'en-IN', searchParams: {} },
    storeTemplate: { themeId: 'letbuyy-summit', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidBundle: roundtrip, liquidTemplateKey: 'index',
    liquidContext: { shop: { name: 'Source-only witness' }, collection: { title: '', products: [], total: 0 }, section_products: {} },
});
const section = result.liquid?.sections.find(row => row.id === sectionId);
const parent = section?.blocks.find(row => row.id === parentId);
const child = parent?.sub_blocks?.find(row => row.id === childId);
const after = readFileSync(artifactPath);
const output = {
    recordedAt: new Date().toISOString(),
    classification: 'CAPTURED_KINDRED_CANONICAL_DOCUMENT_AND_PRODUCTION_LIQUID_RENDER_WITNESS_NOT_BROWSER',
    syntheticContextIsNotRuntimeBinding: true,
    allowedChildTypes: bundle.blocks.badge.schema.allowed_child_types ?? 'ABSENT_UNRESTRICTED',
    canonicalBundleAccepted: true,
    canonicalDocumentRoundtripKeepsChild: roundtrip.templates.index.sections[sectionId].blocks[parentId].blocks[childId].settings.label === 'SOURCE_CHILD_LABEL',
    renderStatus: result.status,
    warnings: result.warnings,
    parentPresentInSectionHtml: section?.html.includes('SOURCE_PARENT_LABEL') ?? false,
    childPresentInSectionHtml: section?.html.includes('SOURCE_CHILD_LABEL') ?? false,
    childRenderedInSubBlockModel: child?.html.includes('SOURCE_CHILD_LABEL') ?? false,
    badgeSourceHasChildOutlet: /sub_blocks/.test(bundle.blocks.badge.source),
    parentHtml: parent?.html,
    childHtml: child?.html,
    acceptedArtifactUnchanged: before.equals(after),
    acceptedArtifactSHA256: createHash('sha256').update(after).digest('hex'),
    browserApiDatabaseProviderCalls: 0,
    sourceOrArtifactWrites: 0,
};
writeFileSync(new URL('RESULT.json', import.meta.url), JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify(output) + '\n');
