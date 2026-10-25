// Independent read-only verifier. It does not import the capture implementation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url)), repo = '/Volumes/Projects/LetBuyy';
const hash = value => createHash('sha256').update(value).digest('hex');
const objectHash = value => hash(JSON.stringify(value));
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const loaded = read(join(directory, 'RUNTIME_BOOTSTRAP02.json'));
const closure02 = read(join(directory, 'SOURCE_CLOSURE02.json'));
function check(entry, suppliedPath) {
  const path = suppliedPath || entry.path, bytes = readFileSync(path);
  assert.equal(hash(bytes), entry.sha256, `physical hash ${path}`);
  assert.equal(bytes.length, entry.bytes, `physical bytes ${path}`);
  if (entry.realpath) assert.equal(realpathSync(path), entry.realpath, `physical realpath ${path}`);
}
function command(program, args) {
  assert(['/usr/bin/sw_vers', '/usr/bin/xcrun', '/usr/bin/otool'].includes(program));
  assert(program !== '/usr/bin/xcrun' || args.join(' ') === '--find otool');
  assert(program !== '/usr/bin/sw_vers' || args.length === 0);
  assert(program !== '/usr/bin/otool' || args[0] === '-hv' && args.length === 2 || args[0] === '-arch' && ['arm64', 'arm64e'].includes(args[1]) && args[2] === '-l' && args.length === 4);
  const result = spawnSync(program, args, { encoding: 'utf8', timeout: 10000, maxBuffer: 4194304 });
  assert(!result.error && result.status === 0, `read-only metadata command ${program}: ${result.error?.message || result.stderr}`);
  return result.stdout;
}
function choose(name) {
  for (const dir of process.env.PATH.split(':')) {
    const path = resolve(dir || '.', name);
    try { accessSync(path, constants.X_OK); if (statSync(path).isFile()) return path; } catch {}
  }
  throw new Error(`missing PATH tool ${name}`);
}
function isMachO(path) {
  return new Set(['feedface', 'cefaedfe', 'feedfacf', 'cffaedfe', 'cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca']).has(readFileSync(path).subarray(0, 4).toString('hex'));
}
function system(path) { return path.startsWith('/usr/lib/') || path.startsWith('/System/Library/') || path.startsWith('/System/Volumes/Preboot/'); }
function expand(name, loader, executable) {
  if (name.startsWith('@loader_path')) return resolve(dirname(loader), '.' + name.slice(12));
  if (name.startsWith('@executable_path')) return resolve(dirname(executable), '.' + name.slice(16));
  assert(name.startsWith('/'), `unknown loader token ${name}`); return name;
}
// A separate line-state parser; capture uses load-command blocks instead.
function parseLoader(text) {
  let kind = null;
  const dependencies = [], rpaths = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (/^Load command \d+/.test(line)) kind = null;
    if (line.startsWith('cmd ')) kind = line.slice(4);
    if (kind === 'LC_RPATH' && line.startsWith('path ')) rpaths.push(line.slice(5).replace(/ \(offset \d+\)$/, ''));
    if (['LC_LOAD_DYLIB', 'LC_LOAD_WEAK_DYLIB', 'LC_REEXPORT_DYLIB', 'LC_LOAD_UPWARD_DYLIB', 'LC_LAZY_LOAD_DYLIB', 'LC_LOAD_DYLINKER'].includes(kind) && line.startsWith('name ')) dependencies.push({ command: kind, name: line.slice(5).replace(/ \(offset \d+\)$/, '') });
  }
  assert(dependencies.length || text.includes('LC_SEGMENT'), 'No Mach-O parse');
  return { dependencies, rpaths };
}
function walkFiles(root, relative = '') {
  const path = join(root, relative);
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true }).flatMap(x => x.isDirectory() ? walkFiles(root, join(relative, x.name)) : x.isFile() ? [join(relative, x.name)] : []);
}

