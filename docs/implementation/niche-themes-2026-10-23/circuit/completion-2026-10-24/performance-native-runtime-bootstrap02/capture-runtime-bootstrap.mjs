// Metadata only: no application/runner/native-module import, Docker or database call.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, lstatSync, readFileSync, readlinkSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repo = '/Volumes/Projects/LetBuyy';
export const output = dirname(fileURLToPath(import.meta.url));
export const sourceDirectory = resolve(output, '../performance-native-source01');
const allocationPath = join(repo, 'docs/implementation/niche-theme-programme/completion-2026-10-24/themes-shared-review-20261025-01/CIRCUIT_RUNTIME_BOOTSTRAP_METADATA_ALLOCATION_04.json');
export const sha = value => createHash('sha256').update(value).digest('hex');
export const digestObject = value => sha(JSON.stringify(value));
export const readJSON = path => JSON.parse(readFileSync(path, 'utf8'));
export function pin(path) {
  const actual = realpathSync(path), bytes = readFileSync(actual);
  return { path, realpath: actual, sha256: sha(bytes), bytes: bytes.length };
}
const systemPath = p => p.startsWith('/usr/lib/') || p.startsWith('/System/Library/') || p.startsWith('/System/Volumes/Preboot/');
export function macho(path) {
  const data = readFileSync(path);
  return ['feedface', 'cefaedfe', 'feedfacf', 'cffaedfe', 'cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca'].includes(data.subarray(0, 4).toString('hex'));
}
function allowedCommand(command, args) {
  assert(['/usr/bin/otool', '/usr/bin/sw_vers', '/usr/bin/xcrun'].includes(command));
  if (command.endsWith('otool')) assert(args[0] === '-hv' && args.length === 2 || args[0] === '-arch' && ['arm64', 'arm64e'].includes(args[1]) && args[2] === '-l' && args.length === 4);
  if (command.endsWith('xcrun')) assert.deepEqual(args, ['--find', 'otool']);
  if (command.endsWith('sw_vers')) assert.equal(args.length, 0);
}
function inspect(command, args) {
  allowedCommand(command, args);
  const p = spawnSync(command, args, { encoding: 'utf8', timeout: 10000, maxBuffer: 4 * 1024 * 1024 });
  assert(!p.error && p.status === 0, `Metadata command failed: ${command} ${args.join(' ')} ${p.error?.message || p.stderr}`);
  return p.stdout;
}
function assertPin(entry, path = entry.path) {
  const actual = pin(path);
  assert.equal(actual.sha256, entry.sha256, `Hash drift: ${path}`);
  assert.equal(actual.bytes, entry.bytes, `Length drift: ${path}`);
  if (entry.realpath) assert.equal(actual.realpath, entry.realpath, `Realpath drift: ${path}`);
}

export function bindBase() {
  const allocation = readJSON(allocationPath);
  const sealPath = join(repo, allocation.baseSeal.path), closurePath = join(repo, allocation.baseClosure.path);
  assert.equal(pin(sealPath).sha256, allocation.baseSeal.sha256);
  assert.equal(pin(closurePath).sha256, allocation.baseClosure.sha256);
  const seal = readJSON(sealPath), closure = readJSON(closurePath);
  assert.equal(closure.root, allocation.privateSourceReadOnly);
  for (const entry of seal.artifacts) assertPin(entry, join(repo, entry.path));
  for (const entry of closure.files) assertPin(entry, join(closure.root, entry.path));
  for (const entry of closure.installedVendorFiles) assertPin(entry);
  for (const entry of closure.runtimeBootstrapFiles) assertPin(entry);
  for (const entry of closure.dependencyLayoutFiles) assertPin(entry, join(closure.root, entry.path));
  for (const entry of closure.dependencyLayoutLinks) {
    const p = join(closure.root, entry.path);
    assert(lstatSync(p).isSymbolicLink(), `Missing symlink: ${p}`);
    assert.equal(readlinkSync(p), entry.target);
    assert.equal(realpathSync(p), entry.realpath);
  }
  const categories = Object.fromEntries(['files', 'installedVendorFiles', 'runtimeBootstrapFiles', 'dependencyLayoutFiles', 'dependencyLayoutLinks'].map(k => [k, { count: closure[k].length, inventorySha256: digestObject(closure[k]) }]));
  return { allocation, closure, seal, reference: {
    allocation: pin(allocationPath), originalSeal: pin(sealPath), originalSourceClosure: pin(closurePath),
    originalArtifacts: { count: seal.artifacts.length, inventorySha256: digestObject(seal.artifacts) },
    categories, sqlSetsSha256: digestObject(closure.sqlSets),
    frozenLeaves: seal.materializedLeaves,
    physicalValidation: 'All original artifacts/source/vendor/layout/bootstrap contents and links rechecked without changes',
  } };
}

