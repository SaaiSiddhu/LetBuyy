// LB-9 — Appearance bridge. The merchant Appearance page writes sites.site_settings (snake_case), but the
// storefront never selected or mapped it. This selects it and maps it into the camelCase theme tokens.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const gatewaySelect = read('services/api-gateway/src/routes/storefront.ts');
const storeService = read('apps/storefront-runtime/src/lib/store-service.ts');

test('LB-9: storefront site selects include site_settings', () => {
  // both the release and compat selects must carry site_settings now
  const selects = gatewaySelect.match(/template_config,site_settings/g) || [];
  assert.ok(selects.length >= 2, 'site_settings must be in STOREFRONT_SITE_SELECT and the compat select');
});

test('LB-9: store-service maps snake_case appearance settings into camelCase theme tokens', () => {
  assert.match(storeService, /appearanceSettings = asRecord\(data\.site_settings\)/);
  assert.match(storeService, /primary_color[\s\S]{0,80}primaryColor/);
  assert.match(storeService, /font_family[\s\S]{0,80}fontFamily/);
  assert.match(storeService, /border_radius[\s\S]{0,120}borderRadius/);
});

test('LB-9: merchant appearance overrides the theme bundle (wins the merge) + logo override', () => {
  // appearanceOverrides spread LAST into themeSettingsRecord
  assert.match(storeService, /\.\.\.asRecord\(templateConfig\.themeSettings\),\s*\n\s*\.\.\.appearanceOverrides,/);
  assert.match(storeService, /appearanceSettings\.logo_url[\s\S]{0,80}data\.logo_url/);
});
