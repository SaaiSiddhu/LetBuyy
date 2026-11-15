from pathlib import Path
from urllib.parse import urlsplit
import subprocess,os,json,time,hashlib,datetime
n=Path('/private/tmp/letbuyy-merchant-local-20261106-dzfklhx4');repo='/Users/saai_mithra/.codex/worktrees/merchant-mobile-parity/LetBuyy'
import sys
sys.path.insert(0,'/Users/saai_mithra/.codex/worktrees/merchant-mobile-parity/LetBuyy/docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05')
from qualify import snapshot
assert __import__('json').loads(__import__('pathlib').Path(repo+'/docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05/media-atomic-v53-pipeline.terminal.json').read_text())['status']=='PASS'
assert snapshot()['sha256']=='8d91014727d143e0fce8e1ee5e3dc578c1d4c89f5cafc0eaaca0e50c14e6286a','Qualified source changed before native admission'
r=json.loads((n/'android-device-receipt-switcher-v77.json').read_text());root=Path(r['run_root']);env=dict(os.environ);env['LETBUYY_ANDROID_DEVICE_RECEIPT']=str(n/'android-device-receipt-switcher-v77.json')
prefix=[r['sdk_root']+'/platform-tools/adb','-P',str(r['adb_port']),'-s',r['serial']]
def adb(*args):return subprocess.check_output(prefix+list(args),text=True,stderr=subprocess.PIPE,timeout=25).strip()
def maps():return sorted(tuple(x.split())for x in adb('reverse','--list').splitlines()if x.strip())
assert r['owner']=='merchant-mobile-local-completion'and r['serial']=='emulator-5580'and r['adb_port']==15038
assert adb('emu','avd','name').splitlines()[0]==r['avd_name']
baseline=maps();assert not baseline,'Existing emulator reverse mappings require separate ownership reconciliation'
forward_baseline={'serial':r['serial'],'adb_port':r['adb_port'],'rows':[x.split()for x in adb('forward','--list').splitlines()if x.strip()]}
with(n/'switcher-v77-forward-baseline.json').open('x')as f:json.dump(forward_baseline,f)
assert not root.exists()
args=['node','scripts/governance/run-executable-suites.mjs','--jobs','1','--no-reap','--kind','gateway-db','--timeout','2100','--suite','docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05/merchant-switcher-staff-v77-local-android.postgres.test.ts','--log-dir',str(n/'native-switcher-v77-logs'),'--json-out',str(n/'native-switcher-v77.json')]
status=None;runner=None;controller=None;awake=None
try:
 with(n/'native-switcher-v77.log').open('x')as log,(n/'native-switcher-v77-ui.log').open('x')as ui:
  runner=subprocess.Popen(args,cwd=repo,env=env,stdout=log,stderr=subprocess.STDOUT)
  awake=subprocess.Popen(['/usr/bin/caffeinate','-i','-w',str(runner.pid)])
  controller=subprocess.Popen(['python3',str(Path(repo)/'docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05/android-switcher-staff-v77.py')],cwd=repo,env=env,stdout=ui,stderr=subprocess.STDOUT)
  print('Started current-source local Android/web runner with current StoreSwitcher/Staff normal-UI companion.',flush=True)
  status=runner.wait()
  if controller.poll()is None:
   try:controller.wait(timeout=10)
   except subprocess.TimeoutExpired:controller.terminate();controller.wait(timeout=10)
finally:
 if runner is not None and runner.poll()is None:
  runner.send_signal(2)
  try:runner.wait(timeout=45)
  except subprocess.TimeoutExpired:raise RuntimeError('Owned runner still active; preserve and inspect rather than killing unrelated resources')
 if controller is not None and controller.poll()is None:controller.terminate();controller.wait(timeout=10)
 before=maps();removed=[];refused=[]
 if(root/'dart-defines.json').exists():
  defines=json.loads((root/'dart-defines.json').read_text());port=urlsplit(defines['LOCAL_CHALLENGE_SDK_URL']).port
  assert isinstance(port,int)and port>1024
  expected={('tcp:54352','tcp:54352'),('tcp:54350','tcp:54350'),('tcp:'+str(port),'tcp:'+str(port)),('tcp:9002','tcp:54351')}
  for item in before:
   if item in baseline:continue
   if item[1:]in expected and maps().count(item)==1:
    adb('reverse','--remove',item[1]);removed.append(item)
   else:refused.append(item)
 after=maps();cleanup={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'serial':r['serial'],'adb_port':r['adb_port'],'runner_exit':None if runner is None else runner.returncode,'controller_exit':None if controller is None else controller.returncode,'baseline':baseline,'before':before,'removed':removed,'refused':refused,'after':after,'scope':'Only current-run exact reverse tuples on task emulator. Host9002 never accessed.'}
 p=n/'switcher-v77-launcher-cleanup.json';p.write_text(json.dumps(cleanup,indent=2)+'\n');p.chmod(0o600)
 print('Owned runner terminal exit '+str(status)+'; UI exit '+str(None if controller is None else controller.returncode)+'; scoped reverse cleanup recorded.',flush=True)
 if awake is not None:
  try:awake.wait(timeout=3)
  except subprocess.TimeoutExpired:awake.terminate();awake.wait(timeout=3)
  (n/'switcher-v77-awake.json').write_text(json.dumps({'pid':awake.pid,'exit':awake.returncode,'scope':'Only idle-sleep prevention while this exact owned runner lives; no persistent power setting change; lid remains user-controlled'})+'\n')
 if refused or after!=baseline:raise RuntimeError('Emulator mapping terminal mismatch requires ownership inspection')
raise SystemExit(status if status is not None else 130)
