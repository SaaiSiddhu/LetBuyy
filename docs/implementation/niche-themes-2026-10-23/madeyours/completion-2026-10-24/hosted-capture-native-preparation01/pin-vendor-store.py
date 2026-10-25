"""Pin installed dependency bytes/links only. No imports of application code."""
from pathlib import Path
import os,json,hashlib,datetime
p=Path(__file__).parent;store=Path('/Volumes/Projects/LetBuyy/node_modules/.pnpm');rows=[];links=[];excluded=[];total=0;cache={}
for current,dirs,files in os.walk(store,followlinks=False):
 here=Path(current)
 for name in list(dirs)+files:
  q=here/name;relative=str(q.relative_to(store))
  if q.is_symlink():links.append({'path':relative,'target':os.readlink(q),'resolved':str(q.resolve(strict=False))})
  elif q.is_file():
   if name=='.npmrc' or '.env.' in name or name=='.env':excluded.append({'path':relative,'reason':'Excluded environment/config credentials path; no values read.'});continue
   st=q.stat();identity=(st.st_dev,st.st_ino,st.st_size,st.st_mtime_ns)
   if identity in cache:digest=cache[identity]
   else:
    h=hashlib.sha256()
    with q.open('rb')as f:
     for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    digest=h.hexdigest();cache[identity]=digest
   rows.append({'path':relative,'sha256':digest,'bytes':st.st_size});total+=st.st_size
rows.sort(key=lambda r:r['path']);links.sort(key=lambda r:r['path'])
out={'classification':'READONLY_COMPLETE_INSTALLED_PNPM_BYTES_AND_LINKS_NOT_RUNTIME_EXECUTION','recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'store':str(store),'files':rows,'links':links,'excludedPotentialEnvironmentFiles':excluded,'bytes':total,'noDependencyInstall':True,'applicationCodeImported':False}
(p/'VENDOR_STORE_CLOSURE.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'vendorFiles':len(rows),'links':len(links),'bytes':total,'excludedEnvFiles':len(excluded)}),flush=True)
