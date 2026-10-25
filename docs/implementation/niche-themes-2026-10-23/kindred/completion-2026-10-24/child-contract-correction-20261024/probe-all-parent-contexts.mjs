import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = '/Volumes/Projects/LetBuyy';
const require = createRequire(`${root}/apps/merchant/web/package.json`);
const engine = require('@letbuyy/theme-engine');
const { LiquidRenderer } = require(`${root}/packages/theme-engine/src/theme-renderer.ts`);
const { DEFAULT_THEME_SETTINGS } = require(`${root}/packages/theme-engine/src/theme-settings.ts`);
const artifactPath = `${root}/docs/implementation/niche-theme-programme/release-v2/proposals/81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f/letbuyy-summit-2.0.0.json`;
const original = readFileSync(artifactPath);
const captured = JSON.parse(original).document.liquidBundle;
const defaults = fields => Object.fromEntries(fields.filter(field => field.default !== undefined).map(field => [field.id, field.default]));
const rows = [];
for (const [sectionType, file] of Object.entries(captured.sections)) {
    for (const declaration of file.schema.blocks) {
        if (declaration.type === '@app') continue;
        const bundle = structuredClone(captured);
        const sectionId = 'source-only-section', parentId = 'source-only-parent', childId = 'source-only-child';
        const parentFields = declaration.settings.length ? declaration.settings : captured.blocks[declaration.type]?.schema.settings ?? [];
        const settings = defaults(parentFields);
        for (const field of parentFields) if (['text', 'textarea', 'richtext'].includes(field.type)) settings[field.id] = 'SOURCE_PARENT_LABEL';
        bundle.templates.index = {
            name: 'Source-only parent context', layout: 'theme', order: [sectionId],
            sections: {
                [sectionId]: {
                    type: sectionType, settings: defaults(file.schema.settings), disabled: false, block_order: [parentId],
                    blocks: {
                        [parentId]: { type: declaration.type, settings, disabled: false, block_order: [childId], blocks: {
                            [childId]: { type: 'badge', settings: { label: 'SOURCE_CHILD_LABEL' }, disabled: false, block_order: [], blocks: {} },
                        } },
                    },
                },
            },
        };
        const row = { sectionType, parentType: declaration.type, childType: 'badge', canonicalBundleAccepted: false, canonicalRoundtripKeepsChild: false };
        try {
            const parsed = engine.parseLiquidThemePackageBundle(bundle);
            row.canonicalBundleAccepted = true;
            const roundtrip = engine.fromThemeDocumentV2(engine.toThemeDocumentV2(parsed));
            row.canonicalRoundtripKeepsChild = roundtrip.templates.index.sections[sectionId].blocks[parentId].blocks[childId].settings.label === 'SOURCE_CHILD_LABEL';
            const result = await new LiquidRenderer().render({
                context: { storeId: 'SOURCE_ONLY_NOT_A_RUNTIME_SITE', subdomain: 'source-only', path: '/', previewMode: true, locale: 'en-IN', searchParams: {} },
                storeTemplate: { themeId: 'letbuyy-summit', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
                routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
                liquidBundle: roundtrip, liquidTemplateKey: 'index',
                liquidContext: { shop: { name: 'Source-only witness' }, collection: { title: '', products: [], total: 0 }, section_products: {} },
            });
            const section = result.liquid?.sections.find(value => value.id === sectionId);
            const parent = section?.blocks.find(value => value.id === parentId);
            row.renderStatus = result.status;
            row.warnings = result.warnings;
            row.parentInRenderedBlockModel = Boolean(parent);
            row.childInRenderedBlockModel = parent?.sub_blocks?.some(value => value.id === childId) ?? false;
            row.childLabelInSectionHtml = section?.html.includes('SOURCE_CHILD_LABEL') ?? false;
            row.childLabelInPageContent = result.liquid?.contentForLayout.includes('SOURCE_CHILD_LABEL') ?? false;
        } catch (error) {
            row.error = error instanceof Error ? error.message : String(error);
        }
        rows.push(row);
    }
}
const output = {
    recordedAt: new Date().toISOString(),
    classification: 'CAPTURED_KINDRED_ALL_FIRST_PARTY_PARENT_CANONICAL_MODEL_AND_PRODUCTION_RENDER_MATRIX_NOT_BROWSER',
    syntheticContextIsNotRuntimeBinding: true,
    rows,
    totals: {
        firstPartyDeclarations: rows.length,
        canonicalBundleAccepted: rows.filter(row => row.canonicalBundleAccepted).length,
        canonicalRoundtripKeepsChild: rows.filter(row => row.canonicalRoundtripKeepsChild).length,
        renderedStatus: rows.filter(row => row.renderStatus === 'rendered').length,
        childVisibleInSectionHtml: rows.filter(row => row.childLabelInSectionHtml).length,
        childInternallyRendered: rows.filter(row => row.childInRenderedBlockModel).length,
    },
    acceptedArtifactUnchanged: original.equals(readFileSync(artifactPath)),
    acceptedArtifactSHA256: createHash('sha256').update(original).digest('hex'),
    browserApiDatabaseProviderCalls: 0,
    mainSourceAndArtifactWrites: 0,
};
writeFileSync(new URL('RESULT_MATRIX.json', import.meta.url), JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ classification: output.classification, totals: output.totals, acceptedArtifactUnchanged: output.acceptedArtifactUnchanged, errors: rows.filter(row => row.error).map(row => ({ sectionType: row.sectionType, error: row.error })) }) + '\n');
