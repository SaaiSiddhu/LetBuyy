from pathlib import Path
import subprocess,tempfile,shutil,json,hashlib,os,datetime
from qualify import ROOT,E,snapshot,write
source=json.loads((E/'merchant-catalog-media-source-v72.source.json').read_text())
if snapshot()['files']!=source['files']: raise RuntimeError('Source changed')
index=Path(subprocess.check_output(['git','rev-parse','--git-path','index'],cwd=ROOT,text=True).strip())
if not index.is_absolute(): index=ROOT/index
index_before=hashlib.sha256(index.read_bytes()).hexdigest()
capsule=Path(tempfile.mkdtemp(prefix='letbuyy-merchant-catalog-media-v72-governance-',dir='/private/tmp'))
os.chmod(capsule,0o700)
write(E/'merchant-catalog-media-v72-governance-v1.active.json',{'supervisor_pid':os.getpid(),'capsule':str(capsule),'source_sha256':source['sha256'],'status':'PREPARING'})
with (E/'merchant-catalog-media-v72-governance-v1-preparation.log').open('w') as log:
    subprocess.run(['git','clone','--shared','--no-hardlinks',str(ROOT),str(capsule)],check=True,stdout=log,stderr=subprocess.STDOUT)
    paths=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=ROOT).decode().split('\0')
    for rel in sorted(set(paths)):
        if not rel: continue
        src=ROOT/rel; dst=capsule/rel
        if src.is_file():
            dst.parent.mkdir(parents=True,exist_ok=True)
            if dst.is_symlink(): dst.unlink()
            shutil.copy2(src,dst)
        elif not src.exists() and (dst.is_file() or dst.is_symlink()):
            dst.unlink()
    if not (capsule/'node_modules').exists(): (capsule/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
    subprocess.run(['git','add','-A'],cwd=capsule,check=True,stdout=log,stderr=subprocess.STDOUT)
def equal_inputs():
    bad=[]
    for rel,digest in source['files'].items():
        p=capsule/rel
        if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=digest: bad.append(rel)
    if bad: raise RuntimeError('Capsule byte mismatch: '+repr(bad[:10]))
equal_inputs()
with (E/'merchant-catalog-media-v72-governance-v1.log').open('w') as log:
    result=subprocess.run(['node','scripts/validate-governance.mjs','--lane=gate','--report-json='+str(E/'merchant-catalog-media-v72-governance-v1-report.json')],cwd=capsule,stdout=log,stderr=subprocess.STDOUT)
equal_inputs()
readback=snapshot()
terminal={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'TERMINAL','exit_code':result.returncode,'capsule':str(capsule),'purpose':'Disposable validation copy only, no implementation/worktree/merge/push/release','source_sha256':source['sha256'],'core_inputs_byte_equal':len(source['files']),'original_source_unchanged':readback['files']==source['files'],'original_index_unchanged':hashlib.sha256(index.read_bytes()).hexdigest()==index_before,'report':'merchant-catalog-media-v72-governance-v1-report.json'}
write(E/'merchant-catalog-media-v72-governance-v1.terminal.json',terminal);print(json.dumps(terminal))
raise SystemExit(result.returncode if terminal['original_source_unchanged'] and terminal['original_index_unchanged'] else 99)