function verifyBase(metadata) {
  const b = metadata.baseBindings;
  for (const e of [b.allocation, b.originalSeal, b.originalSourceClosure]) check(e);
  const seal = read(b.originalSeal.path), base = read(b.originalSourceClosure.path);
  assert.equal(objectHash(seal.artifacts), b.originalArtifacts.inventorySha256);
  assert.equal(seal.artifacts.length, b.originalArtifacts.count);
  for (const item of seal.artifacts) check(item, join(repo, item.path));
  for (const category of ['files', 'installedVendorFiles', 'runtimeBootstrapFiles', 'dependencyLayoutFiles', 'dependencyLayoutLinks']) {
    assert.equal(objectHash(base[category]), b.categories[category].inventorySha256);
    assert.equal(base[category].length, b.categories[category].count);
  }
  for (const item of base.files) check(item, join(base.root, item.path));
  for (const item of base.installedVendorFiles) check(item);
  for (const item of base.runtimeBootstrapFiles) check(item);
  for (const item of base.dependencyLayoutFiles) check(item, join(base.root, item.path));
  for (const item of base.dependencyLayoutLinks) {
    const path = join(base.root, item.path);
    assert(lstatSync(path).isSymbolicLink());
    assert.equal(readlinkSync(path), item.target); assert.equal(realpathSync(path), item.realpath);
  }
  assert.equal(objectHash(base.sqlSets), b.sqlSetsSha256);
  for (const [folder, expected] of Object.entries(base.sqlSets)) assert.deepEqual(walkFiles(base.root, folder).sort(), [...expected].sort(), `complete current SQL set ${folder}`);
  assert.deepEqual(seal.materializedLeaves, b.frozenLeaves);
  for (const leaf of b.frozenLeaves) check(leaf);
  return base;
}

const expectedBase = verifyBase(loaded);
const actualOtool = command('/usr/bin/xcrun', ['--find', 'otool']).trim();
const rootPaths = [
  ...['node', 'docker', 'ps', 'lsof', 'dirname', 'sed', 'uname', 'openssl'].map(choose),
  '/bin/sh', '/usr/bin/env', '/usr/bin/security', '/usr/bin/otool', '/usr/bin/xcrun', '/usr/bin/sw_vers', actualOtool,
];
const classic = join(dirname(actualOtool), 'otool-classic');
if (existsSync(classic)) rootPaths.push(classic);
const wrapperNode = join(expectedBase.root, 'node_modules/.bin/node');
if (existsSync(wrapperNode)) rootPaths.push(wrapperNode);
rootPaths.push(...expectedBase.installedVendorFiles.filter(x => isMachO(x.path)).map(x => x.path));
assert.deepEqual(loaded.roots.map(x => x.path), rootPaths, 'independently selected runtime/tool/native roots');
const nativeCache = new Map();
function inspect(path) {
  if (!nativeCache.has(path)) {
    const header = command('/usr/bin/otool', ['-hv', path]);
    const armRows = header.split('\n').map(s => s.trim().split(/\s+/)).filter(s => s[0].startsWith('MH_') && s[1] === 'ARM64');
    const architecture = armRows.some(s => s[2] !== 'E') ? 'arm64' : armRows.some(s => s[2] === 'E') ? 'arm64e' : null;
    assert(architecture, `no actual host-compatible architecture ${path}`);
    const text = command('/usr/bin/otool', ['-arch', architecture, '-l', path]);
    nativeCache.set(path, { text, header, architecture, ...parseLoader(text) });
  }
  return nativeCache.get(path);
}

