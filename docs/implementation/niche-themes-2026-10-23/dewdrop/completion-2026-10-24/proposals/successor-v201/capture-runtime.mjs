// Passive input capture for this pure render lane. No app/database/provider setup.
import { registerHooks, createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const output = resolve(process.env.DD_RENDER_RUN_DIR || '');
const allowed = resolve('docs/implementation/niche-themes-2026-10-23/dewdrop/completion-2026-10-24/proposals/successor-v201');
if (!output.startsWith(allowed + '/runs/')) throw new Error('Private render receipt directory required');
const files = new Set([fileURLToPath(import.meta.url), process.execPath, resolve('package.json'), resolve('pnpm-lock.yaml')]);
const edges = [];
registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    if (result.url.startsWith('file:')) {
      const url = new URL(result.url); url.search = ''; url.hash = '';
      files.add(fileURLToPath(url));
      edges.push({ parent: context.parentURL || null, specifier, resolved: result.url });
    }
    return result;
  },
});
process.on('exit', code => {
  const localRequire = createRequire(resolve('package.json'));
  for (const filename of Object.keys(localRequire.cache)) files.add(filename);
  const inputs = [...files].sort().filter(existsSync).map(path => {
    const bytes = readFileSync(path);
    return { path, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
  });
  writeFileSync(join(output, `runtime-inputs-${process.pid}.json`), JSON.stringify({
    classification: 'OBSERVED_RESOLVE_HOOK_REQUIRE_CACHE_AND_EXPLICIT_BOOTSTRAP_INPUTS',
    pid: process.pid, exitCode: code, node: process.version, execArgv: process.execArgv,
    files: inputs, resolutionEdges: edges,
    limits: 'Runtime resolution/source inputs, not browser/native/DB/provider evidence. Preloader entry, Node binary, package and lockfile included explicitly.',
  }, null, 2) + '\n', { flag: 'wx' });
});
