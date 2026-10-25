import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createFirstPartyCatalogBundle } from '../../../../../../packages/theme-engine/src/first-party-theme-catalog.ts';
import type { LiquidThemePackageBundle } from '../../../../../../packages/theme-engine/src/theme-bundle.ts';

const root = new URL('../../../../../../', import.meta.url);
const require = createRequire(import.meta.url);
const { withPantryPresentationControls: overlay } = require('./src/pantry-presentation-controls.ts') as { withPantryPresentationControls: (b: LiquidThemePackageBundle) => LiquidThemePackageBundle };
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const inputs = JSON.parse(readFileSync(new URL('CURRENT_INPUTS.json', import.meta.url), 'utf8'));
const verified = inputs.inputs.map((input: { path: string; sha256: string }) => ({ ...input, actualSha256: sha(readFileSync(new URL(input.path, root))) }));
if (verified.some((input: { sha256: string; actualSha256: string }) => input.sha256 !== input.actualSha256)) throw new Error('Base inputs changed; review and rebind before building another private proposal.');
for (const name of ['PROPOSED_BUNDLE.json', 'BUNDLE_DIFF.json']) if (existsSync(new URL(name, import.meta.url))) throw new Error(`Refusing to overwrite sealed ${name}`);
const before = createFirstPartyCatalogBundle('letbuyy-refresh', { designVersion: '2.0.0', pantryVersion: '2.0.1' });
const after = overlay(before);
const changes: { path: string; beforeSha256: string; afterSha256: string }[] = [];
function walk(a: unknown, b: unknown, path: string) {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) walk((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}/${key}`);
  } else changes.push({ path, beforeSha256: sha(JSON.stringify(a) ?? 'undefined'), afterSha256: sha(JSON.stringify(b) ?? 'undefined') });
}
walk(before, after, '');
writeFileSync(new URL('PROPOSED_BUNDLE.json', import.meta.url), JSON.stringify(after, null, 2) + '\n');
writeFileSync(new URL('BUNDLE_DIFF.json', import.meta.url), JSON.stringify({
  recordedAt: new Date().toISOString(), classification: 'PRIVATE_VERSION_NEUTRAL_SOURCE_OVERLAY_NOT_FOR_IMMUTABLE_CAPTURE',
  inputBundleSha256: sha(JSON.stringify(before)), outputBundleSha256: sha(JSON.stringify(after)),
  templatesUnchanged: JSON.stringify(before.templates) === JSON.stringify(after.templates),
  packageIdentityVersionUnchanged: JSON.stringify(before.package) === JSON.stringify(after.package),
  versionOrCaptureDecision: 'PENDING_THEMES; do not replace or publish captured2.0.1 using this private bundle',
  mainWrites: false, installedAcceptance: false, verifiedInputs: verified, changes,
}, null, 2) + '\n');
