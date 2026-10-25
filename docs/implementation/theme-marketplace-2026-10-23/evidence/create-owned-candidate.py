"""Copy current integrated source for disposable local QA; never copies app credentials."""
import hashlib, json, os, shutil, subprocess, time
from pathlib import Path
root = Path.cwd().resolve()
target = Path('/private/tmp') / ('letbuyy-marketplace-candidate-' + time.strftime('%Y%m%d-%H%M%S'))
target.mkdir(mode=0o700)
raw = subprocess.check_output(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'])
paths = sorted(set(raw.decode().split('\0')) - {''})
excluded_roots = {'docs', 'reference', 'artifacts', 'backups', '.agents', '.codex', '.claude', '.github'}
files=[]; total=0; module_roots={root}
for name in paths:
    rel=Path(name)
    if rel.parts[0] in excluded_roots: continue
    if any(p in {'node_modules', 'dist', 'build', '.git', '.turbo', '.wrangler'} or p.startswith('.next') for p in rel.parts): continue
    if rel.name.startswith('.env') or rel.suffix in {'.pem', '.key', '.log', '.tsbuildinfo'}: continue
    source=root/rel
    if not source.is_file() and not source.is_symlink(): continue
    dest=target/rel; dest.parent.mkdir(parents=True,exist_ok=True)
    if source.is_symlink():
        # Preserve source symlinks only when they remain inside this source tree.
        resolved=source.resolve()
        if not resolved.is_relative_to(root): continue
        dest.symlink_to(os.path.relpath(target/resolved.relative_to(root),dest.parent))
        digest=hashlib.sha256(os.readlink(source).encode()).hexdigest()
    else:
        shutil.copy2(source,dest)
        digest=hashlib.sha256(source.read_bytes()).hexdigest(); total+=source.stat().st_size
    files.append({'path':name,'sha256':digest})
    if source.name=='package.json' and (source.parent/'node_modules').is_dir(): module_roots.add(source.parent)
for parent in module_roots:
    dest=target/parent.relative_to(root)/'node_modules'
    if not dest.exists(): dest.symlink_to(parent/'node_modules', target_is_directory=True)
report={'createdAt':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'root':str(target),'head':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'files':files,'bytes':total,'dependencyPolicy':'Existing node_modules linked read-only by usage; workspace package links resolve the live integrated source. No app env files, build artifacts or credentials copied. This is a QA candidate, not a frozen release artifact.'}
(target/'marketplace-candidate-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
Path('/private/tmp/letbuyy-marketplace-candidate-path.txt').write_text(str(target)+'\n')
print(json.dumps({'root':str(target),'files':len(files),'bytes':total,'dependencyLinks':len(module_roots)}))