export function discoverTool(name) {
  for (const directory of process.env.PATH.split(':')) {
    const p = resolve(directory || '.', name);
    try { accessSync(p, constants.X_OK); if (statSync(p).isFile()) return { name, ...pin(p) }; } catch {}
  }
  throw new Error(`Required installed tool not found: ${name}`);
}

export function discoverRoots(closure) {
  const names = ['node', 'docker', 'ps', 'lsof', 'dirname', 'sed', 'uname', 'openssl'];
  const tools = names.map(discoverTool);
  assert.equal(tools.find(x => x.name === 'node').realpath, realpathSync(process.execPath), 'PATH node differs from source-bound parent');
  const wrapper = join(closure.root, 'node_modules/.bin/tsx');
  const localNode = join(dirname(wrapper), 'node');
  const hasLocalNode = existsSync(localNode);
  const fixed = ['/bin/sh', '/usr/bin/env', '/usr/bin/security', '/usr/bin/otool', '/usr/bin/xcrun', '/usr/bin/sw_vers'];
  const actualOtool = inspect('/usr/bin/xcrun', ['--find', 'otool']).trim();
  assert(isAbsolute(actualOtool));
  fixed.push(actualOtool);
  const classicOtool = join(dirname(actualOtool), 'otool-classic');
  if (existsSync(classicOtool)) fixed.push(classicOtool);
  if (hasLocalNode) fixed.push(localNode);
  const vendorNative = closure.installedVendorFiles.filter(x => macho(x.path)).map(x => ({ ...pin(x.path), origin: 'BASE_INSTALLED_VENDOR_MACHO' }));
  assert(vendorNative.some(x => x.path.includes('@esbuild/darwin-arm64/bin/esbuild')));
  const esbuild = closure.installedVendorPackages.find(x => x.name === 'esbuild');
  assert(esbuild);
  const nativeSelectionSource = pin(join(esbuild.root, 'lib/main.js'));
  assert(readFileSync(nativeSelectionSource.path, 'utf8').includes('ESBUILD_BINARY_PATH'));
  const roots = [...tools.map(t => ({ ...t, origin: ['openssl'].includes(t.name) ? 'IMPORTED_HELPER_DORMANT_TOOL_NOT_AUTHORIZED_FOR_PROBE' : 'PATH_TOOL' })), ...fixed.map(path => ({ ...pin(path), origin: path === actualOtool ? 'SELECTED_XCODE_METADATA_TOOL' : 'FIXED_INTERPRETER_OR_TOOL' })), ...vendorNative];
  const wrapperInput = pin(wrapper);
  assert(readFileSync(wrapper, 'utf8').startsWith('#!/bin/sh'));
  return { roots, tools, wrapperInput, wrapperLocalNode: { path: localNode, exists: hasLocalNode, selected: hasLocalNode ? pin(localNode) : tools.find(x => x.name === 'node') }, actualOtool, classicOtool: existsSync(classicOtool) ? classicOtool : null, nativeSelectionSource };
}

