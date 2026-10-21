import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const MIGRATION_SOURCE = 'database/supabase/migrations/087_theme_template_drafts.sql';
const THEME_ENGINE_SOURCE = 'packages/theme-engine/src/index.ts';
const SHARED_TYPES_SOURCE = 'packages/shared-types/src/index.ts';
const API_CLIENT_SOURCE = 'packages/typescript/api-client/src/index.ts';
const GATEWAY_ROUTE_SOURCE = 'services/api-gateway/src/routes/themes.ts';
const THEME_EXECUTION_SOURCE = 'services/api-gateway/src/execution/theme-execution.adapter.ts';
const EDITOR_ROUTE_SOURCE = 'apps/merchant/web/src/app/api/themes/[themeId]/editor/route.ts';
const DRAFT_ROUTE_SOURCE = 'apps/merchant/web/src/app/api/themes/[themeId]/editor/draft/route.ts';
const EDITOR_PAGE_SOURCE = 'apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx';
const MOBILE_THEME_SERVICE_SOURCE = 'apps/merchant/mobile/lib/services/theme_service.dart';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('theme editor drafts are scoped by template in the database migration', () => {
  const source = read(MIGRATION_SOURCE);

  assert.match(source, /ADD COLUMN IF NOT EXISTS template_key text/);
  assert.match(source, /SET template_key = 'index'\s+WHERE template_key IS NULL/);
  assert.match(source, /ALTER COLUMN template_key SET DEFAULT 'index'/);
  assert.match(source, /ALTER COLUMN template_key SET NOT NULL/);
  assert.match(source, /DROP CONSTRAINT IF EXISTS theme_editor_drafts_store_id_theme_id_key/);
  assert.match(source, /DROP CONSTRAINT IF EXISTS theme_editor_drafts_store_id_theme_id_template_key_key/);
  assert.match(source, /UNIQUE \(store_id, theme_id, template_key\)/);
  assert.match(source, /idx_theme_editor_drafts_store_theme_template/);
});