function verifyGraph(metadata) {
  assert.equal(metadata.environment.allDYLDAndLDPreloadLibraryPathOverridesAbsent, true);
  assert(!Object.keys(process.env).some(name => /^(DYLD_|LD_PRELOAD$|LD_LIBRARY_PATH$)/.test(name) && process.env[name]));
  assert.deepEqual(metadata.environment.pathDirectories, process.env.PATH.split(':'));
  assert.equal(metadata.environment.rawSwVers, command('/usr/bin/sw_vers', []));
  assert(metadata.environment.osBuild.BuildVersion, 'missing actual OS build binding');
  for (const row of metadata.environment.loaderOverrideStates) {
    assert.equal(row.set, Boolean(process.env[row.name])); assert.equal(row.set, false, `unbound runtime selector ${row.name}`);
  }
  assert.equal(metadata.environment.parentExecPath, process.execPath);
  for (const row of metadata.roots) check(row);
  for (const row of metadata.pathTools) { assert.equal(row.path, choose(row.name)); check(row); }
  check(metadata.wrapperInput); check(metadata.esbuildNativeSelectionSource);
  for (const item of Object.values(metadata.metadataTool)) if (item?.sha256) check(item);
  assert.equal(metadata.metadataTool.selectedBackend.realpath, realpathSync(actualOtool));
  const binaryByPath = new Map(metadata.binaries.map(x => [x.realpath, x]));
  assert.equal(binaryByPath.size, metadata.binaries.length, 'duplicate native binary inventory');
  const queue = rootPaths.map(path => ({ path, executable: realpathSync(path), inherited: [] })), contexts = new Map(), requiredBinaries = new Set(), expectedEdges = [], expectedSystems = new Map();
  while (queue.length) {
    assert(contexts.size < 1024);
    const row = queue.shift(), actual = realpathSync(row.path), observed = inspect(actual);
    requiredBinaries.add(actual);
    const binary = binaryByPath.get(actual); assert(binary, `missing required binary ${actual}`); check(binary);
    assert.equal(binary.rawOtoolOutput, observed.text, `actual load commands ${actual}`);
    assert.equal(binary.rawOtoolSha256, hash(observed.text));
    assert.equal(binary.architecture, observed.architecture);
    assert.equal(binary.rawMachHeader, observed.header); assert.equal(binary.rawMachHeaderSha256, hash(observed.header));
    assert.deepEqual(binary.rpaths, observed.rpaths);
    assert.deepEqual(binary.loadCommands.map(d => ({ command: d.command, name: d.name })), observed.dependencies);
    const rpaths = [...new Set([...observed.rpaths.map(r => expand(r, actual, row.executable)), ...row.inherited])];
    const id = objectHash([actual, row.executable, rpaths]);
    if (contexts.has(id)) continue;
    contexts.set(id, { id, path: row.path, realpath: actual, executable: row.executable, rpaths });
    for (const load of observed.dependencies) {
      const candidates = load.name.startsWith('@rpath/') ? rpaths.map(p => join(p, load.name.slice(7))) : [expand(load.name, actual, row.executable)];
      const first = candidates.find(p => existsSync(p)), cachePath = !first && candidates.find(system);
      const edge = { context: id, from: actual, executable: row.executable, loadCommand: load.command, requested: load.name, candidates, selectedPath: first || cachePath || null, realpath: first ? realpathSync(first) : null };
      if (first && !system(first) && !system(edge.realpath)) { edge.disposition = 'HASHED_NON_SYSTEM_RECURSIVE'; queue.push({ path: first, executable: row.executable, inherited: rpaths }); }
      else if (first || cachePath) { edge.disposition = first ? 'OS_SYSTEM_IMAGE_PRESENT' : 'OS_DYLD_SHARED_CACHE_NO_STANDALONE_FILE'; expectedSystems.set(edge.selectedPath, { path: edge.selectedPath, disposition: edge.disposition, standaloneExists: Boolean(first) }); }
      else { assert.equal(load.command, 'LC_LOAD_WEAK_DYLIB', `unresolved required dependency ${load.name}`); edge.disposition = 'ABSENT_OPTIONAL_WEAK_LOAD_ONLY'; }
      expectedEdges.push(edge);
    }
  }
  assert.deepEqual([...requiredBinaries].sort(), [...binaryByPath.keys()].sort(), 'complete recursive binary set');
  assert.deepEqual([...contexts.values()].sort((a, b) => a.id.localeCompare(b.id)), metadata.contexts);
  assert.deepEqual(expectedEdges.sort((a, b) => objectHash(a).localeCompare(objectHash(b))), metadata.edges, 'complete actual path/load-command edges');
  assert.deepEqual([...expectedSystems.values()].sort((a, b) => a.path.localeCompare(b.path)), metadata.systemLibraries.map(s => ({ path: s.path, disposition: s.disposition, standaloneExists: s.standaloneExists })), 'complete system-cache binding');
  for (const s of metadata.systemLibraries) {
    assert.deepEqual(s.osBuild, metadata.environment.osBuild);
    if (s.standaloneExists) check(s.file); else { assert(!s.file); assert(!existsSync(s.path)); }
  }
  assert.equal(metadata.futureParentResourcePolicy.preflight.wholeParentWallSeconds, 180);
  assert.equal(metadata.futureParentResourcePolicy.preflight.perSuiteTimeoutIsWholeParentBound, false);
  assert.equal(metadata.futureParentResourcePolicy.qualification.automaticChainFromPreflight, false);
  return { binaries: requiredBinaries.size, contexts: contexts.size, edges: expectedEdges.length, systemLibraries: expectedSystems.size };
}

