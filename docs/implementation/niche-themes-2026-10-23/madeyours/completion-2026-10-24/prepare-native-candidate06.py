"""Private source materialization only. Never installs/builds/starts a suite/DB.

Adapts the existing stable392 materialization discipline: exact pinned files,
new private tree, workspace links rebound into that tree; vendor links stay
unchanged. Unlike the old overlay, no workspace source directory is borrowed.
"""
from pathlib import Path
import os, json, hashlib, shutil, datetime

MAIN = Path('/Volumes/Projects/LetBuyy')
PRIOR = Path('/private/tmp/madeyours-checkout-reentry-proposal-20261024-05')
CANDIDATE = Path('/private/tmp/madeyours-checkout-reentry-proposal-20261024-06')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
load = lambda p: json.loads(p.read_text())
assert sha(PRIOR/'implementation-handoff.json') == '1794e60692e347a5d6e88d5d9f25adb1d20af4dca65dd51aad82d11d00129025'
assert sha(PRIOR/'source-input-closure.json') == '31a6c952c6e127d9a104102de952c444caab3dc8a99f6164c2579b948a128948'
assert sha(PRIOR/'literal-import-graph.json') == '2f9d429bbac302a4a3be8121625e99842f5f07af3dd6e4f0fc39df843d25e983'
assert not CANDIDATE.exists(), 'Never overwrite an existing candidate'
handoff = load(PRIOR/'implementation-handoff.json')
closure = load(PRIOR/'source-input-closure.json')
graph = load(PRIOR/'literal-import-graph.json')
overlays = {f['path']: f for f in handoff['files']}
assert len(overlays) == 11 and len(closure['files']) == 1071
inputs = {}
for f in closure['files']:
    rel = Path(f['path'])
    assert not rel.is_absolute() and '..' not in rel.parts
    assert not any(p in {'.git', 'node_modules', '.wrangler', '.next'} or p.startswith('.env') for p in rel.parts)
    physical = PRIOR/'implementation'/rel if str(rel) in overlays else MAIN/rel
    assert sha(physical) == f['sha256'], f'Sealed input changed: {rel}'
    inputs[str(rel)] = {'path': str(rel), 'sha256': f['sha256'], 'physical': str(physical), 'class': 'SEALED05_OVERLAY' if str(rel) in overlays else 'SEALED05_MAIN_BASE'}
for f in overlays.values():
    p = MAIN/f['path']
    assert (sha(p) if p.exists() else None) == f['baseSha256'], f'Main base moved: {f["path"]}'

# Pin metadata/configuration for every package boundary in the actual closure.
package_roots = {str(Path(p).parent) for p in inputs if p.endswith('package.json')}
metadata_added = []
def add_metadata(rel):
    rel = str(rel)
    if rel in inputs or not (MAIN/rel).is_file(): return
    assert not Path(rel).name.startswith('.env')
    inputs[rel] = {'path': rel, 'sha256': sha(MAIN/rel), 'physical': str(MAIN/rel), 'class': 'RUNTIME_PACKAGE_CONFIG_ADMISSION'}
    metadata_added.append(rel)
for folder in sorted(package_roots):
    for name in ['tsconfig.json', 'runtime.manifest.json']:
        add_metadata(Path(folder)/name)
add_metadata('tsconfig.json')
add_metadata('tsconfig.base.json')
# Relative extends chains are runtime loader/compiler inputs too.
queue = [p for p in inputs if Path(p).name.startswith('tsconfig') and p.endswith('.json')]
seen = set()
while queue:
    rel = queue.pop()
    if rel in seen: continue
    seen.add(rel)
    text = (MAIN/rel).read_text()
    import re
    match = re.search(r'"extends"\s*:\s*"([^"]+)"', text)
    if not match: continue
    spec = match.group(1)
    if spec.startswith('.'):
        p = (MAIN/Path(rel).parent/spec).resolve()
        if not p.suffix: p = p.with_suffix('.json')
        assert p.is_relative_to(MAIN) and p.is_file(), (rel,spec)
        extra = str(p.relative_to(MAIN)); add_metadata(extra); queue.append(extra)
    else:
        raise AssertionError(f'Unadmitted external tsconfig extends: {rel} -> {spec}')

CANDIDATE.mkdir(mode=0o700)
receipts = CANDIDATE/'packaging-receipts'; receipts.mkdir()
for f in inputs.values():
    dest = CANDIDATE/f['path']; dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(f['physical'], dest)
    assert not dest.is_symlink() and sha(dest) == f['sha256'], f['path']

# Actual native workspace package names, never mapped to Main. Unloaded workspace
# aliases are omitted rather than silently borrowing an unmaterialized source tree.
workspace = {}
for folder in sorted(package_roots):
    p = CANDIDATE/folder/'package.json'
    info = load(p)
    if info.get('name','').startswith('@letbuyy/') and folder.startswith('packages/'):
        workspace[info['name']] = folder
assert '@letbuyy/checkout-core' in workspace
links = []; vendor_packages = {}; omitted = []
vendor_store = (MAIN/'node_modules/.pnpm').resolve()

