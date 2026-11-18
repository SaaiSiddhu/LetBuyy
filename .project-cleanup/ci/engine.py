#!/usr/bin/env python3
"""Project-owned artifact retention. Unknown files are never deletion candidates."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import time
import uuid

LAYOUT = ('registry/items', 'registry/locks', 'registry/migrations', 'work', 'runs',
          'retained/builds', 'retained/evidence', 'retained/recovery',
          'retained/legacy', 'scratch', 'reports')
DEFAULT_POLICY = {'keep_builds_per_group': 2, 'successful_run_days': 14,
                  'scratch_days': 7, 'minimum_free_bytes': 2147483648,
                  'work_warning_bytes': 12884901888, 'retained_warning_bytes': 12884901888}
PREFIX = {'build': 'retained/builds', 'run': 'runs', 'cache': 'work', 'scratch': 'scratch'}
LEVELS = ('build', 'unit', 'integration', 'simulator', 'physical', 'release')
SENSITIVE_PARTS = {'private', 'recovery', 'originals', 'source', 'staged-source',
                   '.git', 'credentials', 'backup', 'backups'}
SENSITIVE_SUFFIXES = {'.db', '.sqlite', '.sqlite3', '.p2pb', '.p2pe', '.astrobackup',
                      '.agvault', '.keystore', '.jks', '.p12', '.pfx', '.pem', '.key',
                      '.mobileprovision', '.dump', '.sql', '.bundle'}


def now():
    return datetime.now(timezone.utc).isoformat()


def atomic_json(path, value):
    path = Path(path)
    temp = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        with temp.open('x') as f:
            os.chmod(temp, 0o600)
            json.dump(value, f, indent=2)
            f.write('\n')
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp, path)
    finally:
        if temp.exists():
            temp.unlink()


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for data in iter(lambda: f.read(1024 * 1024), b''):
            h.update(data)
    return h.hexdigest()


def snapshot(path, contents=True):
    """lstat traversal: never follows links; special files fail closed."""
    result = {}

    def visit(p, rel):
        s = p.lstat()
        row = {'mode': stat.S_IMODE(s.st_mode)}
        if stat.S_ISLNK(s.st_mode):
            row.update(link=os.readlink(p))
        elif stat.S_ISDIR(s.st_mode):
            row.update(directory=True)
        elif stat.S_ISREG(s.st_mode):
            row.update(size=s.st_size, mtime_ns=s.st_mtime_ns, inode=s.st_ino,
                       device=s.st_dev, links=s.st_nlink, allocated=s.st_blocks * 512)
            if contents:
                row['sha256'] = digest(p)
        else:
            raise ValueError('Unsupported special file in managed material')
        result[rel] = row
        if stat.S_ISDIR(s.st_mode):
            for child in sorted(p.iterdir()):
                visit(child, child.name if rel == '.' else rel + '/' + child.name)
    visit(Path(path), '.')
    return result


def identity(tree):
    return {k: {n: v for n, v in row.items() if n in ('sha256', 'link', 'directory', 'mode')}
            for k, row in tree.items()}


def allocated(tree):
    return sum(v.get('allocated', 0) for v in tree.values())


def protected(tree):
    for name, row in tree.items():
        p = Path(name.lower())
        if ('link' in row or row.get('links', 1) > 1 or
                SENSITIVE_PARTS.intersection(p.parts) or p.suffix in SENSITIVE_SUFFIXES or
                p.name.startswith('.env') or
                p.name.endswith(('-wal', '-shm', '.tar.gz', '.zip', '.tgz', '.7z'))):
            return True
    return False


def process_guard(paths):
    """Conservative POSIX consumer check; unavailable/partial visibility means skip."""
    ps = shutil.which('ps')
    lsof = shutil.which('lsof') or ('/usr/sbin/lsof' if Path('/usr/sbin/lsof').exists() else None)
    if not ps or not lsof:
        raise RuntimeError('Process/open-file inspection unavailable; mutation skipped')
    processes = subprocess.run([ps, '-axo', 'pid=,command='], capture_output=True, text=True)
    if processes.returncode or processes.stderr.strip() or not processes.stdout.strip():
        raise RuntimeError('Cannot inspect processes; mutation skipped')
    wanted = [str(Path(p).resolve()) for p in paths]
    for line in processes.stdout.splitlines():
        fields = line.strip().split(None, 1)
        if not fields or fields[0] == str(os.getpid()):
            continue
        if any(p in line for p in wanted):
            raise RuntimeError('Candidate referenced by a live process; mutation skipped')
    opened = subprocess.run([lsof, '-n', '-P', '-Fn'], capture_output=True, text=True)
    if opened.returncode not in (0, 1) or opened.stderr.strip() or not opened.stdout.strip():
        raise RuntimeError('Incomplete open-file visibility; mutation skipped')
    for line in opened.stdout.splitlines():
        if line.startswith('n') and any(line[1:] == p or line[1:].startswith(p + '/') for p in wanted):
            raise RuntimeError('Candidate has an open consumer; mutation skipped')


class Workspace:
    def __init__(self, project, root=None):
        self.project = Path(project).resolve(strict=True)
        if not self.project.is_dir() or self.project == Path('/'):
            raise ValueError('Project must be an existing source directory')
        self.root = Path(root or self.project.parent / (self.project.name + ' Workspace')).absolute()
        self.check_root()
        self.marker = self.root / 'registry/project-cleanup.json'

    def check_root(self):
        if self.root != self.root.resolve() or self.root.is_symlink():
            raise ValueError('Workspace requires a physical path without symbolic parents')
        if (self.root == self.project or self.project in self.root.parents or
                self.root in self.project.parents):
            raise ValueError('Workspace must be separate from source and its ancestors')

    def path(self, relative):
        self.check_root()
        p = Path(relative)
        if p.is_absolute() or not p.parts or '..' in p.parts or str(p) == '.' or str(p) != str(relative):
            raise ValueError('Expected a relative managed path')
        full = self.root / p
        for ancestor in [full, *full.parents]:
            if ancestor == self.root:
                break
            if ancestor.is_symlink():
                raise ValueError('Symbolic path is not a managed boundary')
        if self.root not in full.resolve().parents:
            raise ValueError('Path escapes workspace')
        return full

    def init(self):
        self.check_root()
        if self.marker.exists():
            self.validate()
            return self
        # Existing managers retain authority, even when they use another marker format.
        if self.root.exists() and any(self.root.iterdir()):
            raise ValueError('Refusing to adopt a nonempty or already managed workspace')
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(self.root, 0o700)
        for name in LAYOUT:
            self.path(name).mkdir(parents=True, exist_ok=True)
        atomic_json(self.marker, {'schema': 1, 'manager': 'project-cleanup',
                                 'project': str(self.project), 'created': now(),
                                 'policy': dict(DEFAULT_POLICY)})
        return self

    def validate(self):
        self.check_root()
        marker = self.path('registry/project-cleanup.json')
        d = json.loads(marker.read_text())
        if d.get('schema') != 1 or d.get('manager') != 'project-cleanup' or d.get('project') != str(self.project):
            raise ValueError('Workspace owner or format mismatch')
        for name in LAYOUT:
            if not self.path(name).is_dir():
                raise ValueError('Missing managed directory')
        policy = d.get('policy', {})
        if set(policy) != set(DEFAULT_POLICY) or any(type(v) is not int or v < 1 for v in policy.values()):
            raise ValueError('Invalid retention policy')
        if policy['keep_builds_per_group'] < 2:
            raise ValueError('Keep at least two verified candidates per group and level')
        return policy

    @contextmanager
    def lock(self):
        self.validate()
        with self.path('registry/locks/workspace.lock').open('a') as f:
            try:
                fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise RuntimeError('Workspace is busy; skipped')
            try:
                yield
            finally:
                fcntl.flock(f, fcntl.LOCK_UN)

    def items(self):
        result = []
        for file in sorted(self.path('registry/items').iterdir()):
            if file.suffix != '.json':
                raise ValueError('Unknown registry material; inspect before cleanup')
            x = json.loads(self.path(str(file.relative_to(self.root))).read_text())
            if not re.fullmatch('[a-f0-9]{32}', x.get('id', '')) or file.stem != x['id']:
                raise ValueError('Invalid registry identity')
            prefix = PREFIX.get(x.get('role'))
            if not prefix or not x.get('path', '').startswith(prefix + '/'):
                raise ValueError('Invalid ownership boundary')
            self.path(x['path'])
            if x.get('state') not in ('active', 'complete', 'failed', 'deleting', 'deleted'):
                raise ValueError('Invalid item state')
            if not isinstance(x.get('pins'), list) or not all(isinstance(p, str) and p.strip() for p in x['pins']):
                raise ValueError('Invalid protection reasons')
            if x['role'] == 'build' and (x.get('verification') not in LEVELS or not x.get('group')):
                raise ValueError('Invalid build provenance')
            result.append(x)
        paths = [x['path'] for x in result if x['state'] != 'deleted']
        if len(paths) != len(set(paths)) or any(a.startswith(b + '/') for a in paths for b in paths if a != b):
            raise ValueError('Overlapping registered ownership')
        return result

    def save(self, x):
        if not re.fullmatch('[a-f0-9]{32}', x['id']):
            raise ValueError('Invalid registry ID')
        atomic_json(self.path('registry/items/' + x['id'] + '.json'), x)

    def add(self, relative, role, **fields):
        prefix = PREFIX.get(role)
        p = self.path(relative)
        if not prefix or not str(relative).startswith(prefix + '/') or not p.exists():
            raise ValueError('Role does not own this path')
        if any(x['state'] != 'deleted' and (x['path'] == relative or x['path'].startswith(relative + '/') or
                   relative.startswith(x['path'] + '/')) for x in self.items()):
            raise ValueError('Path is already owned')
        if {'id', 'path', 'role', 'created'}.intersection(fields):
            raise ValueError('Cannot override registry ownership')
        x = {'id': uuid.uuid4().hex, 'path': str(relative), 'role': role,
             'created': time.time(), 'state': 'active', 'pins': [], **fields}
        self.save(x)
        return x

    @contextmanager
    def session(self, label):
        with self.lock():
            slug = re.sub('[^A-Za-z0-9_-]', '-', label)[:50]
            rel = 'runs/' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + slug + '-' + uuid.uuid4().hex
            p = self.path(rel)
            p.mkdir()
            x = self.add(rel, 'run', label=label)
            try:
                yield p, x
            except BaseException:
                x.update(state='failed', finished=time.time(), pins=list(dict.fromkeys(x['pins'] + ['unresolved failure'])))
                self.save(x)
                raise
            else:
                x.update(state='complete', finished=time.time(), identity=identity(snapshot(p)))
                self.save(x)

    def retain(self, source, group, verification, evidence, pins=()):
        if verification not in LEVELS or not re.fullmatch('[A-Za-z0-9_-]+', group):
            raise ValueError('Specify an artifact group and actual verification level')
        if (not isinstance(evidence, dict) or not isinstance(evidence.get('source'), dict) or
                not evidence['source'] or not isinstance(evidence.get('checks'), list) or not evidence['checks'] or
                not all(isinstance(c, dict) and c.get('command') and type(c.get('exit_code')) is int and c['exit_code'] == 0 for c in evidence['checks'])):
            raise ValueError('Evidence requires a source fingerprint and successful named checks')
        if evidence.get('run') and not any(x['role'] == 'run' and x['path'] == evidence['run'] and
                                          x['state'] in ('active', 'complete') for x in self.items()):
            raise ValueError('Evidence run must be a live registered run in this workspace')
        src = Path(source).absolute()
        if src.is_symlink() or not src.exists():
            raise ValueError('Artifact must be a physical file or bundle')
        if src.resolve() == self.root or src.resolve() in self.root.parents:
            raise ValueError('Cannot retain a workspace ancestor into itself')
        if src.name in ('verification-receipt.json', 'INCOMPLETE.json'):
            raise ValueError('Artifact name collides with retention metadata')
        before = snapshot(src)
        for name, row in before.items():
            if 'link' in row and src.resolve() not in (src / name).resolve().parents:
                raise ValueError('Artifact has an escaping symbolic link')
        rel = 'retained/builds/' + group + '-' + uuid.uuid4().hex
        parent = self.path(rel)
        parent.mkdir()
        dst = parent / src.name
        try:
            if src.is_dir():
                shutil.copytree(src, dst, symlinks=True, copy_function=shutil.copy2)
            else:
                shutil.copy2(src, dst)
            if identity(before) != identity(snapshot(dst)) or before != snapshot(src):
                raise RuntimeError('Artifact changed or retained copy differs')
            atomic_json(parent / 'verification-receipt.json', evidence)
            return self.add(rel, 'build', group=group, verification=verification,
                            evidence=evidence, pins=list(pins), state='complete', finished=time.time(),
                            identity=identity(snapshot(parent)))
        except BaseException:
            atomic_json(parent / 'INCOMPLETE.json', {'time': now(), 'reason': 'retention failed; preserve for review'})
            raise

    def candidates(self):
        policy = self.validate()
        items = self.items()
        groups = {}
        for x in items:
            if x['role'] == 'build' and x['state'] == 'complete':
                if identity(snapshot(self.path(x['path']))) != x.get('identity'):
                    raise RuntimeError('Retained build or receipt integrity failure: ' + x['id'])
                groups.setdefault((x['group'], x['verification']), []).append(x)
        keep = {x['id'] for rows in groups.values() for x in
                sorted(rows, key=lambda x: x['finished'], reverse=True)[:policy['keep_builds_per_group']]}
        verification_runs = {}
        for x in items:
            if x['role'] == 'run' and x['state'] == 'complete' and x.get('verification_group'):
                verification_runs.setdefault(x['verification_group'], []).append(x)
        kept_runs = {x['id'] for rows in verification_runs.values() for x in
                     sorted(rows, key=lambda x: x['finished'], reverse=True)[:2]}
        referred = {x.get('evidence', {}).get('run') for x in items if x['role'] == 'build' and x['state'] != 'deleted'}
        candidates, skipped = [], []
        for x in items:
            if x['pins'] or x['state'] != 'complete':
                continue
            if x['id'] in kept_runs:
                continue
            age = time.time() - x.get('finished', x['created'])
            expired = (x['id'] not in keep and x['verification'] != 'release') if x['role'] == 'build' else (
                age > policy['successful_run_days'] * 86400 and x['path'] not in referred if x['role'] == 'run'
                else age > policy['scratch_days'] * 86400)
            if not expired:
                continue
            p = self.path(x['path'])
            tree = snapshot(p)
            reason = None
            if identity(tree) != x.get('identity'):
                reason = 'changed since finalization; reclassify before cleanup'
            elif any('link' in row or row.get('links', 1) > 1 for row in tree.values()):
                reason = 'contains symbolic links or shared hard links'
            elif x['role'] != 'build' and (protected(tree) or SENSITIVE_PARTS.intersection(Path(x['path'].lower()).parts)):
                reason = 'potential recovery, archive, credentials or source material'
            if reason:
                skipped.append({'id': x['id'], 'reason': reason})
            else:
                candidates.append({'id': x['id'], 'path': x['path'], 'tree': tree, 'allocated_bytes': allocated(tree)})
        return candidates, skipped

    def plan(self):
        with self.lock():
            candidates, skipped = self.candidates()
            d = {'schema': 1, 'project': str(self.project), 'workspace': str(self.root), 'time': now(),
                 'policy': self.validate(), 'registry': self.items(), 'candidates': candidates, 'skipped': skipped}
            path = self.path('reports/plan-' + uuid.uuid4().hex + '.json')
            atomic_json(path, d)
            return {'plan': str(path), 'candidates': [{k: v for k, v in x.items() if k != 'tree'} for x in candidates],
                    'skipped': skipped, 'eligible_allocated_bytes': sum(x['allocated_bytes'] for x in candidates)}

    def clean(self, plan_path, guard=process_guard):
        with self.lock():
            plan_path = Path(plan_path).absolute()
            if plan_path.parent != self.root / 'reports':
                raise ValueError('Plan must be owned by this workspace')
            d = json.loads(self.path(str(plan_path.relative_to(self.root))).read_text())
            if (d.get('schema') != 1 or d.get('project') != str(self.project) or d.get('workspace') != str(self.root) or
                    d.get('policy') != self.validate() or d.get('registry') != self.items()):
                raise ValueError('Stale or foreign cleanup plan; regenerate it')
            candidates, skipped = self.candidates()
            if d['candidates'] != candidates or d['skipped'] != skipped:
                raise ValueError('Files or eligibility changed since plan; regenerate it')
            # Inspect every candidate before starting any deletion.
            if candidates:
                guard([self.path(x['path']) for x in candidates])
            if any(snapshot(self.path(x['path'])) != x['tree'] for x in candidates):
                raise RuntimeError('Candidate changed during consumer checks')
            report = {'time': now(), 'plan': str(plan_path), 'removed': [], 'skipped': skipped,
                      'removed_allocated_bytes': 0}
            receipt = self.path('reports/cleanup-' + uuid.uuid4().hex + '.json')
            atomic_json(receipt, report)
            for c in candidates:
                p = self.path(c['path'])
                if snapshot(p) != c['tree']:
                    raise RuntimeError('Candidate changed during cleanup; inspect receipt')
                x = next(x for x in self.items() if x['id'] == c['id'])
                x.update(state='deleting', deletion_started=now())
                self.save(x)
                if p.is_dir():
                    shutil.rmtree(p)
                else:
                    p.unlink()
                x.update(state='deleted', deleted=now())
                self.save(x)
                report['removed'].append({'id': x['id'], 'path': x['path']})
                report['removed_allocated_bytes'] += c['allocated_bytes']
                atomic_json(receipt, report)
            self.candidates()  # Reverify retained builds after deletion.
            report.update(completed=now(), receipt=str(receipt))
            atomic_json(receipt, report)
            return report

    def register(self, relative, role, reason):
        if role not in ('scratch', 'cache') or not reason.strip():
            raise ValueError('Register only explicitly disposable scratch/cache with a reason')
        with self.lock():
            tree = snapshot(self.path(relative))
            if protected(tree) or SENSITIVE_PARTS.intersection(Path(relative.lower()).parts):
                raise ValueError('Potential protected material cannot be registered as disposable')
            return self.add(relative, role, reason=reason, state='complete', finished=time.time(), identity=identity(tree))

    def update(self, item_id, reason, resolve=False):
        if not reason.strip():
            raise ValueError('A concrete reason is required')
        with self.lock():
            x = next((x for x in self.items() if x['id'] == item_id), None)
            if not x or x['state'] in ('deleted', 'deleting'):
                raise ValueError('Unknown or retired item')
            if resolve:
                if x['state'] != 'failed':
                    raise ValueError('Only reviewed failed runs can be resolved')
                x.update(state='complete', finished=time.time(), resolution={'time': now(), 'reason': reason},
                         pins=[p for p in x['pins'] if p != 'unresolved failure'],
                         identity=identity(snapshot(self.path(x['path']))))
            else:
                x['pins'] = list(dict.fromkeys(x['pins'] + [reason]))
            self.save(x)
            return {'updated': x['id']}

    def inventory(self):
        self.validate()
        areas = {name: {'allocated_bytes': allocated(snapshot(self.path(name), contents=False))}
                 for name in ('work', 'runs', 'retained', 'scratch', 'reports')}
        policy = self.validate()
        warnings = [name + ' exceeds soft budget; protected files stay' for name in ('work', 'retained')
                    if areas[name]['allocated_bytes'] > policy[name + '_warning_bytes']]
        free = shutil.disk_usage(self.root).free
        if free < policy['minimum_free_bytes']:
            warnings.append('Low free space; no forced deletion of protected material')
        return {'project': str(self.project), 'workspace': str(self.root), 'areas': areas,
                'free_bytes': free, 'warnings': warnings, 'policy': policy,
                'items': [{k: v for k, v in x.items() if k not in ('identity', 'evidence')} for x in self.items()]}

    def adopt(self, relative, label, apply=False, guard=process_guard):
        """Same-volume protected relocation. Resume by repeating the identical invocation."""
        rel = Path(relative)
        if rel.is_absolute() or '..' in rel.parts or not rel.parts or str(rel) == '.':
            raise ValueError('Adopt a relative generated directory inside this project')
        if not re.fullmatch('[A-Za-z0-9_-]+', label):
            raise ValueError('Use a simple unique migration label')
        src = self.project / rel
        # Never infer that ignored/untracked material is disposable. This only relocates it.
        if SENSITIVE_PARTS.intersection(p.lower() for p in rel.parts):
            raise ValueError('Recovery/source directories require their own recovery workflow')
        if any(p.is_symlink() for p in src.parents if p != self.project and self.project in p.parents):
            raise ValueError('Generated directory has a symbolic parent')
        dst = self.path('retained/legacy/' + label)
        journal = self.path('registry/migrations/' + label + '.json')
        with self.lock():
            if journal.exists():
                d = json.loads(journal.read_text())
                if d.get('source') != str(src) or d.get('destination') != str(dst):
                    raise ValueError('Migration label belongs to another path')
                if src.is_symlink() and src.resolve() == dst and d['state'] in ('moved', 'linked'):
                    if snapshot(dst) != d['tree']:
                        raise RuntimeError('Protected archive changed after migration; inspect manually')
                    if apply and d['state'] == 'moved':
                        d.update(state='linked', completed=now())
                        atomic_json(journal, d)
                    return {'state': 'already organized', 'source': str(src), 'destination': str(dst)}
                if not src.exists() and not src.is_symlink() and dst.is_dir():
                    if snapshot(dst) != d['tree']:
                        raise RuntimeError('Interrupted migration archive differs; preserve and inspect')
                    if apply:
                        src.symlink_to(dst, target_is_directory=True)
                        d.update(state='linked', completed=now())
                        atomic_json(journal, d)
                    return {'state': 'compatibility link restored' if apply else 'link restoration pending',
                            'source': str(src), 'destination': str(dst)}
                if d['state'] != 'planned' or dst.exists():
                    raise RuntimeError('Ambiguous interrupted migration; preserve both paths')
            if src.is_symlink() or not src.is_dir() or dst.exists():
                raise ValueError('Adopt only a physical directory into a fresh legacy destination')
            git = subprocess.run(['git', '-C', str(self.project), 'ls-files', '-z', '--', str(rel)], capture_output=True)
            if git.returncode or git.stdout:
                raise ValueError('Cannot relocate tracked material or a project without Git ownership checks')
            before = snapshot(src)
            if any('link' in x for x in before.values()):
                raise ValueError('Legacy tree has links; resolve their dependencies before relocation')
            result = {'state': 'preview', 'source': str(src), 'destination': str(dst),
                      'entries': len(before), 'allocated_bytes': allocated(before), 'deletions': 0}
            if not apply:
                return result
            if src.stat().st_dev != dst.parent.stat().st_dev:
                raise ValueError('This adopter requires same-volume rename; no copy/delete fallback')
            guard([src])
            if snapshot(src) != before:
                raise RuntimeError('Legacy tree changed during consumer checks')
            d = {'source': str(src), 'destination': str(dst), 'tree': before, 'state': 'planned', 'time': now()}
            atomic_json(journal, d)
            src.rename(dst)
            d['state'] = 'moved'
            atomic_json(journal, d)
            if snapshot(dst) != before:
                raise RuntimeError('Relocation verification failed; preserve archive and inspect journal')
            src.symlink_to(dst, target_is_directory=True)
            d.update(state='linked', completed=now())
            atomic_json(journal, d)
            result['state'] = 'organized and verified'
            return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, required=True)
    parser.add_argument('--workspace', type=Path)
    sub = parser.add_subparsers(dest='command', required=True)
    for name in ('init', 'inventory', 'plan'):
        sub.add_parser(name)
    clean = sub.add_parser('clean')
    clean.add_argument('--plan', type=Path)
    clean.add_argument('--apply', action='store_true')
    for name in ('pin', 'resolve'):
        p = sub.add_parser(name)
        p.add_argument('id')
        p.add_argument('reason')
    p = sub.add_parser('register')
    p.add_argument('relative')
    p.add_argument('--role', choices=('scratch', 'cache'), required=True)
    p.add_argument('--reason', required=True)
    p = sub.add_parser('retain')
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--group', required=True)
    p.add_argument('--verification', choices=LEVELS, required=True)
    p.add_argument('--evidence', type=Path, required=True)
    p.add_argument('--pin', action='append', default=[])
    p = sub.add_parser('adopt')
    p.add_argument('relative')
    p.add_argument('--label', required=True)
    p.add_argument('--apply', action='store_true')
    run = sub.add_parser('run')
    run.add_argument('label')
    run.add_argument('argv', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    w = Workspace(args.project, args.workspace)
    if args.command == 'init':
        w.init()
        result = {'workspace': str(w.root), 'project': str(w.project)}
    else:
        w.validate()
        if args.command == 'inventory':
            result = w.inventory()
        elif args.command == 'plan' or args.command == 'clean' and not args.apply:
            result = w.plan()
        elif args.command == 'clean':
            if args.plan is None:
                raise ValueError('--apply requires an exact --plan')
            result = w.clean(args.plan)
        elif args.command in ('pin', 'resolve'):
            result = w.update(args.id, args.reason, resolve=args.command == 'resolve')
        elif args.command == 'register':
            result = w.register(args.relative, args.role, args.reason)
        elif args.command == 'adopt':
            result = w.adopt(args.relative, args.label, args.apply)
        elif args.command == 'retain':
            with w.lock():
                result = w.retain(args.source, args.group, args.verification, json.loads(args.evidence.read_text()), args.pin)
        else:
            cmd = args.argv[1:] if args.argv[:1] == ['--'] else args.argv
            if not cmd:
                raise ValueError('A command is required')
            if shutil.disk_usage(w.root).free < w.validate()['minimum_free_bytes']:
                raise RuntimeError('Insufficient build reserve; inspect inventory before starting')
            with w.session(args.label) as (path, item):
                scratch = path / 'scratch'
                scratch.mkdir()
                env = dict(os.environ, PROJECT_WORKSPACE=str(w.root), PROJECT_RUN=str(path), TMPDIR=str(scratch))
                with (path / 'command.log').open('w') as f:
                    outcome = subprocess.run(cmd, cwd=w.project, env=env, stdout=f, stderr=subprocess.STDOUT)
                atomic_json(path / 'command.json', {'executable': Path(cmd[0]).name, 'argument_count': len(cmd)-1,
                                                   'exit_code': outcome.returncode, 'time': now()})
                if outcome.returncode:
                    raise RuntimeError('Command failed; diagnostic run pinned: ' + str(path))
            result = {'run': str(path), 'verified_build': False}
            try:
                plan = w.plan()
                result['cleanup'] = w.clean(plan['plan'])
            except (OSError, ValueError, RuntimeError) as e:
                result['cleanup_deferred'] = str(e)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError) as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