check(closure02.additiveRuntimeBootstrap);
assert.deepEqual(closure02.base, loaded.baseBindings);
for (const script of closure02.discoveryScripts) check(script);
const counts = verifyGraph(loaded);
const library = loaded.binaries.find(x => x.path.endsWith('/libnode.127.dylib'));
assert(library, 'actual Node runtime library must exist in supplement');
const guards = [
  ['missing_actual_node_dynamic_library', m => { m.binaries = m.binaries.filter(x => x.path !== library.path); }],
  ['corrupt_actual_node_dynamic_library_hash', m => { m.binaries.find(x => x.path === library.path).sha256 = '0'.repeat(64); }],
  ['missing_required_dynamic_loader_edge', m => { const i = m.edges.findIndex(x => x.requested === '@rpath/libnode.127.dylib'); assert(i >= 0); m.edges.splice(i, 1); }],
  ['corrupt_esbuild_native_bytes_pin', m => { m.binaries.find(x => x.path.includes('@esbuild/darwin-arm64/bin/esbuild')).sha256 = '0'.repeat(64); }],
  ['missing_system_shared_cache_binding', m => { const i = m.systemLibraries.findIndex(x => !x.standaloneExists); assert(i >= 0); m.systemLibraries.splice(i, 1); }],
  ['missing_path_docker_tool_pin', m => { m.pathTools = m.pathTools.filter(x => x.name !== 'docker'); m.roots = m.roots.filter(x => x.name !== 'docker'); }],
];
const negativeResults = [];
for (const [name, mutate] of guards) {
  const copy = structuredClone(loaded); mutate(copy);
  // Roots must always equal independently discovered required roots, not just declared roots.
  let refused = false;
  try { assert.deepEqual(copy.roots.map(x => x.path), rootPaths); assert.equal(copy.pathTools.length, 8); verifyGraph(copy); } catch { refused = true; }
  assert(refused, `guard did not reject ${name}`); negativeResults.push({ name, status: 'PASS_REFUSED_IN_MEMORY_ONLY' });
}
console.log(JSON.stringify({ status: 'PASS_INDEPENDENT_RUNTIME_BOOTSTRAP_REDISCOVERY', counts, negativeControls: negativeResults, originalSourceFiles: expectedBase.files.length, originalVendorFiles: expectedBase.installedVendorFiles.length, originalSourceOrLibrariesMutated: false, nativeOrDockerOrDBExecution: false }));