function commandsFor(path) {
  const header = inspect('/usr/bin/otool', ['-hv', path]);
  const subtypes = [...header.matchAll(/^MH_\S+\s+ARM64\s+(\S+)/gm)].map(m => m[1]);
  const architecture = subtypes.some(x => x !== 'E') ? 'arm64' : subtypes.includes('E') ? 'arm64e' : null;
  assert(architecture, `No native arm64/arm64e slice: ${path}`);
  const raw = inspect('/usr/bin/otool', ['-arch', architecture, '-l', path]);
  const blocks = raw.split(/(?=^Load command \d+)/m).filter(s => /^Load command /m.test(s));
  const loads = [], rpaths = [], metadata = [];
  for (const block of blocks) {
    const command = block.match(/^\s*cmd (\S+)/m)?.[1];
    assert(command, `Malformed Mach-O metadata: ${path}`);
    if (['LC_LOAD_DYLIB', 'LC_LOAD_WEAK_DYLIB', 'LC_REEXPORT_DYLIB', 'LC_LOAD_UPWARD_DYLIB', 'LC_LAZY_LOAD_DYLIB', 'LC_LOAD_DYLINKER'].includes(command)) {
      const name = block.match(/^\s*name (.*?) \(offset \d+\)/m)?.[1];
      assert(name, `Missing loader dependency: ${path}`);
      loads.push({ command, name, weak: command === 'LC_LOAD_WEAK_DYLIB', raw: block.trimEnd() });
    }
    if (command === 'LC_RPATH') {
      const value = block.match(/^\s*path (.*?) \(offset \d+\)/m)?.[1]; assert(value); rpaths.push(value);
    }
    if (['LC_UUID', 'LC_BUILD_VERSION', 'LC_VERSION_MIN_MACOSX', 'LC_ID_DYLIB', 'LC_CODE_SIGNATURE'].includes(command)) metadata.push({ command, raw: block.trimEnd() });
  }
  assert(blocks.length > 0, `No actual arm64 load commands: ${path}`);
  return { architecture, rawMachHeader: header, rawMachHeaderSha256: sha(header), loadCommands: loads, rpaths, identityCommands: metadata, rawOtoolOutput: raw, rawOtoolSha256: sha(raw) };
}
const uniq = values => [...new Set(values)];
function expand(value, loader, executable) {
  if (value.startsWith('@loader_path')) return resolve(dirname(loader), '.' + value.slice('@loader_path'.length));
  if (value.startsWith('@executable_path')) return resolve(dirname(executable), '.' + value.slice('@executable_path'.length));
  assert(isAbsolute(value), `Unsupported loader path: ${value}`);
  return value;
}

