/** Re-encode approved original artwork; no crop, compositing or generated UI. */
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const sharp = require(resolve('node_modules/.pnpm/sharp@0.34.5/node_modules/sharp'));
const approved = 'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/playfield-storybook/';
const destination = 'apps/commerce/web/public/theme-assets/playfield/v2/';
await mkdir(destination, { recursive: true });
const assets = [];
for (const name of ['activity-hero', 'pattern-studio', 'paper-play', 'arch-paths']) {
  const input = await readFile(approved + 'assets/' + name + '.png');
  const original = await sharp(input).metadata();
  const { data, info } = await sharp(input).resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85, effort: 6 }).toBuffer({ resolveWithObject: true });
  await writeFile(destination + name + '.webp', data);
  assets.push({ file: name + '.webp', width: info.width, height: info.height, bytes: info.size, sha256: createHash('sha256').update(data).digest('hex'), original: { path: approved + 'assets/' + name + '.png', width: original.width, height: original.height, bytes: input.length, sha256: createHash('sha256').update(input).digest('hex') } });
}
const manifest = { version: '2.0.0', provenance: 'Original OpenAI ImageGen artwork created for the Playfield approved design study. Fictional objects; no external brand or product photograph.', approvedEvidence: approved + 'README.md', use: 'Explicit synthetic catalog preview. Never seeded into a live merchant catalog.', processing: 'Sharp 0.34.5, contain within1400x1400, without enlargement, WebP quality85 effort6; no crop or factual object edits; source metadata stripped.', assets };
await writeFile(destination + 'PROVENANCE.json', JSON.stringify(manifest, null, 2) + '\n');
process.stdout.write(JSON.stringify(assets.map(({ file, width, height, bytes }) => ({ file, width, height, bytes })), null, 2) + '\n');