def add_module(alias, physical, dest):
    real = physical.resolve(strict=True)
    if alias.startswith('@letbuyy/'):
        if alias not in workspace:
            omitted.append({'alias': alias, 'consumer': str(dest.parent.relative_to(CANDIDATE)), 'reason': 'Unloaded workspace outside admitted native closure; no Main fallback.'})
            return
        target = CANDIDATE/workspace[alias]
        kind = 'CANDIDATE_WORKSPACE'
        assert (target/'package.json').is_file()
    else:
        assert real.is_relative_to(vendor_store), f'Non-vendor dependency would escape: {alias} -> {real}'
        target = real; kind = 'SHARED_UNCHANGED_THIRD_PARTY'
        package = real/'package.json'
        assert package.is_file(), f'Non-package dependency: {alias}'
        info = load(package)
        assert not info.get('name','').startswith('@letbuyy/')
        vendor_packages[str(real)] = {'realPath': str(real), 'name': info.get('name'), 'version': info.get('version'), 'packageJsonSha256': sha(package)}
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() or dest.is_symlink():
        assert dest.resolve(strict=True) == target.resolve(strict=True), f'Conflicting link {dest}'
        return
    dest.symlink_to(os.path.relpath(target, dest.parent))
    assert dest.resolve(strict=True) == target.resolve(strict=True)
    links.append({'path': str(dest.relative_to(CANDIDATE)), 'alias': alias, 'kind': kind, 'target': str(target), 'realPath': str(dest.resolve(strict=True))})

def materialize_consumer(folder, source_modules=None):
    origin = source_modules or MAIN/folder/'node_modules'
    dest = CANDIDATE/folder/'node_modules'
    dest.mkdir(parents=True,exist_ok=True)
    if not origin.is_dir(): return
    for entry in sorted(origin.iterdir()):
        if entry.name.startswith('.'): continue
        if entry.name.startswith('@'):
            for child in sorted(entry.iterdir()):
                if child.is_dir(): add_module(entry.name+'/'+child.name, child, dest/entry.name/child.name)
        elif entry.is_dir(): add_module(entry.name, entry, dest/entry.name)
    # Every admitted workspace is available locally; no parent Main fallback.
    for name, rel in workspace.items():
        add_module(name, MAIN/rel, dest/name)

for folder in sorted(package_roots):
    # Commerce source overlays remain static review inputs, never native imports.
    if not folder.startswith('apps/'): materialize_consumer(folder)
# tsconfig's existing third-party fallback path must also be private and rebound.
materialize_consumer('node_modules/.pnpm', MAIN/'node_modules/.pnpm/node_modules')

# The pnpm shell shim embeds Main NODE_PATH. Use the same installed third-party
# tsx CLI entry directly, through a candidate-local executable link, instead.
tsx_root = (MAIN/'node_modules/tsx').resolve(strict=True)
tsx_cli = tsx_root/'dist/cli.mjs'
assert tsx_cli.is_file() and tsx_cli.read_text().startswith('#!/usr/bin/env node')
bindir = CANDIDATE/'node_modules/.bin'; bindir.mkdir()
(bindir/'tsx').symlink_to(tsx_cli)
cli = {'path': 'node_modules/.bin/tsx', 'target': str(tsx_cli), 'sha256': sha(tsx_cli), 'kind': 'UNCHANGED_THIRD_PARTY_CLI_NO_MAIN_NODE_PATH_SHIM'}

for f in inputs.values():
    assert sha(Path(f['physical'])) == f['sha256'], f'Moving capture input: {f["path"]}'
    assert sha(CANDIDATE/f['path']) == f['sha256'], f['path']
for name, rel in workspace.items():
    assert (CANDIDATE/rel).is_dir() and not (CANDIDATE/rel).is_symlink()
assert all((CANDIDATE/f['path']).resolve().is_relative_to(CANDIDATE) for f in inputs.values())
ups = sorted((CANDIDATE/'database/supabase/migrations').glob('*.sql'))
assert len(ups) == 322 and max(int(p.name.split('_')[0]) for p in ups) == 393
manifest = {'classification': 'PRIVATE_RUNTIME_MATERIALIZATION06_PREFLIGHT_PENDING_NO_NATIVE_START',
  'recordedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'candidate': str(CANDIDATE),
  'sealed05': {'path': str(PRIOR/'implementation-handoff.json'), 'sha256': sha(PRIOR/'implementation-handoff.json'), 'sourceClosureSha256': sha(PRIOR/'source-input-closure.json'), 'files': 1071},
  'mechanismReference': {'path':'/private/tmp/letbuyy-prepare-stable392-editor.py', 'sha256':sha(Path('/private/tmp/letbuyy-prepare-stable392-editor.py')), 'adaptation':'Exact-file copies plus workspace-link rebinding, third-party sharing only; no broad source or node_modules directory symlink.'},
  'materializer': {'path': str(Path(__file__)), 'sha256': sha(Path(__file__))},
  'files': [{k:v for k,v in f.items() if k!='physical'} for f in sorted(inputs.values(),key=lambda f:f['path'])],
  'metadataAdded': metadata_added, 'workspacePackages': workspace, 'dependencyLinks': links,
  'sharedThirdPartyPackages': sorted(vendor_packages.values(),key=lambda x:x['realPath']), 'omittedUnloadedWorkspaceAliases': omitted,
  'tsxCli': cli, 'overlayFiles': handoff['files'], 'sourceMigrationMaximum':393,'sourceMigrationCount':322,
  'nativeSuites': handoff['nativeProposal']['suites'], 'runtimePreflight': 'NOT_RUN',
  'resources': {'mainSourceWrites':0,'sealed05Writes':0,'builds':0,'nativeRuns':0,'databaseStarts':0,'browser':0,'provider':0,'credentialsOrEnvCopied':False}}
(receipts/'materialization.json').write_text(json.dumps(manifest,indent=2)+'\n')
shutil.copy2(PRIOR/'literal-import-graph.json', receipts/'sealed05-literal-import-graph.json')
shutil.copy2(PRIOR/'source-input-closure.json', receipts/'sealed05-source-input-closure.json')
print(json.dumps({'candidate':str(CANDIDATE),'files':len(inputs),'metadataAdded':len(metadata_added),'workspacePackages':len(workspace),'dependencyLinks':len(links),'thirdPartyPackages':len(vendor_packages),'sourceMax':393,'nativeStarts':0,'preflight':'NEXT'}))
