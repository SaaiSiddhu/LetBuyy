#!/usr/bin/env python3
"""Checkout-bound CI lifecycle. Upload confirmation precedes any managed pruning."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import sys
import tarfile
import time
import uuid

if os.name=='posix':
    import engine
else:
    engine=None  # No destructive fallback without supported lock/consumer visibility.

FIELDS=('GITHUB_REPOSITORY','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','GITHUB_JOB')
KEY_SUFFIXES={'.key','.pem','.jks','.keystore','.p12','.pfx','.agvault','.p2pb','.p2pe','.db','.sqlite','.sqlite3','.sql','.dump'}
BIN_SUFFIXES={'.apk','.aab','.ipa','.msix','.msixbundle','.msi','.exe'}
SYMBOL_SUFFIXES={'.symbols','.pdb','.bcsymbolmap'}
MAPPING_NAMES={'mapping.txt','configuration.txt','seeds.txt','usage.txt'}
SKIP={'.git','node_modules','.gradle','.pnpm-store','.local','.local-run','.local-recovery','backup','backups',
      'recovery','recovery-private','private-transfer','vendor','fixtures','reference','.project-cleanup'}


def write(path,data):
    path=Path(path);temp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
    try:
        with temp.open('x') as f:json.dump(data,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
        if os.name=='posix':os.chmod(temp,0o600)
        os.replace(temp,path)
    finally:
        if temp.exists():temp.unlink()


def sha(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
    return h.hexdigest()


def ci_identity(env):
    d={k:env.get(k,'') for k in FIELDS}
    if not all(d.values()):raise ValueError('Missing CI job identity; no cleanup')
    return d


def physical(path):
    p=Path(path).absolute()
    if p.is_symlink() or p!=p.resolve():raise ValueError('CI scope requires a physical path')
    return p


def begin(project,temporary,env,audit_only=False):
    project=physical(project);temporary=physical(temporary)
    identity=ci_identity(env)
    if not project.is_dir() or not temporary.is_dir() or project==temporary or project in temporary.parents or temporary in project.parents:
        raise ValueError('CI temporary and source boundaries must be separate')
    key=hashlib.sha256((identity['GITHUB_REPOSITORY']+'\0'+str(project)).encode()).hexdigest()[:16]
    root=temporary/('project-cleanup-'+key)
    audit_only=audit_only or engine is None
    if not audit_only:
        w=engine.Workspace(project,root).init()
        with w.lock():
            relative='runs/ci-'+uuid.uuid4().hex;scope=w.path(relative);scope.mkdir();(scope/'scratch').mkdir();(scope/'payload').mkdir()
            x=w.add(relative,'run',ci_identity=identity,verification_group='ci-'+identity['GITHUB_JOB'])
    else:
        root.mkdir(mode=0o700,exist_ok=True)
        owner=root/'ci-audit-owner.json'
        if owner.exists() and json.loads(owner.read_text()).get('project')!=str(project):raise ValueError('Foreign CI audit workspace')
        if not owner.exists():write(owner,{'project':str(project),'mode':'audit-only; deletion disabled'})
        scope=root/'runs'/('ci-'+uuid.uuid4().hex);scope.mkdir(parents=True);(scope/'scratch').mkdir();(scope/'payload').mkdir()
        x={'id':uuid.uuid4().hex}
    record={'schema':1,'project':str(project),'workspace':str(root),'scope':str(scope),'item':x['id'],
            'identity':identity,'audit_only':audit_only,'created':time.time(),'status':'active','artifact_upload':None}
    write(scope/'ci-job.json',record)
    return {'scope':str(scope),'scratch':str(scope/'scratch'),'payload':str(scope/'payload'),'workspace':str(root),'audit_only':audit_only}


def load(scope,env):
    scope=physical(scope);d=json.loads((scope/'ci-job.json').read_text())
    if d.get('schema')!=1 or d.get('scope')!=str(scope) or d.get('identity')!=ci_identity(env):raise ValueError('Foreign/stale CI job scope')
    root=physical(d['workspace']);source=physical(d['project'])
    if root not in scope.parents or scope.parent!=root/'runs' or root==source or root in source.parents or source in root.parents:
        raise ValueError('Invalid CI boundary')
    return scope,d


def safe_binary(path):
    path=Path(path)
    if path.is_symlink():return False
    if path.is_file():return path.suffix.lower() in BIN_SUFFIXES
    if not path.is_dir() or path.suffix not in ('.app','.dSYM'):return False
    for folder,dirs,files in os.walk(path,followlinks=False):
        for name in [*dirs,*files]:
            p=Path(folder)/name
            if p.is_symlink():
                if path.resolve() not in p.resolve().parents:return False
                if name in dirs:dirs.remove(name)
            elif p.is_file() and (p.name.startswith('.env') or p.suffix.lower() in KEY_SUFFIXES):return False
    return True


def build_outputs(project):
    for folder,dirs,files in os.walk(project,followlinks=False):
        p=Path(folder);dirs[:]=[n for n in dirs if n not in SKIP and not (p/n).is_symlink()]
        built=bool({'build','Build','dist','publish'}.intersection(p.parts) or 'bin' in p.parts and {'Debug','Release'}.intersection(p.parts))
        if not built:continue
        for name in dirs[:]:
            q=p/name
            if q.suffix in ('.app','.dSYM'):
                dirs.remove(name)
                if safe_binary(q):yield q
        for name in files:
            q=p/name
            companion=not q.is_symlink() and (q.suffix.lower() in SYMBOL_SUFFIXES or
                       'outputs' in p.parts and 'mapping' in p.parts and q.name in MAPPING_NAMES)
            if safe_binary(q) or companion:yield q


def file_identity(path):
    if engine:return engine.identity(engine.snapshot(path))
    # Windows fallback only verifies its own upload staging; it never prunes.
    result={}
    for folder,dirs,files in os.walk(path):
        for name in files:
            p=Path(folder)/name
            if p.is_symlink():raise ValueError('No symbolic upload staging on audit-only host')
            result[str(p.relative_to(path))]={'sha256':sha(p)}
    if Path(path).is_file():return {'.':{'sha256':sha(path)}}
    return result


def verify_tar(archive_path,source_name,identity):
    with tarfile.open(archive_path,'r:*') as archive:
        for relative,row in identity.items():
            name=source_name+('/'+relative if relative!='.' else '')
            member=archive.getmember(name)
            if 'sha256' in row:
                h=hashlib.sha256();stream=archive.extractfile(member)
                if stream is None:raise RuntimeError('Missing archived binary')
                for block in iter(lambda:stream.read(1024*1024),b''):h.update(block)
                if h.hexdigest()!=row['sha256']:raise RuntimeError('Archived binary differs')
            if 'link' in row and member.linkname!=row['link']:raise RuntimeError('Archived link differs')
            if 'mode' in row and member.mode!=row['mode']:raise RuntimeError('Archived file mode differs')


def snapshot(scope,status,env,release=False):
    scope,d=load(scope,env)
    if status not in ('success','failure','cancelled','unknown'):raise ValueError('Unknown CI status')
    if d['status']!='active':raise ValueError('CI scope already finalized')
    payload=scope/'payload';manifest=[];skipped=[]
    for artifact in build_outputs(Path(d['project'])):
        before=file_identity(artifact)
        name=hashlib.sha256(str(artifact.relative_to(d['project'])).encode()).hexdigest()[:16]
        target=payload/(name+('.tar.gz' if artifact.is_dir() else artifact.suffix))
        if target.exists():raise ValueError('Repeated snapshot; preserve the existing payload')
        if artifact.is_dir():
            with tarfile.open(target,'w:gz',dereference=False) as archive:archive.add(artifact,arcname=artifact.name,recursive=True)
            verify_tar(target,artifact.name,before)
        else:shutil.copy2(artifact,target)
        if file_identity(artifact)!=before:raise RuntimeError('Build output changed during snapshot; no cleanup')
        if artifact.is_file() and sha(target)!=before['.']['sha256']:raise RuntimeError('Upload copy mismatch')
        manifest.append({'source':str(artifact.relative_to(d['project'])),'payload':target.name,'sha256':sha(target),
                         'source_identity':before,'bytes':target.stat().st_size})
    d.update(status=status,release=bool(release),snapshot_time=time.time(),payload_identity=file_identity(payload))
    receipt={'schema':1,'source_revision':env.get('GITHUB_SHA'),'identity':d['identity'],'job_status':status,
             'scope':'CI job status and output hashes; tolerated steps/source stability/physical acceptance are not inferred',
             'build_outputs':manifest,'skipped':skipped,'raw_secrets_databases_recovery_uploaded':False,
             'diagnostics':'Original CI logs and existing workflow uploads remain under their owning retention policy'}
    write(payload/'manifest.json',receipt)
    d['payload_identity']=file_identity(payload);write(scope/'ci-job.json',d)
    return {'payload':str(payload),'outputs':len(manifest),'status':status}


def acknowledge(scope,artifact_id,digest,env):
    scope,d=load(scope,env)
    if not str(artifact_id).isdigit() or len(digest)!=64 or any(c not in '0123456789abcdefABCDEF' for c in digest):
        raise ValueError('No verified artifact upload receipt')
    if not d.get('payload_identity') or file_identity(scope/'payload')!=d['payload_identity']:
        raise RuntimeError('Staged evidence changed after upload; no cleanup')
    d['artifact_upload']={'artifact_id':str(artifact_id),'artifact_digest':digest,'time':time.time()}
    write(scope/'ci-job.json',d)
    return {'archive_confirmed':True}


def finalize(scope,env,guard=None):
    scope,d=load(scope,env)
    if d.get('finalized'):return {'already_finalized':True,'removed':0}
    archive=d.get('artifact_upload')
    if archive and file_identity(scope/'payload')!=d.get('payload_identity'):
        archive=None
    pins=[]
    if d.get('status')!='success':pins.append('unresolved CI failure/cancellation/outcome')
    if not archive:pins.append('artifact upload not confirmed; preserve all local evidence')
    if d.get('release'):pins.append('release/distribution workflow; no automatic eviction')
    d.update(finalized=time.time(),protection=pins)
    write(scope/'ci-job.json',d)
    result={'artifact_upload_confirmed':bool(archive),'pins':pins,'audit_only':d['audit_only'],'removed':0}
    if engine and not d['audit_only']:
        w=engine.Workspace(d['project'],d['workspace'])
        with w.lock():
            item=next((x for x in w.items() if x['id']==d['item']),None)
            if not item or item['state']!='active':raise ValueError('CI registry lease does not match active job')
            item.update(state='complete' if d.get('status')=='success' else 'failed',finished=time.time(),
                        pins=pins,identity=engine.identity(engine.snapshot(scope)))
            w.save(item)
        if archive:
            try:
                plan=w.plan();result['cleanup']=w.clean(plan['plan'],**({'guard':guard} if guard else {}))
            except (OSError,ValueError,RuntimeError) as e:result['cleanup_deferred']=str(e)
        else:result['cleanup_deferred']='Upload preservation gate has not passed'
        write(w.path('reports/ci-'+uuid.uuid4().hex+'.json'),result)
    return result


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('phase',choices=('begin','snapshot','archive','finalize'))
    a=p.parse_args();env=os.environ
    if a.phase=='begin':result=begin(env['GITHUB_WORKSPACE'],env['RUNNER_TEMP'],env)
    elif a.phase=='snapshot':result=snapshot(env['PROJECT_CLEANUP_CI_SCOPE'],env.get('PROJECT_CLEANUP_JOB_STATUS','unknown'),env,env.get('PROJECT_CLEANUP_RELEASE')=='true')
    elif a.phase=='archive':result=acknowledge(env['PROJECT_CLEANUP_CI_SCOPE'],env.get('PROJECT_CLEANUP_ARTIFACT_ID',''),env.get('PROJECT_CLEANUP_ARTIFACT_DIGEST',''),env)
    else:result=finalize(env['PROJECT_CLEANUP_CI_SCOPE'],env)
    print(json.dumps(result))


if __name__=='__main__':
    try:main()
    except (OSError,ValueError,RuntimeError,KeyError) as e:
        print('::warning::Protected cleanup deferred: '+type(e).__name__,file=sys.stderr);sys.exit(1)
