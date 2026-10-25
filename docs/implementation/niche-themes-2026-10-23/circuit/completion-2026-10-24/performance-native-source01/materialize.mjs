// Source/filesystem operation only. Never imports a worker, runner or native leaf.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, lstatSync, readlinkSync, symlinkSync, realpathSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repo = '/Volumes/Projects/LetBuyy';
const here = dirname(fileURLToPath(import.meta.url));
const allocationPath = 'docs/implementation/niche-theme-programme/completion-2026-10-24/themes-shared-review-20261025-01/CIRCUIT_PERFORMANCE_NATIVE_SOURCE_PREPARATION_ALLOCATION_03.json';
const read = path => readFileSync(path);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const grant = JSON.parse(read(resolve(repo, allocationPath)));
assert.equal(grant.owner, '01a164ba-a97f-7d80-9430-57924218664b');
assert.equal(grant.status, 'GRANTED_CONTAINED_SOURCE_MATERIALIZATION_AND_PREFLIGHT_PLAN_ONLY_NATIVE_QUEUED');
assert(Date.parse(grant.expiresAt) > Date.now());
const source = '/private/tmp/letbuyy-shared-completion-20261024-06';
const target = grant.privateRoot;
assert(!existsSync(target), 'The one new source root must not overwrite an existing candidate');
const packetPath = resolve(repo, 'docs/implementation/niche-themes-2026-10-23/circuit/completion-2026-10-24/performance-amendment02/SEALED_REVIEW_PACKET.json');
assert.equal(sha(read(packetPath)), grant.sealedPacketSha256);
const packet = JSON.parse(read(packetPath));
for (const file of packet.files) assert.equal(sha(read(file.path)), file.sha256);
const baseManifest = JSON.parse(read(resolve(grant.sealedInputRoot, 'SOURCE_MANIFEST.json')));
assert.equal(sha(read(resolve(source, 'source-copy-receipt.json'))), baseManifest.candidateSourceReceiptSha256);
assert.equal(baseManifest.candidateSourceFiles.length, 6547);
const copied = [], links = [], dependencyFiles = [], excludedDependencyNames = [];
mkdirSync(target);
function copy(path, bytes, origin, expected) {
  assert(!isAbsolute(path) && !path.split('/').includes('..'));
  if (expected) assert.equal(sha(bytes), expected, origin);
  const destination = resolve(target, path);
  assert(!existsSync(destination), 'Source overlay would overwrite pinned input: ' + path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, bytes, { flag: 'wx' });
  assert.equal(sha(read(destination)), sha(bytes), 'Independent copied-byte verification');
  copied.push({ path, sha256: sha(bytes), bytes: bytes.length, origin });
}
for (const file of baseManifest.candidateSourceFiles) copy(file.path, read(resolve(source, file.path)), resolve(source, file.path), file.sha256);
const overlays = [
  ['circuit-indexed-performance-qualification.manual.ts', 'services/api-gateway/src/__tests__/owned-db/circuit-indexed-performance-qualification.manual.ts'],
  ['plan-parser.ts', 'services/api-gateway/src/__tests__/owned-db/plan-parser.ts'],
  ['plan-parser.test.ts', 'services/api-gateway/src/__tests__/owned-db/plan-parser.test.ts'],
  ['PERFORMANCE_PROTOCOL.json', 'docs/implementation/niche-theme-programme/completion-2026-10-24/circuit-performance01/PERFORMANCE_PROTOCOL.json'],
  ['SOURCE_MANIFEST.json', 'docs/implementation/niche-theme-programme/completion-2026-10-24/circuit-performance01/PREPARATION_SOURCE_MANIFEST.json'],
  ['HANDOFF.json', 'docs/implementation/niche-theme-programme/completion-2026-10-24/circuit-performance01/PREPARATION_HANDOFF.json'],
];
for (const [name, path] of overlays) {
  const file = packet.files.find(file => file.name === name); assert(file);
  copy(path, read(file.path), file.path, file.sha256);
}
const contained = (base, path) => path === base || path.startsWith(base + '/');
function dependencyLayout(from, to) {
  mkdirSync(to, { recursive: true });
  for (const item of readdirSync(from).sort()) {
    if (['.cache', '.vite', '.turbo'].includes(item) || /^\.env(?:\.|$)/.test(item) || item === '.npmrc') { excludedDependencyNames.push(relative(source, join(from, item))); continue; }
    const old = join(from, item), next = join(to, item), stat = lstatSync(old);
    if (item === '.pnpm') {
      const store = realpathSync(old); assert(store.includes('/node_modules/'));
      symlinkSync(store, next); links.push({ path: relative(target, next), kind: 'READ_ONLY_INSTALLED_VENDOR_STORE', target: store });
    } else if (stat.isSymbolicLink()) {
      const original = resolve(dirname(old), readlinkSync(old));
      let mapped = original;
      if (contained(source, original)) mapped = resolve(target, relative(source, original));
      else if (contained(repo, original) && !original.includes('/node_modules/')) {
        const candidatePath = relative(repo, original); assert(existsSync(resolve(source, candidatePath)), 'Uncaptured workspace alias');
        mapped = resolve(target, candidatePath);
      }
      symlinkSync(mapped, next);
      links.push({ path: relative(target, next), original, target: mapped, kind: mapped.startsWith(target + '/') ? 'CONTAINED_WORKSPACE_OR_LAYOUT' : 'READ_ONLY_INSTALLED_DEPENDENCY' });
    } else if (stat.isDirectory()) dependencyLayout(old, next);
    else if (stat.isFile()) {
      const bytes = read(old); writeFileSync(next, bytes, { mode: stat.mode, flag: 'wx' });
      dependencyFiles.push({ path: relative(target, next), sha256: sha(bytes), bytes: bytes.length });
    } else throw new Error('Unsupported dependency layout entry: ' + old);
  }
}
const packageDirectories = new Set(['']);
for (const file of baseManifest.candidateSourceFiles) if (file.path.endsWith('/package.json')) packageDirectories.add(dirname(file.path));
for (const dir of [...packageDirectories].sort()) {
  const from = resolve(source, dir, 'node_modules');
  if (existsSync(from)) dependencyLayout(from, resolve(target, dir, 'node_modules'));
}
for (const link of links) assert(existsSync(resolve(target, link.path)), 'Dangling materialized dependency: ' + link.path);
const result = { recordedAt: new Date().toISOString(), classification: 'CONTAINED_SOURCE_MATERIALIZATION_NO_RUNTIME_EXECUTION', allocation: { path: allocationPath, sha256: sha(read(resolve(repo, allocationPath))) }, source, target, baseFiles: 6547, sealedPayloadsAndMetadata: overlays.length, files: copied, dependencyLayoutLinks: links, dependencyLayoutFiles: dependencyFiles, excludedDependencyNames, workspaceRule: 'Actual workspace resolutions must remain inside target; installed third-party runtime files are separately pinned read-only inputs, never app source authority.', actualAdmissionCreated: false, databaseDockerModuleRunnerWorkerBuildBrowserProviderActions: 0 };
writeFileSync(resolve(here, 'MATERIALIZATION.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ target, copiedFiles: copied.length, dependencyLinks: links.length, dependencyFiles: dependencyFiles.length, runtimeStarted: false }) + '\n');
