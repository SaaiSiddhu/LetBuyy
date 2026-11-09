"""Read-only installed app comparison for this task's exact simulator.
Writes immutable evidence into the admitted private fixture root only.
"""
from pathlib import Path
import sys,json,hashlib,subprocess,datetime,re
r=Path(sys.argv[1]).resolve();assert re.fullmatch(r'/private/tmp/letbuyy-ios-ui-20261107-[a-z0-9]+',str(r))
receipt=json.loads((r/'device-receipt.json').read_text());udid='B907B390-5B08-490F-BC6A-8900667B2D94'
assert receipt['owner']=='merchant-mobile-local-completion'and receipt['udid']==udid
root=Path(receipt['run_root']).resolve();assert root.parent==r
app=root/'qualified-artifact/Runner.app';assert app.is_dir()
v=json.loads(subprocess.check_output(['xcrun','simctl','list','devices','available','--json']));match=[x for g in v['devices'].values()for x in g if x['udid']==udid]
assert len(match)==1 and match[0]['name']=='LetBuyy Merchant Local 20261103 br1jhgh8'and match[0]['state']=='Booted'
installed=Path(subprocess.check_output(['xcrun','simctl','get_app_container',udid,'com.letbuyy.store','app'],text=True).strip())
def files(path):return {str(p.relative_to(path)):hashlib.sha256(p.read_bytes()).hexdigest()for p in sorted(path.rglob('*'))if p.is_file()}
a,b=files(app),files(installed);assert a==b
manifest=hashlib.sha256(json.dumps(a,sort_keys=True,separators=(',',':')).encode()).hexdigest()
for name,value in [('installed-artifact-custody.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'merchant-camera-video-model-source-v84','normal_debug_build':True,'all_installed_files_equal':True,'files':len(a),'manifest_sha256':manifest,'artifact':str(app),'installed':str(installed)}),('artifact-files.json',a)]:
 with(root/name).open('x')as f:json.dump(value,f,indent=2);f.write('\n')
print(json.dumps({'all_installed_files_equal':True,'files':len(a),'manifest_sha256':manifest}))
