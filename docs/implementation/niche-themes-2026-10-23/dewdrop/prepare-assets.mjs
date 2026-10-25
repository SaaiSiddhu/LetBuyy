import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = process.cwd();
const sharpPath = fs.readdirSync(path.join(root, 'node_modules/.pnpm')).find(name => name.startsWith('sharp@'));
const sharp = require(path.join(root, 'node_modules/.pnpm', sharpPath, 'node_modules/sharp'));
const source = 'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/dewdrop-storybook/assets';
const destination = 'apps/commerce/web/public/theme-assets/dewdrop/v2';
fs.mkdirSync(destination, { recursive: true });
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = [];
for (const [input, output, width] of [['hero.png', 'care-still-life.webp', 1536], ['cleanser.png', 'cloud-rinse.webp', 960], ['cream.png', 'daily-veil.webp', 960], ['tint.png', 'lip-tint.webp', 960]]) {
  const from = path.join(source, input); const to = path.join(destination, output);
  await sharp(from).resize({ width, withoutEnlargement: true }).webp({ quality: 84, effort: 6 }).toFile(to);
  const data = fs.readFileSync(to); const info = await sharp(to).metadata();
  manifest.push({ source: from, sourceSha256: hash(fs.readFileSync(from)), output: to, bytes: data.length, sha256: hash(data), width: info.width, height: info.height, format: info.format, origin: 'Approved original M1 ImageGen artwork; optimization only' });
}
fs.writeFileSync('docs/implementation/niche-themes-2026-10-23/dewdrop/asset-manifest.json', JSON.stringify({ generatedAt: new Date().toISOString(), images: manifest }, null, 2) + '\n');
console.log(JSON.stringify(manifest.map(({ output, bytes, width, height }) => ({ output, bytes, width, height }))));
