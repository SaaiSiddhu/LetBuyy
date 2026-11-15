from pathlib import Path
import json,hashlib,shutil,tarfile,os,datetime,subprocess
from qualify import ROOT,E,snapshot,write
N=Path('/private/tmp/letbuyy-merchant-local-20261106-dzfklhx4');R=N/'native-warehouse-v78'
a=json.loads((E/'native78-independent-readback.json').read_text());s=json.loads((E/'merchant-media-feedback-source-v54.source.json').read_text());assert snapshot()['files']==s['files']
assert a['source_sha256']==s['sha256'] and a['source_and_controller_inputs_unchanged'] and not any(a['remaining'].values())
base=ROOT/'artifacts/local-operational-proof/merchant-mobile'/('native78-'+a['run_id']);assert not base.exists();base.mkdir(parents=True,mode=0o700)
assert subprocess.run(['git','check-ignore','--quiet',str(base.relative_to(ROOT))],cwd=ROOT).returncode==0
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
apk=Path(a['apk']);assert h(apk)==a['apk_sha256'];target=base/'merchant-local-debug.apk';shutil.copyfile(apk,target);target.chmod(0o600);assert h(target)==h(apk)
manifest=base/'source-manifest.json';shutil.copyfile(E/'merchant-media-feedback-source-v54.source.json',manifest);manifest.chmod(0o600)
assert not any(Path(p).name.startswith('.env')for p in s['files'])
archive=base/'qualified-source-v54.tar.gz'
with tarfile.open(archive,'w:gz')as tar:
 for rel,digest in s['files'].items():
  p=ROOT/rel;assert p.is_file() and not p.is_symlink() and h(p)==digest;tar.add(p,arcname=rel,recursive=False)
archive.chmod(0o600)
with tarfile.open(archive,'r:gz')as tar:
 members=tar.getmembers();assert len(members)==len(s['files']) and {x.name for x in members}==set(s['files'])
 for member in members:
  assert member.isfile() and hashlib.sha256(tar.extractfile(member).read()).hexdigest()==s['files'][member.name]
D=E.parent/'native78-accepted-local-kyc-media-staff';assert not D.exists();D.mkdir(mode=0o700)
old=json.loads((E/'native74-cold-custody-readback.json').read_text());files=[]
for row in old['safe_files']:
 name=row['path'].replace('v74','v78').replace('native74','native78').replace('merchant-kyc-receipt-source-v44.source.json','merchant-media-feedback-source-v54.source.json')
 candidates=[p/name for p in [E,N,R] if (p/name).is_file()];assert len(candidates)==1,(name,len(candidates))
 src=candidates[0];dst=D/name;shutil.copyfile(src,dst);dst.chmod(0o600);assert h(dst)==h(src);files.append({'path':name,'sha256':h(dst)})
visual=E/'native78-visual-pixel-readback.json';v=json.loads(visual.read_text());assert v['run_id']==a['run_id'] and v['source_sha256']==s['sha256'] and v['status'].endswith('PASS')
visual_target=D/visual.name;shutil.copyfile(visual,visual_target);visual_target.chmod(0o600);assert h(visual_target)==h(visual);files.append({'path':visual.name,'sha256':h(visual_target)})
assert snapshot()['files']==s['files']
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'EXACT_SOURCE_APK_AND_ALLOWLISTED_EVIDENCE_CUSTODY_PASS','run_id':a['run_id'],'qualified_source_sha256':s['sha256'],'qualified_source_inputs':s['entries'],'apk_sha256':a['apk_sha256'],'ignored_artifact':str(target.relative_to(ROOT)),'source_archive':{'path':str(archive.relative_to(ROOT)),'sha256':h(archive),'exact_source_members_verified':len(s['files']),'scope':'Only admitted source regular files; no env/runtime/session/DB dump export.'},'safe_evidence':str(D.relative_to(ROOT)),'safe_files':files,'limits':'Synthetic local accepted cohort only; no hosted/provider India-KYC, physical/iOS runtime, release or full122certification. Temporary readiness/session/JWK/env/VM/wire-ingress records excluded; no private object keys or private document bytes copied.'}
write(E/'native78-cold-custody-readback.json',result);print(json.dumps({k:result[k]for k in ['status','run_id','qualified_source_inputs','apk_sha256','safe_evidence']}))
