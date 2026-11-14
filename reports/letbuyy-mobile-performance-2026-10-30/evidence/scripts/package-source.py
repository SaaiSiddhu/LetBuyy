from pathlib import Path
import json,hashlib,difflib,shutil,datetime
root=Path.cwd();w=Path('/tmp/letbuyy-mobile-performance-20261030');out=root/'reports/letbuyy-mobile-performance-2026-10-30';out.mkdir(exist_ok=True);(out/'evidence').mkdir(exist_ok=True)
start=json.loads((w/'start-manifest.json').read_text());names=set(start)
for d in ['apps/marketing/web/src','apps/marketing/web/public','tests/marketing']:names.update(str(p.relative_to(root))for p in(root/d).rglob('*')if p.is_file())
changes=[];patch=[];binaries=[]
for name in sorted(names):
 p=root/name;current=p.read_bytes();after=hashlib.sha256(current).hexdigest();before=start.get(name)
 if after==before:continue
 previous=(w/'before'/name).read_bytes()if before else b''
 if before:assert hashlib.sha256(previous).hexdigest()==before,name
 row={'path':name,'before_sha256':before,'after_sha256':after,'before_bytes':len(previous),'after_bytes':len(current)}
 changes.append(row)
 try:a=previous.decode();b=current.decode()
 except UnicodeDecodeError:
  binaries.append(row);d=out/'evidence/font-rollback';d.mkdir(exist_ok=True);shutil.copy2(w/'before'/name,d/('before-'+p.name));shutil.copy2(p,d/('after-'+p.name));row.update(before_asset='evidence/font-rollback/before-'+p.name,after_asset='evidence/font-rollback/after-'+p.name);continue
 patch.extend(difflib.unified_diff(a.splitlines(True),b.splitlines(True),fromfile='a/'+name if before else '/dev/null',tofile='b/'+name))
(out/'TASK-SOURCE-CHANGES.patch').write_text(''.join(patch));(out/'SOURCE-MANIFEST.json').write_text(json.dumps({'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'basis':'Task-start bytes, including previously uncommitted user work; not HEAD. Text patch excludes the binary font, whose prior asset is retained for rollback.','changes':changes,'binary_assets':binaries},indent=2));(w/'source-changes.json').write_text(json.dumps(changes,indent=2));print('Task-only source manifest:',len(changes),'files;',len(binaries),'binary')
