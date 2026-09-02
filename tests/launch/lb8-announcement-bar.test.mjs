// LB-8 — Announcement bar. The `announcementBar` theme section schema already existed (theme-registry,
// one of the 25 built-in section types) and the theme editor already renders its settings, but the
// storefront had NO renderer for it — themes carrying the section fell through to UnknownSectionFallback.
// This wires a governance-safe renderer: a components/layout/ component (NOT a frozen components/sections
// React section, so the post-Liquid React-section freeze stays intact) + a renderer-registry entry that
// reuses the existing schema.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

const COMPONENT = 'apps/customer_web/src/components/layout/announcement-bar.tsx';
const registry = read('apps/customer_web/src/lib/theme-engine/renderer-registry.tsx');
const component = read(COMPONENT);
const schema = read('packages/theme-engine/src/theme-registry.ts');
const freezeValidator = read('scripts/validators/no-new-react-sections-validator.mjs');

test('LB-8: announcementBar renderer is registered against the existing built-in schema', () => {
  assert.match(registry, /rendererKey: 'core\.announcement-bar'/);
  assert.match(registry, /sectionTypes: \['announcementBar', 'announcement-bar', 'announcement_bar'\]/);
  assert.match(registry, /schema: schemaFor\('announcementBar'\)/);
  assert.match(registry, /import AnnouncementBar/);
});

test('LB-8: the announcementBar section schema already exists in the theme registry', () => {
  assert.match(schema, /type: 'announcementBar'/);
  assert.match(schema, /settings_schema:[\s\S]{0,400}backgroundColor/);
});

test('LB-8 governance: the component lives in components/layout, NOT the frozen components/sections set', () => {
  assert.ok(existsSync(resolve(ROOT, COMPONENT)), 'announcement-bar.tsx must exist under components/layout');
  // the React-section freeze validator only enumerates components/sections/*.tsx; the new file is not there
  assert.doesNotMatch(freezeValidator, /components\/sections\/announcement-bar\.tsx/);
});

test('LB-8: bar is merchant-configurable (text/link/color/alignment), mobile-aware, empty-safe', () => {
  assert.match(component, /shouldDisplayAnnouncement/);
  assert.match(component, /if \(!shouldDisplayAnnouncement\(settings, now\)\) return null/);
  assert.match(component, /visibleOnMobile === false \? 'hidden sm:flex' : 'flex'/);
  assert.match(component, /backgroundColor: settings\.backgroundColor/);
  assert.match(component, /settings\.linkHref && settings\.linkLabel/);
});

test('LB-8 governance: design-system safe — no arbitrary radius or arbitrary px utilities', () => {
  assert.doesNotMatch(component, /rounded-\[/);
  assert.doesNotMatch(component, /\b(?:p|px|py|m|mx|my|gap|gap-x|gap-y)-\[/);
});

test('LB-8: show/hide + schedule-ready — explicit enabled flag and an injected-clock window', () => {
  assert.match(component, /enabled === false/);
  assert.match(component, /startsAt/);
  assert.match(component, /endsAt/);
  assert.match(component, /typeof nowMs === 'number'/);
});
