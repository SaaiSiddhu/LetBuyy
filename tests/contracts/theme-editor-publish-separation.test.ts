import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const editorPageSource = readFileSync(
    join(testDir, '../../apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx'),
    'utf8',
);
const editorRouteSource = readFileSync(
    join(testDir, '../../apps/merchant/web/src/app/api/themes/[themeId]/editor/route.ts'),
    'utf8',
);
const draftRouteSource = readFileSync(
    join(testDir, '../../apps/merchant/web/src/app/api/themes/[themeId]/editor/draft/route.ts'),
    'utf8',
);
const previewSessionRouteSource = readFileSync(
    join(testDir, '../../apps/merchant/web/src/app/api/themes/[themeId]/preview-session/route.ts'),
    'utf8',
);
const gatewayThemeAdapterSource = readFileSync(
    join(testDir, '../../services/api-gateway/src/execution/theme-execution.adapter.ts'),
    'utf8',
);
const themeEngineSource = readFileSync(
    join(testDir, '../../packages/theme-engine/src/index.ts'),
    'utf8',
);
const casMigration = readFileSync(join(testDir, '../../database/supabase/migrations/344_atomic_theme_draft_cas.sql'), 'utf8');
const apiClientSource = readFileSync(
    join(testDir, '../../packages/typescript/api-client/src/index.ts'),
    'utf8',
);

function sourceBetween(source: string, start: string, end: string): string {
    const startIndex = source.indexOf(start);
    assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);
    const endIndex = source.indexOf(end, startIndex + start.length);
    assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);
    return source.slice(startIndex, endIndex);
}

test('merchant publish route publishes saved drafts without saving template config inline', () => {
    const putRoute = sourceBetween(editorRouteSource, 'export async function PUT', '    } catch (err) {');

    assert.doesNotMatch(putRoute, /api\.themes\.saveDraft/);
    assert.match(putRoute, /api\.themes\.publish\(themeId/);
    assert.match(putRoute, /base_version: baseVersion/);
    assert.doesNotMatch(putRoute, /templateConfig is required/);
});

test('web editor saves drafts with base_version and requires a clean draft before publish', () => {
    const saveDraftBlock = sourceBetween(editorPageSource, 'const saveDraft = useCallback', 'const syncPreviewDraft = useCallback');
    const publishBlock = sourceBetween(editorPageSource, 'const handlePublish = useCallback', 'const handleTemplateChange = useCallback');

    assert.match(saveDraftBlock, /client\.save\(draftConfig, reviewedVersion\)/);
    assert.match(publishBlock, /if \(isDirty && !client.hasPendingPublication\)/);
    assert.match(publishBlock, /client\.publish\(async \(intent\)/);
    assert.match(publishBlock, /JSON\.stringify\(\{ templateKey: selectedTemplateKey, \.\.\.intent, actorId: client\.actorId, storeId: client\.storeId \}\)/);
});

test('draft and preview-session app routes forward template and base-version contracts', () => {
    assert.match(draftRouteSource, /body\.baseVersion \?\? body\.base_version/);
    assert.match(draftRouteSource, /SaveThemeDraftSchema\.safeParse/);
    assert.match(draftRouteSource, /idempotency_key: idempotencyKey/);
    assert.match(draftRouteSource, /base_version: baseVersion/);
    assert.match(previewSessionRouteSource, /const templateKey = readTemplateKey/);
    assert.match(previewSessionRouteSource, /template_key: templateKey/);
});

test('gateway preview sessions are template scoped and never maybeSingle an unscoped editor draft', () => {
    const createPreviewSessionBlock = sourceBetween(gatewayThemeAdapterSource, 'async createPreviewSession', 'async listSiteThemes');

    assert.match(themeEngineSource, /export const PreviewTokenSchema = z\.object\(\{[\s\S]*template_key:/);
    assert.match(apiClientSource, /export type ThemePreviewSessionInput = \{[\s\S]*template_key\?: string/);
    assert.match(createPreviewSessionBlock, /const templateKey = normalizeThemeTemplateKey\(input\.template_key\)/);
    assert.match(createPreviewSessionBlock, /this\.readOwnedDraft\(slug, input\.store_id, userId, templateKey\)/);
    assert.match(createPreviewSessionBlock, /state\.theme_instance_draft_id/);
    assert.doesNotMatch(createPreviewSessionBlock, /\.from\('theme_editor_drafts'\)[\s\S]*\.maybeSingle\(\)/);
    assert.match(createPreviewSessionBlock, /template_key: templateKey/);
});

test('template-scoped changes merge under the canonical transaction before draft/patch/receipt writes', () => {
    const saveDraftBlock = sourceBetween(gatewayThemeAdapterSource, 'async saveDraft', 'async reorderDraft');
    assert.match(saveDraftBlock, /this\.draftRpc\('mutate_owned_theme_draft_v1'/);
    assert.doesNotMatch(saveDraftBlock, /\.from\(/);
    assert.match(casMigration, /v_templates:=v_templates\|\|coalesce\(d\.working_manifest/);
    assert.match(casMigration, /jsonb_set\(v_templates,ARRAY\[p_template_key\]/);
    assert.match(casMigration, /INSERT INTO public\.theme_draft_patches/);
    assert.match(casMigration, /INSERT INTO public\.idempotency_keys/);
});
