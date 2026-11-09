from pathlib import Path
import os,subprocess,json,datetime,time
from qualify import ROOT,E,snapshot,write
assert json.loads((E/'kyc-receipt-v39-pipeline.terminal.json').read_text())['status']=='PASS'
source=json.loads((E/'merchant-kyc-receipt-source-v39.source.json').read_text());assert snapshot()['files']==source['files']
n=Path('/private/tmp/letbuyy-merchant-local-20261106-dzfklhx4');root=Path('/private/tmp/letbuyy-merchant-emulator-de849422c5');o=json.loads((root/'ownership.json').read_text());sdk=Path('/Volumes/Developer Tools/SDKs/android-sdk');name=o['name']
assert o=={'owner':'merchant-mobile-parity','root':str(root),'name':'LetBuyy_Merchant_Parity_20261106_c6cefc','avd_home':str(root/'avds'),'create_exit_code':0,'created_at':'2026-11-05T18:36:04.663259+00:00'};assert root.resolve()==root
for port in [5580,5581,54350,54351,54352,54353]:
 p=subprocess.run(['lsof','-nP','-iTCP:'+str(port),'-sTCP:LISTEN'],capture_output=True,text=True);assert p.returncode==1,'Required port occupied; preserve owner: '+str(port)
p=subprocess.run(['lsof','-nP','-iTCP:15038','-sTCP:LISTEN','-Fp'],capture_output=True,text=True)
if p.returncode==0:
 for pid in [l[1:]for l in p.stdout.splitlines()if l.startswith('p')]:
  c=subprocess.check_output(['ps','-p',pid,'-o','command='],text=True);assert 'adb' in c and '15038' in c,'Existing15038listener is not the exact isolated ADB server'
else:assert p.returncode==1
command=[str(sdk/'emulator/emulator'),'-avd',name,'-port','5580','-memory','3072','-gpu','auto','-no-window','-no-audio','-no-boot-anim','-no-snapshot-load','-no-snapshot-save'];env=dict(os.environ,ANDROID_AVD_HOME=str(root/'avds'),ANDROID_ADB_SERVER_PORT='15038',ANDROID_HOME=str(sdk),ANDROID_SDK_ROOT=str(sdk));awake=subprocess.Popen(['/usr/bin/caffeinate','-i','-w',str(os.getpid())])
try:
 with(n/'native66-emulator-boot.log').open('x')as log:child=subprocess.Popen(command,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 record={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'name':name,'emulator_pid':child.pid,'command':command,'status':'BOOT_REQUESTED','scope':'Restart only exact owned stopped AVD; preserve userdata/other devices;no host9002 use.'};write(E/'native66-emulator-restart.json',record)
 adb=[str(sdk/'platform-tools/adb'),'-P','15038','-s','emulator-5580'];deadline=time.monotonic()+180
 while time.monotonic()<deadline:
  assert child.poll()is None,'Owned emulator stopped; inspect private boot log'
  p=subprocess.run(adb+['shell','getprop','sys.boot_completed'],capture_output=True,text=True,timeout=8)
  if p.returncode==0 and p.stdout.strip()=='1':break
  time.sleep(2)
 else:raise RuntimeError('Exact owned emulator not ready; retain it for ownership inspection')
 assert subprocess.check_output(adb+['emu','avd','name'],text=True,stderr=subprocess.PIPE,timeout=10).splitlines()[0]==name
 record.update(status='EXACT_OWNED_AVD_READY',completed_at=datetime.datetime.now(datetime.timezone.utc).isoformat());write(E/'native66-emulator-restart.json',record)
 old=json.loads((n/'android-device-receipt-switcher-v65.json').read_text());old.update(emulator_pid=child.pid,run_root=str(n/'native-warehouse-v66'));write(n/'android-device-receipt-switcher-v66.json',old);(n/'android-device-receipt-switcher-v66.json').chmod(0o600)
 import hashlib
 assert hashlib.sha256((ROOT/'tests/owned-device/merchant-catalog-local-android.postgres.test.ts').read_bytes()).hexdigest()=='12917f372dee1ecf6610c8888af1caa9a5a80b545388ba0b58570c6b9c6f8510'
 controls=[n/'run-switcher-v66.py',n/'android-device-receipt-switcher-v66.json',E/'android-switcher-staff-v66.py',E/'merchant-switcher-staff-v66-local-android.postgres.test.ts'];write(E/'native66-prepared-final.json',{'at':record['completed_at'],'root':str(n),'source_manifest':'merchant-kyc-receipt-source-v39.source.json','source_sha256':source['sha256'],'inputs':[{'path':str(p.resolve()),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in controls],'protected_fixture_sha256':hashlib.sha256((ROOT/'tests/owned-device/merchant-catalog-local-android.postgres.test.ts').read_bytes()).hexdigest(),'scope':'Current source; native58 full business/security assertions retained. Extend native owner53staff roster with DB/hash equality, null/typed/empty metadata conservation and actual web owned-image decode. No external origins or real invites.','status':'READY_NOT_LAUNCHED'})
 print(json.dumps({k:record[k]for k in ['name','emulator_pid','status']}))
finally:
 if awake.poll()is None:awake.terminate();awake.wait(timeout=5)
