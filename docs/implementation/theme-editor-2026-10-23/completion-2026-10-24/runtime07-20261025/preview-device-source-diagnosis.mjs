// Source-only diagnostic: no browser, listener, fixture, database or provider access.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = '/Volumes/Projects/LetBuyy';
const requireMerchant = createRequire(path.join(root, 'apps/merchant/web/package.json'));
const ts = requireMerchant('typescript');
const protocol = requireMerchant('@letbuyy/theme-engine/editor-bridge-protocol');
const engine = requireMerchant('@letbuyy/theme-engine');
const files = {
  parent: 'apps/merchant/web/src/components/theme-editor/CenterPanel.tsx',
  editor: 'apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx',
  commerce: 'apps/commerce/web/src/app/preview/preview-content.tsx',
  bridge: 'apps/commerce/web/src/app/preview/storefront-preview-bridge.tsx',
  gateway: 'services/api-gateway/src/routes/storefront/public-routes.ts',
  protocol: 'packages/theme-engine/src/editor-bridge-protocol.ts',
};
const sources = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(path.join(root, file), 'utf8')]));
const trees = Object.fromEntries(Object.entries(sources).map(([key, source]) => [key, ts.createSourceFile(files[key], source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)]));
function all(tree, predicate) {
  const result = [];
  function visit(node) { if (predicate(node)) result.push(node); ts.forEachChild(node, visit); }
  visit(tree); return result;
}
function functionText(tree, name) {
  const nodes = all(tree, node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(nodes.length, 1, name); return nodes[0].getText(tree);
}
function callbackText(tree, name) {
  const nodes = all(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === name);
  assert.equal(nodes.length, 1, name); return nodes[0].initializer.arguments[0].getText(tree);
}
function compile(code, deps, returned) {
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function(...Object.keys(deps), js + '\nreturn ' + returned + ';')(...Object.values(deps));
}
const context = { sessionId: '33333333-3333-4333-8333-333333333333', revision: 4, templateKey: 'index' };
const storefrontOrigin = 'https://storefront.example.invalid';
const editorOrigin = 'https://admin.example.invalid';
const urlCallback = callbackText(trees.parent, 'previewUrl');
function previewUrl(viewport, body = urlCallback, previewContext = context, previewToken = 'synthetic-preview-token') {
  return compile('const create = ' + body, { URL, storefrontBaseUrl: storefrontOrigin, storeName: 'synthetic-editor', viewport, previewContext, previewToken }, 'create')();
}
const urls = ['desktop', 'tablet', 'mobile'].map(device => previewUrl(device));
assert.equal(new Set(urls).size, 3);
const keyedFrames = all(trees.parent, node => ts.isJsxAttribute(node) && node.name.getText(trees.parent) === 'key' && node.initializer?.getText(trees.parent) === '{previewUrl}');
assert.equal(keyedFrames.length, 1, 'Actual iframe navigation identity is its URL');

const postCallback = callbackText(trees.parent, 'postSelectionToPreview');
function messages(viewport, body = postCallback, loaded = true, inspectorEnabled = false) {
  const sent = [];
  const fn = compile('const post = ' + body, {
    ...protocol, viewport, previewOrigin: storefrontOrigin, previewContext: context,
    iframeRef: { current: { contentWindow: { postMessage: (data, origin) => sent.push({ data, origin }) } } },
    iframeLoadedRef: { current: loaded }, inspectorEnabled,
    selectedSectionId: null, selectedBlockId: null, identities: {},
  }, 'post');
  fn(); return sent;
}
assert.equal(messages('tablet').some(x => x.data.type === protocol.EDITOR_VIEWPORT_MESSAGE), false);

// Exercise the actual parent handler and its actual timeout effect with controlled events.
const parentHandler = functionText(trees.parent, 'handleMessage');
const timeoutEffects = all(trees.parent, node => ts.isCallExpression(node) && node.expression.getText(trees.parent) === 'useEffect' && node.arguments[0]?.getText(trees.parent).includes('window.setTimeout'));
assert.equal(timeoutEffects.length, 1);
function readyHarness() {
  const frame = {}, errors = [], timers = [], ready = { current: false }, loaded = { current: false };
  const deps = { ...protocol, previewOrigin: storefrontOrigin, previewContext: context,
    iframeRef: { current: { contentWindow: frame } }, previewReadyRef: ready, iframeLoadedRef: loaded,
    identities: {}, setFrameError: x => errors.push(x), setHoveredSection: () => {},
    postSelectionToPreview: () => {}, onSelectBlock: () => {}, onSelectSection: () => {},
    onHoverSection: () => {}, onAddSectionIntent: () => {} };
  const receive = compile(parentHandler, deps, 'handleMessage');
  const install = compile('const effect = ' + timeoutEffects[0].arguments[0].getText(trees.parent), {
    ...deps, previewUrl: urls[0], window: { setTimeout: (fn, delay) => { timers.push({ fn, delay }); return 1; }, clearTimeout: () => {} },
  }, 'effect');
  return { frame, ready, loaded, errors, timers, install,
    send: (messageContext = context, changes = {}) => receive({ origin: storefrontOrigin, source: frame, data: { type: protocol.EDITOR_READY_MESSAGE, context: messageContext }, ...changes }) };
}
const ready = readyHarness(); ready.install(); ready.send();
assert.equal(ready.ready.current, true, 'Positive control accepts exact current iframe context');
ready.install(); // Actual navigation effect clears the previously healthy iframe's readiness.
assert.equal(ready.ready.current, false);
ready.timers.at(-1).fn();
assert.match(ready.errors.at(-1), /could not finish loading/);
assert.equal(ready.timers.at(-1).delay, 20000);
ready.send(context, { origin: 'https://foreign.example.invalid' }); assert.equal(ready.ready.current, false);
ready.send(context, { source: {} }); assert.equal(ready.ready.current, false);
ready.send({ ...context, revision: 5 }); assert.equal(ready.ready.current, false);
ready.send(); assert.equal(ready.ready.current, true);

// A second independent source defect: the token keeps its minted revision, while
// the gateway serves the current mutable draft revision under that session ID.
const assignments = all(trees.gateway, node => ts.isBinaryExpression(node) && node.left.getText(trees.gateway) === 'draftVersion' && node.right.getText(trees.gateway).includes('draftRecord.draft_version'));
assert.equal(assignments.length, 1);
const readCurrentVersion = compile('const value = ' + assignments[0].right.getText(trees.gateway), { draftRecord: { draft_version: 5 }, previewSession: { draft_version: 4 } }, 'value');
assert.equal(readCurrentVersion, 5);
const resolveContext = compile(functionText(trees.commerce, 'asRecord') + '\n' + functionText(trees.commerce, 'resolveEditorPreviewContext'), {
  EditorPreviewContextSchema: protocol.EditorPreviewContextSchema,
  ThemeEditorTemplateKeySchema: engine.ThemeEditorTemplateKeySchema,
  parseTemplateKey: engine.parseTemplateKey, toThemeDocumentV2: engine.toThemeDocumentV2,
  createEditorPreviewIdentityIndex: engine.createEditorPreviewIdentityIndex,
}, 'resolveEditorPreviewContext');
const commerceContext = resolveContext({ subdomain: 'synthetic-editor', templateConfig: {
  liquidBundle: engine.createUrbanKicksLiquidThemeBundleFixture(), releaseVersion: readCurrentVersion,
  releaseManifest: { preview: true, preview_session_id: context.sessionId },
} }, 'index').context;
assert.equal(commerceContext.revision, 5);
assert.equal(protocol.editorPreviewContextMatches(commerceContext, context), false);
const stale = readyHarness(); stale.install(); stale.send(commerceContext); stale.timers[0].fn();
assert.equal(stale.ready.current, false); assert.match(stale.errors.at(-1), /could not finish loading/);

// In-memory repair experiment only; no application source is written.
const proposedUrlCallback = urlCallback.replace("        url.searchParams.set('viewport', viewport)\n", '');
assert.notEqual(proposedUrlCallback, urlCallback);
const stableUrls = ['desktop', 'tablet', 'mobile'].map(device => previewUrl(device, proposedUrlCallback));
assert.equal(new Set(stableUrls).size, 1, 'Device changes preserve the loaded document');
assert.notEqual(previewUrl('desktop', proposedUrlCallback, { ...context, templateKey: 'product' }), stableUrls[0]);
assert.notEqual(previewUrl('desktop', proposedUrlCallback, context, 'synthetic-replacement-token'), stableUrls[0]);
const marker = '        const targetOrigin = previewOrigin\n';
const proposedPost = postCallback.replace(marker, marker + '        frame.contentWindow.postMessage({ type: EDITOR_VIEWPORT_MESSAGE, viewport, context: previewContext }, targetOrigin)\n');
assert.notEqual(proposedPost, postCallback);
assert.equal(messages('mobile', proposedPost, false).length, 0, 'Do not post to an unloaded/blank frame');

const childFunctions = ['asRecord', 'getEditorOrigin', 'normalizeViewport', 'applyViewport', 'handleMessage'].map(name => functionText(trees.bridge, name)).join('\n');
const dataset = {}, parentWindow = {};
const receiveViewport = compile(childFunctions, {
  ...protocol, VIEWPORT_MESSAGE: protocol.EDITOR_VIEWPORT_MESSAGE, LEGACY_VIEWPORT_MESSAGE: protocol.EDITOR_LEGACY_VIEWPORT_MESSAGE,
  LEGACY_SELECTION_MESSAGE: protocol.EDITOR_LEGACY_SELECTION_MESSAGE, SCROLL_MESSAGE: protocol.EDITOR_SCROLL_MESSAGE,
  process: { env: { NEXT_PUBLIC_ADMIN_URL: editorOrigin } }, document: { documentElement: { dataset }, referrer: '' },
  window: { parent: parentWindow }, context, identities: {}, selectSection: () => { throw new Error('Viewport cannot select a section'); },
}, 'handleMessage');
for (const device of ['desktop', 'tablet', 'mobile']) {
  const sent = messages(device, proposedPost); const message = sent.find(x => x.data.type === protocol.EDITOR_VIEWPORT_MESSAGE);
  assert.ok(message); assert.equal(message.origin, storefrontOrigin); assert.deepEqual(message.data.context, context);
  receiveViewport({ origin: editorOrigin, source: parentWindow, data: message.data });
  assert.equal(dataset.letbuyyPreviewViewport, device);
}
const mobileMessage = messages('mobile', proposedPost).find(x => x.data.type === protocol.EDITOR_VIEWPORT_MESSAGE).data;
for (const invalid of [
  { origin: 'https://foreign.example.invalid', source: parentWindow, data: { ...mobileMessage, viewport: 'tablet' } },
  { origin: editorOrigin, source: {}, data: { ...mobileMessage, viewport: 'tablet' } },
  { origin: editorOrigin, source: parentWindow, data: { ...mobileMessage, viewport: 'tablet', context: { ...context, revision: 3 } } },
  { origin: editorOrigin, source: parentWindow, data: { ...mobileMessage, viewport: 'untrusted' } },
]) { receiveViewport(invalid); assert.equal(dataset.letbuyyPreviewViewport, 'mobile'); }

const sourceHashes = Object.fromEntries(Object.entries(files).map(([key, file]) => [file, createHash('sha256').update(sources[key]).digest('hex')]));
const report = {
  recordedAt: new Date().toISOString(), status: 'SOURCE_ONLY_REPRODUCTIONS_AND_IN_MEMORY_REPAIR_EXPERIMENT_PASS',
  sourceHashes, runId: '49ada80bc494', assertions: {
    deviceChangesProduceThreeDistinctIframeKeys: true, deviceChangesDoNotUseExistingViewportProtocol: true,
    actualNavigationEffectResetsReadinessAndTimesOutWithoutFreshReady: true,
    actualGatewayServesCurrentDraftRevisionUnderEarlierMintedSession: true,
    actualCommerceContextAndParentRejectTheRevisionDrift: true,
    proposedViewportOnlyChangesPreserveOneFrameUrl: true, tokenAndTemplateChangesStillNavigate: true,
    existingChildHandlerAppliesAllThreeViewportMessagesWithInspectorOff: true,
    wrongOriginWrongSourceStaleContextInvalidViewportStillRejected: true, unloadedFrameReceivesNoMessage: true,
  },
  limits: 'Pure controlled source-function executions only. No browser, runtime, database, network, source change, or recovery acceptance. Actual recorded about:blank navigation stall is not causally explained by the revision-drift reproduction; these are separate evidenced mechanisms. No claim that an in-memory experiment closes ED-R07-PREVIEW-DEVICE-02.',
};
const destination = path.join(path.dirname(fileURLToPath(import.meta.url)), 'PREVIEW_DEVICE_SOURCE_REPRODUCTION_20261025_01.json');
writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, assertions: Object.keys(report.assertions).length, report: destination, sourceFilesChanged: 0, fixtureOrBrowserProbes: 0 }));
