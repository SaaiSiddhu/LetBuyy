// Encoding-only export normalization. No crop, resize, retouch or design change.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const sharp = require(require.resolve('sharp', { paths: [process.env.THREADLINE_NODE_MODULES || '/Users/saai_mithra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const targets = [];
for (const dir of ['images', 'boards']) {
  for (const name of await fs.readdir(path.join(root, dir))) {
    if (name.endsWith('.png')) targets.push(path.join(root, dir, name));
  }
}
targets.push(path.join(root, 'storybook-preview.png'));
let normalized = 0;
for (const file of targets) {
  const bytes = await fs.readFile(file);
  if (bytes.subarray(0, 8).equals(signature)) continue;
  const before = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  const png = await sharp(bytes).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  const after = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  if (!before.data.equals(after.data) || before.info.width !== after.info.width || before.info.height !== after.info.height) throw new Error(`Pixel mismatch: ${file}`);
  await fs.writeFile(file, png);
  normalized += 1;
}
console.log(JSON.stringify({ inspected: targets.length, normalized, decodedPixelsUnchanged: true }));