test('theme editor API contracts carry a validated template key', () => {
  const themeEngineSource = read(THEME_ENGINE_SOURCE);
  const sharedTypesSource = read(SHARED_TYPES_SOURCE);
  const apiClientSource = read(API_CLIENT_SOURCE);

  assert.match(themeEngineSource, /ThemeStoreQuerySchema[\s\S]*template_key: z\.string\(\)\.trim\(\)\.regex/);
  assert.match(themeEngineSource, /SaveThemeDraftSchema[\s\S]*template_key: z\.string\(\)\.trim\(\)\.regex/);
  assert.match(themeEngineSource, /PublishThemeSchema[\s\S]*template_key: z\.string\(\)\.trim\(\)\.regex/);

  assert.match(sharedTypesSource, /ThemeEditorPayloadSchema[\s\S]*template_key: z\.string\(\)\.min\(1\)\.max\(80\)\.default\('index'\)/);
  assert.match(sharedTypesSource, /templates: z\.array\(z\.object\(\{/);
  assert.match(sharedTypesSource, /ThemeDraftSaveResultSchema[\s\S]*template_key: z\.string\(\)\.min\(1\)\.max\(80\)\.default\('index'\)/);
  assert.match(sharedTypesSource, /ThemePublishResultSchema[\s\S]*template_key: z\.string\(\)\.min\(1\)\.max\(80\)\.default\('index'\)/);

  assert.match(apiClientSource, /type SaveThemeDraftInput = \{[\s\S]*template_key\?: string/);
  assert.match(apiClientSource, /type PublishThemeInput = \{[\s\S]*template_key\?: string/);
  assert.match(apiClientSource, /editor: \(slug: string, storeId: string, options\?: LetbuyyRequestOptions\)[\s\S]*query: \{ \.\.\.\(options\?\.query \|\| \{\}\), store_id: storeId \}/);
  assert.match(apiClientSource, /deleteDraft: \(slug: string, storeId: string, options\?: LetbuyyRequestOptions\)[\s\S]*query: \{ \.\.\.\(options\?\.query \|\| \{\}\), store_id: storeId \}/);
});

test('gateway and merchant proxy routes preserve selected template keys', () => {
  const gatewayRouteSource = read(GATEWAY_ROUTE_SOURCE);
  const editorRouteSource = read(EDITOR_ROUTE_SOURCE);
  const draftRouteSource = read(DRAFT_ROUTE_SOURCE);

  assert.match(gatewayRouteSource, /template_key: c\.req\.query\('template_key'\) \|\| c\.req\.query\('template'\) \|\| 'index'/);
  assert.match(gatewayRouteSource, /service\.loadEditor\(slug, parsed\.data\.store_id, customUser\.id, parsed\.data\.template_key\)/);
  assert.match(gatewayRouteSource, /service\.deleteDraft\(slug, parsed\.data\.store_id, customUser\.id, getRequestId\(c\), parsed\.data\.template_key, parsed\.data\)/);

  assert.match(editorRouteSource, /function readTemplateKey\(value: unknown\): string/);
  assert.match(editorRouteSource, /query: \{ template_key: templateKey \}/);
  assert.match(editorRouteSource, /templateKey: editor\.template_key \|\| templateKey/);
  assert.match(editorRouteSource, /template_key: templateKey/);

  assert.match(draftRouteSource, /function readTemplateKey\(value: unknown\): string/);
  assert.match(draftRouteSource, /template_key: templateKey/);
  assert.match(draftRouteSource, /query: \{ template_key: templateKey, base_version: parsed\.data\.base_version, idempotency_key: parsed\.data\.idempotency_key \}/);
  assert.match(draftRouteSource, /templateKey/);
});

test('web and mobile editors can save Liquid bundles and canary state through draft config', () => {
  const themeEngineSource = read(THEME_ENGINE_SOURCE);
  const apiClientSource = read(API_CLIENT_SOURCE);
  const editorRouteSource = read(EDITOR_ROUTE_SOURCE);
  const editorPageSource = read(EDITOR_PAGE_SOURCE);
  const executionSource = read(THEME_EXECUTION_SOURCE);
  const draftRouteSource = read(DRAFT_ROUTE_SOURCE);
  const mobileThemeServiceSource = read(MOBILE_THEME_SERVICE_SOURCE);

  assert.match(themeEngineSource, /PublishThemeSchema[\s\S]*template_config: z\.record\(z\.string\(\), z\.unknown\(\)\)\.optional\(\)/);
  assert.match(apiClientSource, /type PublishThemeInput = \{[\s\S]*template_config\?: JsonRecord/);

  assert.match(draftRouteSource, /function mergeLiquidDraftConfig/);
  assert.match(draftRouteSource, /body\.liquidBundle/);
  assert.match(draftRouteSource, /body\.liquidRenderingCanary/);
  assert.match(draftRouteSource, /template_config: mergeLiquidDraftConfig\(body, draftConfig\)/);

  assert.match(editorRouteSource, /function readPublishTemplateConfig/);
  assert.match(editorRouteSource, /body\.liquidBundle/);
  assert.match(editorRouteSource, /body\.liquidRenderingCanary/);
  assert.match(editorRouteSource, /template_config: templateConfig/);
  assert.match(editorPageSource, /const draftConfig = buildDraftConfig\(baseConfig, themeId, snapshot, selectedTemplateKey\)/);
  assert.match(editorPageSource, /client\.save\(draftConfig, reviewedVersion, ensurePreviewDraft\)/);
  assert.match(editorPageSource, /client\.publish\(async \(intent\) =>/);
  assert.match(editorPageSource, /body: JSON\.stringify\(\{ templateKey: selectedTemplateKey, \.\.\.intent, actorId: client\.actorId, storeId: client\.storeId \}\)/);
  assert.match(executionSource, /const templateConfig = asRecord\(state\.template_config\)/);
  assert.match(executionSource, /state\.has_draft && state\.version === input\.base_version/);

  assert.match(mobileThemeServiceSource, /Future<ThemeDraftSaveResult> saveLiquidDraft/);
  assert.match(mobileThemeServiceSource, /required Map<String, dynamic> liquidBundle/);
  assert.match(mobileThemeServiceSource, /'liquidBundle': liquidBundle/);
  assert.match(mobileThemeServiceSource, /'liquidRenderingCanary': liquidRenderingCanary/);
  assert.match(mobileThemeServiceSource, /Map<String, dynamic>\? templateConfig/);
  assert.match(mobileThemeServiceSource, /Map<String, dynamic>\? liquidBundle/);
  assert.match(mobileThemeServiceSource, /'template_config': jsonDecode\(jsonEncode\(templateConfig\)\)/);
});

test('theme execution stores and publishes drafts by template key', () => {
  const source = read(THEME_EXECUTION_SOURCE);

  assert.match(source, /const DEFAULT_THEME_TEMPLATE_OPTIONS = \[/);
  assert.match(source, /\{ key: 'product', label: 'Product page', type: 'product' \}/);
  assert.match(source, /function listThemeTemplateOptions\(templateConfig: DbRecord\)/);
  assert.match(source, /\.select\('id, draft_config, template_key, version, auto_saved_at'\)[\s\S]*\.eq\('template_key', templateKey\)/);
  assert.match(source, /this\.draftRpc\('mutate_owned_theme_draft_v1', \{[\s\S]*?p_template_key: templateKey, p_base_version: input\.base_version, p_key: input\.idempotency_key,[\s\S]*?p_operation: 'save'/);
  assert.match(source, /p_operation: 'publish', p_config: input\.template_config \|\| null/);
  assert.match(source, /template_key: templateKey/);
  assert.match(source, /p_template_key: normalizeThemeTemplateKey\(templateKeyInput\), p_base_version: intent\.base_version/);
});

test('merchant editor exposes a real template selector and saves the selected template', () => {
  const source = read(EDITOR_PAGE_SOURCE);

  assert.match(source, /type TemplateOption = \{/);
  assert.match(source, /\{ key: 'product', label: 'Product page', type: 'product' \}/);
  assert.match(source, /\{ key: 'collection', label: 'Collection page', type: 'collection' \}/);
  assert.match(source, /\{ key: 'cart', label: 'Cart page', type: 'cart' \}/);
  assert.match(source, /function normalizeTemplateOptions\(value: unknown, templateConfig: JsonRecord\)/);
  assert.match(source, /function buildDraftConfig\(baseConfig: JsonRecord, themeId: string, state: EditorState, templateKey = 'index'\)/);
  assert.match(source, /buildDraftConfig\(baseConfig, themeId, snapshot, selectedTemplateKey\)/);
  assert.match(source, /handleTemplateChange/);
  assert.match(source, /<Select[\s\S]*value=\{selectedTemplateKey\}[\s\S]*templateOptions\.map/);
  assert.doesNotMatch(source, /<span>Home page<\/span>/);
});
