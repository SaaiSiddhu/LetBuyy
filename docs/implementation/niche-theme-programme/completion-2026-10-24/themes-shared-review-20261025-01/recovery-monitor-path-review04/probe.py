from pathlib import Path
import json,hashlib
old=Path('/private/tmp/letbuyy-original210-restore-monitor01.py');new=Path('/private/tmp/letbuyy-original210-restore-monitor02.py');H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert H(old)=='aa57db99ee887c913069cfe514b7988cce91a870ff6e0ab60acb8e1a42a2b571'
assert H(new)=='951f414dbf5151574dfb4107d0ca758aac2bb5a4014acdb1e1ae2c53eb919e80'
oldroot='/private/tmp/letbuyy-original210-recovery-20261025-01';newroot=oldroot[:-2]+'02'
oldout='/Volumes/Projects/LetBuyy/docs/implementation/niche-theme-programme/completion-2026-10-24/original210-recovery-candidate01/future-restore-rehearsal01';newout=oldout.replace('candidate01/','candidate02/').replace('rehearsal01','rehearsal02')
assert new.read_bytes()==old.read_bytes().replace(oldroot.encode(),newroot.encode()).replace(oldout.encode(),newout.encode())
helper=Path('/Volumes/Projects/LetBuyy/docs/implementation/niche-theme-programme/completion-2026-10-24/themes-shared-review-20261025-01/recovery-monitor-review01/synthetic-helper03.py');source=helper.read_text().split('for name,kwargs in [')[0];source=source.replace(str(old),str(new)).replace(oldroot,newroot).replace(oldout,newout)
g={'__name__':'pure_relocation_review'};exec(compile(source,'pinned-prior-pure-monitor-helper','exec'),g)
cases=[]
positive=g['run_case']('normal');assert positive['return']==0 and sum(isinstance(x,dict)for x in positive['events'])==1;cases.append({'name':'new source/output exact binding positive','return':positive['return'],'fakeStarts':1})
for name,key,bad in [('old source root denied','ROOT',oldroot),('old output directory denied','OUT',oldout),('stale monitor digest denied','source_sha',H(old))]:
 original=g[key];g[key]=bad
 try:r=g['run_case']('normal')
 finally:g[key]=original
 assert r['error']and not any(isinstance(x,dict)for x in r['events']);cases.append({'name':name,'errorClass':r['error'].split(':')[0],'fakeStarts':0})
result={'status':'EXACT_PATH_ONLY_RELOCATION_AND_FOUR_FOCUSED_BINDING_CONTROLS_PASS','beforeSha256':H(old),'afterSha256':H(new),'priorHelper':str(helper),'priorHelperSha256':H(helper),'sameBehaviorEightControls':'Reused exact earlier44c2233... monitor03 acceptance because allremainingbytes match, not rerun/recounted','focusedControls':cases,'actualProcessesResourcesDbPrivateInputs':0}
Path('/private/tmp/themes-restore-monitor-relocation04-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
