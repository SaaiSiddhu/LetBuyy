// Static source/export/package discovery only. No discovered module is imported.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, realpathSync, lstatSync, readlinkSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import { createRequire, isBuiltin } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = '/private/tmp/letbuyy-circuit-performance-native-source-20261025-01';
const here = dirname(fileURLToPath(import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const suite = 'services/api-gateway/src/__tests__/owned-db/circuit-indexed-performance-qualification.manual.ts';
const probe = 'services/api-gateway/src/__tests__/owned-db/circuit-auto-explain-preflight.manual.ts';
const parser = 'services/api-gateway/src/__tests__/owned-db/plan-parser.ts';
const dataBase = 'docs/implementation/niche-theme-programme/completion-2026-10-24/circuit-performance01/';
const isInside = path => path === root || path.startsWith(root + '/');
const config = ts.readConfigFile(resolve(root, 'services/api-gateway/tsconfig.json'), ts.sys.readFile); assert(!config.error);
const options = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve(root, 'services/api-gateway')).options;
const resolverEnvironment={TSX_TSCONFIG_PATH:process.env.TSX_TSCONFIG_PATH||null};
assert.equal(resolverEnvironment.TSX_TSCONFIG_PATH,resolve(root,'services/api-gateway/tsconfig.json'),'Use the exact proposed native tsx configuration for source/export discovery');
const contextualResolve = specifier => import.meta.resolve(specifier, pathToFileURL(resolve(root, suite)).href);
assert.equal(fileURLToPath(contextualResolve('./plan-parser.ts')), resolve(root, parser), 'Run with --experimental-import-meta-resolve; parent binding is mandatory');

export function discover() {
  const files = new Map(), queue = [], visited = new Set(), edges = [], builtins = new Set();
  const vendorPackages = new Map(), vendorQueue = [], vendorAbsences = [], externalResolutions = [];
  function pin(path, traverse = true) {
    assert(!path.startsWith('/') && !path.split('/').includes('..'));
    const absolute = resolve(root, path); assert(isInside(realpathSync(absolute)), 'App/workspace source escapes clone: ' + path);
    const bytes = readFileSync(absolute), entry = { path, sha256: sha(bytes), bytes: bytes.length };
    if (files.has(path)) assert.deepEqual(files.get(path), entry, 'Source drift while capturing'); else files.set(path, entry);
    if (traverse && /\.[cm]?[jt]sx?$/.test(path) && !/\.d\.[cm]?ts$/.test(path) && !visited.has(path) && !queue.includes(path)) queue.push(path);
  }
  function owner(path) {
    let dir = lstatSync(path).isDirectory() ? path : dirname(path);
    while (dir !== dirname(dir)) {
      if (existsSync(join(dir,'package.json'))) { const manifest=JSON.parse(readFileSync(join(dir,'package.json'),'utf8'));if(typeof manifest.name==='string'&&typeof manifest.version==='string')return dir; }
      dir=dirname(dir);
    }
    throw Error('Runtime input has no package owner: ' + path);
  }
  function vendor(path, origin) {
    const absolute = realpathSync(path);
    assert(absolute.includes('/node_modules/'), 'Uncaptured workspace source is not a vendor dependency: ' + absolute);
    const packageRoot = owner(absolute), manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
    if (!vendorPackages.has(packageRoot)) { vendorPackages.set(packageRoot, { root: packageRoot, name: manifest.name, version: manifest.version, origin }); vendorQueue.push(packageRoot); }
    return absolute;
  }
  function resolution(from, specifier, resolved, kind, typeOnly) {
    if (isBuiltin(resolved) || resolved.startsWith('node:')) { builtins.add(resolved); return; }
    const absolute = realpathSync(resolved);
    if (isInside(absolute) && !absolute.includes('/node_modules/')) {
      const path = relative(root, absolute); assert(!path.startsWith('apps/'), 'App imports are forbidden in native runtime closure');
      if (!typeOnly) assert(!/\.d\.[cm]?ts$/.test(path), 'Runtime cannot resolve to declarations');
      pin(path, true); edges.push({ from, specifier, to: path, kind, typeOnly });
    } else {
      assert(absolute.includes('/node_modules/'), 'Workspace escape: '+JSON.stringify({from,specifier,kind,resolved:absolute}));
      const path = vendor(absolute, { from, specifier, kind });
      externalResolutions.push({ from, specifier, resolved: path, kind, typeOnly });
    }
  }
  // Full captured baseline is independently rechecked, beyond imported code.
  const materialization = JSON.parse(readFileSync(resolve(here, 'MATERIALIZATION.json'), 'utf8'));
  for (const input of materialization.files) { pin(input.path, false); assert.equal(files.get(input.path).sha256, input.sha256); }
  const expansion = JSON.parse(readFileSync(resolve(here, 'SOURCE_INPUT_EXPANSION01.json'), 'utf8'));
  for (const input of expansion.addedFiles) { pin(input.path, false); assert.equal(files.get(input.path).sha256, input.sha256); }
  const entries = [suite, probe, parser, 'scripts/governance/run-executable-suites.mjs', 'scripts/governance/test-suite-catalog.mjs'];
  for (const path of entries) pin(path);
  for (const path of [dataBase+'PERFORMANCE_PROTOCOL.json', dataBase+'PREPARATION_HANDOFF.json', dataBase+'PREPARATION_SOURCE_MANIFEST.json', 'package.json', 'pnpm-lock.yaml', 'tsconfig.base.json', 'services/api-gateway/tsconfig.json', 'services/api-gateway/package.json', 'services/api-gateway/runtime.manifest.json']) pin(path, false);
  const sharedPath = 'docs/implementation/niche-theme-programme/completion-2026-10-24/SHARED_RUNTIME_ADMISSION.json'; pin(sharedPath, false);
  const shared = JSON.parse(readFileSync(resolve(root, sharedPath), 'utf8'));
  for (const proposal of shared.upProposals) { pin(proposal.path, false); assert.equal(files.get(proposal.path).sha256, proposal.sha256); }
  pin('docs/implementation/niche-themes-2026-10-23/circuit/completion-2026-10-24/facet-private-implementation-03/UNNUMBERED_circuit_facets.down.proposal.sql', false);
  const sqlSets = {};
  for (const dir of ['database/supabase/migrations', 'database/supabase/rollback', 'database/supabase/bootstrap', 'database/supabase/deploy']) {
    const paths = existsSync(resolve(root, dir)) ? readdirSync(resolve(root, dir), { recursive: true }).filter(path => /\.(sql|json)$/.test(path)).map(path => dir + '/' + path).sort() : [];
    sqlSets[dir] = paths; for (const path of paths) pin(path, false);
  }
  while (queue.length) {
    const path = queue.shift(); if (visited.has(path)) continue; visited.add(path);
    const text = readFileSync(resolve(root, path), 'utf8'), source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true); assert.equal(source.parseDiagnostics.length, 0, path);
    for (const reference of source.referencedFiles) pin(relative(root, resolve(root, dirname(path), reference.fileName)), false);
    function visit(node) {
      let specifier, typeOnly = false;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        specifier = node.moduleSpecifier.text; typeOnly = Boolean(node.isTypeOnly || node.importClause?.isTypeOnly);
        const named = node.importClause?.namedBindings || node.exportClause;
        if (named?.elements?.length && !node.importClause?.name && named.elements.every(item => item.isTypeOnly)) typeOnly = true;
      } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
        assert(node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]), 'Nonliteral workspace import requires explicit review: ' + path); specifier = node.arguments[0].text;
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) { specifier = node.argument.literal.text; typeOnly = true; }
      if (specifier) {
        if (isBuiltin(specifier)) builtins.add(specifier);
        else {
          const typed = ts.resolveModuleName(specifier, resolve(root, path), options, ts.sys).resolvedModule?.resolvedFileName;
          if (typed) resolution(path, specifier, typed, 'TypeScript', true);
          else assert(!specifier.startsWith('.') && !specifier.startsWith('@letbuyy/'), 'Unresolved internal TypeScript import: ' + path + ' -> ' + specifier);
          if (!typeOnly) {
            resolution(path, specifier, createRequire(resolve(root, path)).resolve(specifier), 'Node-tsx-require-condition', false);
            const esm = import.meta.resolve(specifier, pathToFileURL(resolve(root, path)).href);
            if (esm.startsWith('node:')) builtins.add(esm); else { assert(esm.startsWith('file:'), 'Non-file runtime URL'); resolution(path, specifier, fileURLToPath(esm), 'Node-tsx-import-condition', false); }
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    let dir = dirname(path);
    while (dir !== '.') { if (existsSync(resolve(root, dir, 'package.json'))) { pin(join(dir, 'package.json'), false); break; } dir = dirname(dir); }
  }
  // Pin complete installed package trees, including runtime/bootstrap binaries;
  // inspect dependency metadata without evaluating any package's module code.
  for (const specifier of ['tsx', 'typescript']) {
    const entry = createRequire(resolve(root, 'package.json')).resolve(specifier); vendor(entry, { tooling: specifier });
  }
  const typeContext=createRequire(resolve(root,'node_modules/.pnpm/node_modules/_source-type-context.cjs'));
  for(const name of [...new Set([...(options.types||[]),'node'])]){
    const packageName=name==='node'?'@types/node':name;
    const manifestPath=typeContext.resolve(packageName+'/package.json');
    vendor(manifestPath,{typeDirective:name,source:'canonical tsconfig plus native Node test types'});
    externalResolutions.push({from:'services/api-gateway/tsconfig.json',specifier:name,resolved:realpathSync(manifestPath),kind:'TypeScript-type-library-package',typeOnly:true});
  }
  const vendorFiles = new Map();
  function packageTree(dir) {
    for (const name of readdirSync(dir).sort()) {
      if (name === 'node_modules' || name === '.git') continue;
      assert(!/^\.env(?:\.|$)/.test(name) && name !== '.npmrc', 'Environment/registry secret file is outside source capture: ' + dir + '/' + name);
      const path = join(dir, name), stat = lstatSync(path);
      if (stat.isDirectory()) packageTree(path);
      else if (stat.isSymbolicLink()) { const actual = realpathSync(path); assert(actual.includes('/node_modules/')); if (lstatSync(actual).isFile()) { const bytes = readFileSync(actual); vendorFiles.set(actual, { path: actual, sha256: sha(bytes), bytes: bytes.length }); } else throw Error('Unexpected package directory link: ' + path); }
      else if (stat.isFile()) { const bytes = readFileSync(path); vendorFiles.set(path, { path, sha256: sha(bytes), bytes: bytes.length }); }
    }
  }
  for (let index = 0; index < vendorQueue.length; index++) {
    const packageRoot = vendorQueue[index], manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
    packageTree(packageRoot);
    const dependencies = { ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies };
    for (const name of Object.keys(dependencies).sort()) {
      const request = createRequire(join(packageRoot, 'package.json'));
      try {
        let entry;
        try { entry = request.resolve(name); }
        catch (error) {
          // Type-only and subpath-only packages need no executable root export.
          // Resolve their real installed package metadata without executing it.
          entry = request.resolve.paths(name)?.map(dir=>join(dir,name,'package.json')).find(path=>existsSync(path));
          if (!entry) throw error;
        }
        if (!isBuiltin(entry)) vendor(entry, { parentPackage: manifest.name, specifier: name });
      }
      catch (error) { if (manifest.optionalDependencies?.[name] || manifest.peerDependenciesMeta?.[name]?.optional) vendorAbsences.push({ package: manifest.name, specifier: name, optional: true, platform: process.platform, arch: process.arch }); else throw error; }
    }
  }
  const runtimeFiles = [process.execPath, resolve(root, 'node_modules/.bin/tsx')].map(path => { const actual = realpathSync(path), bytes = readFileSync(actual); return { path, realpath: actual, sha256: sha(bytes), bytes: bytes.length }; });
  const layoutLinks=[],layoutFiles=[];
  function layout(dir){for(const name of readdirSync(dir).sort()){const path=join(dir,name),stat=lstatSync(path);if(stat.isSymbolicLink()){assert(existsSync(path),'Dangling runtime layout link');layoutLinks.push({path:relative(root,path),target:readlinkSync(path),realpath:realpathSync(path)});}else if(stat.isDirectory())layout(path);else if(stat.isFile()){const bytes=readFileSync(path);layoutFiles.push({path:relative(root,path),sha256:sha(bytes),bytes:bytes.length});}}}
  const moduleRoots=new Set(['node_modules',...materialization.files.filter(file=>file.path.endsWith('/package.json')).map(file=>join(dirname(file.path),'node_modules'))]);
  for(const path of [...moduleRoots].sort())if(existsSync(resolve(root,path)))layout(resolve(root,path));
  for (const input of files.values()) assert.equal(sha(readFileSync(resolve(root, input.path))), input.sha256, 'Workspace source drift');
  for (const input of vendorFiles.values()) assert.equal(sha(readFileSync(input.path)), input.sha256, 'Installed dependency drift');
  const migrations = sqlSets['database/supabase/migrations'].filter(path => path.endsWith('.sql'));
  return { classification: 'CONTAINED_CODE_DATA_EXPORT_CLOSURE_SOURCE_ONLY_NOT_NATIVE_ADMISSION', root, suitePath: suite, probePath: probe, entryPoints: entries, resolverEnvironment, files: [...files.values()].sort((a,b)=>a.path.localeCompare(b.path)), runtimeModules: [...visited].sort(), edges, externalResolutions, installedVendorPackages: [...vendorPackages.values()].sort((a,b)=>a.root.localeCompare(b.root)), installedVendorFiles: [...vendorFiles.values()].sort((a,b)=>a.path.localeCompare(b.path)), optionalInstalledAbsences: vendorAbsences, nodeBuiltins: [...builtins].sort(), runtimeBootstrapFiles: runtimeFiles, node: { version: process.version, platform: process.platform, arch: process.arch }, dependencyLayoutLinks: layoutLinks.sort((a,b)=>a.path.localeCompare(b.path)), dependencyLayoutFiles: layoutFiles.sort((a,b)=>a.path.localeCompare(b.path)), sqlSets, migrationCount: migrations.length, migrationMaximum: Math.max(...migrations.map(path=>Number(path.split('/').at(-1).match(/^\d+/)[0]))), migrationCeiling: null, lateBoundControlInputs: [{ path: dataBase+'MODULE_PREFLIGHT_ADMISSION.json', reason: 'No actual resource admission granted; caller must supply independently accepted exact bytes later' }, { path: dataBase+'NATIVE_ADMISSION.json', reason: 'Must bind actual terminal module receipt and final contained source closure after preflight' }, { path: 'ACTUAL_OWNED_MODULE_FLAT_RECEIPT_TO_BIND', reason: 'Must be generated by later exclusive owned probe; no fabricated receipt' }], discoveredWorkerRunnerNativeModulesExecuted: false, databaseDockerModuleLogBuildBrowserProviderActions: 0 };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const closure = discover();
  writeFileSync(resolve(here, 'SOURCE_CLOSURE.json'), JSON.stringify(closure, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ files: closure.files.length, runtimeModules: closure.runtimeModules.length, edges: closure.edges.length, vendorPackages: closure.installedVendorPackages.length, vendorFiles: closure.installedVendorFiles.length, migrations: closure.migrationCount, migrationMaximum: closure.migrationMaximum, discoveredModulesExecuted: false, lateBoundControls: closure.lateBoundControlInputs.length }) + '\n');
}
