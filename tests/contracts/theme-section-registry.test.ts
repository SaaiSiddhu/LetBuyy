import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const rendererRegistrySource = readFileSync(
    join(testDir, '../../apps/commerce/web/src/lib/theme-engine/renderer-registry.tsx'),
    'utf8',
);
const storeServiceSource = readFileSync(
    join(testDir, '../../apps/commerce/web/src/lib/store-service.ts'),
    'utf8',
);
const compositionEngineSource = readFileSync(
    join(testDir, '../../apps/commerce/web/src/lib/theme-engine/composition-engine.tsx'),
    'utf8',
);

test('storefront section registry resolves manifest-declared renderer keys through the approved first-party registry', () => {
    assert.match(rendererRegistrySource, /const SECTION_RENDERER_DEFINITIONS: RegisteredSectionRenderer\[\] = \[/);
    assert.match(rendererRegistrySource, /Object\.fromEntries\(\s*SECTION_RENDERER_DEFINITIONS\.flatMap/);
    assert.match(rendererRegistrySource, /const configuredRendererKey = section\.rendererKey/);
    assert.match(rendererRegistrySource, /typeof section\.settings\.rendererKey === 'string'/);
    assert.match(storeServiceSource, /typeof definition\.renderer_key === 'string'/);
    assert.doesNotMatch(rendererRegistrySource, /switch\s*\(\s*(?:props\.)?section\.type\s*\)/);
});

test('unknown or unsupported section renderers degrade through a visible safe fallback instead of null', () => {
    assert.match(rendererRegistrySource, /function UnknownSectionFallback/);
    assert.match(rendererRegistrySource, /data-theme-section-fallback/);
    assert.match(rendererRegistrySource, /data-section-type=\{section\.type\}/);
    assert.match(rendererRegistrySource, /data-renderer-key=\{rendererKey \|\| 'unresolved'\}/);
    assert.doesNotMatch(rendererRegistrySource, /if \(!rendererKey\) return null/);
    assert.doesNotMatch(rendererRegistrySource, /if \(!renderer\) return null/);
    assert.match(rendererRegistrySource, /return <UnknownSectionFallback/);
});

test('composition engine keeps registry fallback output inside normal and editor section wrappers', () => {
    assert.match(compositionEngineSource, /const renderedSection = renderRegisteredSection/);
    assert.match(compositionEngineSource, /<EditorPreviewSectionFrame/);
    assert.match(compositionEngineSource, /\{renderedSection\}/);
    assert.match(compositionEngineSource, /data-renderer-key=\{rendererKey\}/);
});
