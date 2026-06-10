import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readStorefrontRouteSource } from '../helpers/app-store-route-source.mjs';

const APP_ENGINE_SOURCE = readFileSync('packages/shared-types/src/app-platform.ts', 'utf8');
const STOREFRONT_ROUTE_SOURCE = readStorefrontRouteSource();
const STORE_SERVICE_SOURCE = readFileSync('apps/storefront-runtime/src/lib/store-service.ts', 'utf8');
const APP_BLOCK_SLOT_SOURCE = readFileSync('apps/storefront-runtime/src/components/sections/app-block-slot.tsx', 'utf8');
const RENDERER_REGISTRY_SOURCE = readFileSync('apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx', 'utf8');

test('shared app-platform owns Built-for-LetBuyy quality gate rules', () => {
  assert.match(APP_ENGINE_SOURCE, /export function evaluateBuiltForLetBuyyQualityGate/);
  assert.match(APP_ENGINE_SOURCE, /performanceScore >= 70/);
  assert.match(APP_ENGINE_SOURCE, /reviewCount >= 1 && ratingAverage >= 4/);
  assert.match(APP_ENGINE_SOURCE, /installCount >= 1/);
  assert.match(APP_ENGINE_SOURCE, /hasStorefrontAppBlock/);
  assert.match(APP_ENGINE_SOURCE, /Built-for-LetBuyy quality gate failed/);
});

test('gateway exposes active installed storefront app blocks in public store payloads', () => {
  assert.match(STOREFRONT_ROUTE_SOURCE, /loadPublicStorefrontAppBlocks/);
  assert.match(STOREFRONT_ROUTE_SOURCE, /\.from\('app_installations'\)/);
  assert.match(STOREFRONT_ROUTE_SOURCE, /marketplace_apps\(id, name, slug, app_url, app_extensions/);
  assert.match(STOREFRONT_ROUTE_SOURCE, /type === 'storefront_block' \|\| type === 'app-block' \|\| type === 'app_block'/);
  assert.match(STOREFRONT_ROUTE_SOURCE, /normalizeAppBlockInstance/);
  assert.match(STOREFRONT_ROUTE_SOURCE, /app_blocks: appBlocks/);
});

test('storefront injects app blocks into JSON-contract theme templates', () => {
  assert.match(STORE_SERVICE_SOURCE, /normalizeAppBlockInstances/);
  assert.match(STORE_SERVICE_SOURCE, /injectAppBlocksIntoSections/);
  assert.match(STORE_SERVICE_SOURCE, /injectAppBlocksIntoTemplates/);
  assert.match(STORE_SERVICE_SOURCE, /rendererKey: 'apps\.app-block-slot'/);
  assert.match(STORE_SERVICE_SOURCE, /const appBlocks = data\.app_blocks/);
});

test('storefront app-block-slot renderer is active and identifiable in markup', () => {
  assert.match(RENDERER_REGISTRY_SOURCE, /rendererKey: 'apps\.app-block-slot'/);
  assert.match(RENDERER_REGISTRY_SOURCE, /sectionTypes: \['appBlockSlot', 'app-block-slot', 'app_block_slot'\]/);
  assert.match(APP_BLOCK_SLOT_SOURCE, /data-app-block-slot=\{slot\}/);
  assert.match(APP_BLOCK_SLOT_SOURCE, /data-app-block-app-id=\{block\.app_id\}/);
});