export function collect() {
  const started = Date.now();
  const { allocation, closure, reference } = bindBase();
  assert(Date.now() < Date.parse(allocation.expiresAt), 'Metadata grant expired');
  assert.equal(allocation.status, 'PRIVATE_READ_ONLY_SOURCE_AND_TOOL_METADATA_SUPPLEMENT_ONLY');
  const relevantOverrides = ['DYLD_LIBRARY_PATH', 'DYLD_FRAMEWORK_PATH', 'DYLD_FALLBACK_LIBRARY_PATH', 'DYLD_FALLBACK_FRAMEWORK_PATH', 'DYLD_INSERT_LIBRARIES', 'DYLD_ROOT_PATH', 'ESBUILD_BINARY_PATH', 'NODE_OPTIONS', 'NODE_PATH'];
  const loaderOverrideStates = relevantOverrides.map(name => ({ name, set: Boolean(process.env[name]) }));
  assert(loaderOverrideStates.every(x => !x.set), 'An unbound runtime/loader selector is set; record refusal without revealing its value');
  assert(!Object.keys(process.env).some(name => /^(DYLD_|LD_PRELOAD$|LD_LIBRARY_PATH$)/.test(name) && process.env[name]), 'Unbound dynamic-loader override present; values are never recorded');
  const discovered = discoverRoots(closure);
  const osRaw = inspect('/usr/bin/sw_vers', []);
  const osBuild = Object.fromEntries(osRaw.trim().split('\n').map(line => { const i = line.indexOf(':'); return [line.slice(0, i), line.slice(i + 1).trim()]; }));
  assert(osBuild.BuildVersion && process.arch === 'arm64' && process.platform === 'darwin');
  const binaries = new Map(), edges = [], contexts = [], seen = new Set(), systems = new Map();
  const queue = discovered.roots.map(r => ({ path: r.path, executable: r.realpath, inherited: [] }));
  while (queue.length) {
    assert(Date.now() - started < 120000, 'Read-only metadata discovery exceeded 120 seconds');
    assert(seen.size < 1024 && binaries.size < 256, 'Finite metadata bound exceeded');
    const current = queue.shift(), actual = realpathSync(current.path);
    let binary = binaries.get(actual);
    if (!binary) {
      assert(macho(actual), `Selected executable/native input is not Mach-O: ${actual}`);
      binary = { ...pin(actual), ...commandsFor(actual) }; binaries.set(actual, binary);
    }
    const rpaths = uniq([...binary.rpaths.map(p => expand(p, actual, current.executable)), ...current.inherited]);
    const key = digestObject([actual, current.executable, rpaths]);
    if (seen.has(key)) continue;
    seen.add(key); contexts.push({ id: key, path: current.path, realpath: actual, executable: current.executable, rpaths });
    for (const dep of binary.loadCommands) {
      const candidates = dep.name.startsWith('@rpath/') ? rpaths.map(p => join(p, dep.name.slice(7))) : [expand(dep.name, actual, current.executable)];
      const selected = candidates.find(p => existsSync(p));
      const cached = !selected && candidates.find(systemPath);
      const edge = { context: key, from: actual, executable: current.executable, loadCommand: dep.command, requested: dep.name, candidates, selectedPath: selected || cached || null, realpath: selected ? realpathSync(selected) : null };
      if (selected && !systemPath(selected) && !systemPath(edge.realpath)) {
        edge.disposition = 'HASHED_NON_SYSTEM_RECURSIVE';
        queue.push({ path: selected, executable: current.executable, inherited: rpaths });
      } else if (selected || cached) {
        edge.disposition = selected ? 'OS_SYSTEM_IMAGE_PRESENT' : 'OS_DYLD_SHARED_CACHE_NO_STANDALONE_FILE';
        systems.set(edge.selectedPath, { path: edge.selectedPath, disposition: edge.disposition, standaloneExists: Boolean(selected), ...(selected ? { file: pin(selected) } : {}), osBuild, transitiveBinding: 'Apple system framework/cache closure bound to exact installed OS build; no fabricated individual absent-library hashes.' });
      } else {
        assert(dep.weak, `Unresolved required non-system library: ${dep.name} from ${actual}`);
        edge.disposition = 'ABSENT_OPTIONAL_WEAK_LOAD_ONLY';
      }
      edges.push(edge);
    }
  }
  const parentPolicy = {
    status: 'PROPOSED_ONLY_REQUIRES_LATER_EXACT_RESOURCE_ACTIVATION',
    preflight: { wholeParentWallSeconds: 180, startsBefore: 'First provisioning/daemon/resource action, not just the test child', includes: ['Provisioning', '322 migration application', 'Actual module/log probe', 'Canonical own-resource cleanup and post-cleanup evidence'], perSuiteTimeoutIsWholeParentBound: false, supervisor: 'Later activation must bind a separately reviewed parent watchdog and own-run cleanup policy; no supervisor executable or resource action is created here.', onDeadline: 'Retain actual failure/overrun and own-resource terminal cleanup outcome. Never report PASS from child TAP alone; never signal or reap existing user/runtime resources.' },
    qualification: { wholeParentWallSeconds: 600, automaticChainFromPreflight: false, needs: 'Accepted real preflight receipt, actual own-run TAP/migration/cleanup, fresh source gate and separate exact activation' },
    actualInstalledImageIds: 'LATE_BOUND_UNINSPECTED_NO_DOCKER_COMMANDS',
    currentQueue: 'Capture pair, then Root conditional apparel cohort; Circuit has no native lease.',
  };
  return {
    schemaVersion: 2, classification: 'ADDITIVE_READONLY_RUNTIME_BOOTSTRAP_METADATA_NOT_NATIVE_ACCEPTANCE',
    sourceRoot: closure.root, baseBindings: reference,
    environment: { platform: process.platform, architecture: process.arch, parentExecPath: process.execPath, parentVersion: process.version, osBuild, rawSwVers: osRaw, pathDirectories: process.env.PATH.split(':'), loaderOverrideStates, allDYLDAndLDPreloadLibraryPathOverridesAbsent: true, futureRequirement: 'Exact no-override state and PATH selections must be revalidated at later source/resource gate; tsx wrapper own declared NODE_PATH references remain pinned source bytes, not permission to add unknown source.' },
    roots: discovered.roots, pathTools: discovered.tools, wrapperInput: discovered.wrapperInput, wrapperLocalNode: discovered.wrapperLocalNode,
    esbuildNativeSelectionSource: discovered.nativeSelectionSource,
    metadataTool: { frontEnd: pin('/usr/bin/otool'), xcrun: pin('/usr/bin/xcrun'), selectedBackend: pin(discovered.actualOtool), ...(discovered.classicOtool ? { classicBackend: pin(discovered.classicOtool) } : {}), swVers: pin('/usr/bin/sw_vers'), commandsExecuted: ['otool -hv <pinned executable/library>', 'otool -arch <actual arm64/arm64e slice> -l <pinned executable/library>', 'xcrun --find otool', 'sw_vers'] },
    binaries: [...binaries.values()].sort((a, b) => a.path.localeCompare(b.path)),
    contexts: contexts.sort((a, b) => a.id.localeCompare(b.id)),
    edges: edges.sort((a, b) => digestObject(a).localeCompare(digestObject(b))),
    systemLibraries: [...systems.values()].sort((a, b) => a.path.localeCompare(b.path)),
    limits: { metadataWholeCollectionSeconds: 120, perMetadataCommandSeconds: 10, maxMetadataCommandBytes: 4194304, maxBinaryNodes: 256, maxLoaderContexts: 1024 },
    futureParentResourcePolicy: parentPolicy,
    actions: { originalInputsChanged: 0, sourceOrPriorSealEdits: 0, applicationRunnerOrNativeModuleEvaluations: 0, DockerDaemonOrImageCommands: 0, DBOrSQLCommands: 0, actualAdmissionsCreated: 0, unchanged36TestsRerun: false },
  };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runtime = collect(), runtimePath = join(output, 'RUNTIME_BOOTSTRAP02.json');
  writeFileSync(runtimePath, JSON.stringify(runtime, null, 2) + '\n');
  const closure = { schemaVersion: 2, classification: 'ADDITIVE_SOURCE03_PLUS_RUNTIME_BOOTSTRAP02_REFERENCE_CLOSURE', base: runtime.baseBindings, additiveRuntimeBootstrap: pin(runtimePath), discoveryScripts: [pin(fileURLToPath(import.meta.url)), pin(join(output, 'verify-runtime-bootstrap.mjs'))], exactNativeLeaves: runtime.baseBindings.frozenLeaves, currentSourceAndSealedMetadataUnchanged: true, actualNativeResourceGrant: false, lateBound: ['Actual Docker image IDs/daemon identity under future grant', 'Separate whole-parent watchdog and cleanup activation', 'Actual module flat receipt and subsequent qualification admission'] };
  writeFileSync(join(output, 'SOURCE_CLOSURE02.json'), JSON.stringify(closure, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'CAPTURED_READONLY_RUNTIME_BOOTSTRAP', binaryFiles: runtime.binaries.length, contexts: runtime.contexts.length, loaderEdges: runtime.edges.length, systemLibraries: runtime.systemLibraries.length, originalSourceFiles: runtime.baseBindings.categories.files.count, nativeExecuted: false }));
}
