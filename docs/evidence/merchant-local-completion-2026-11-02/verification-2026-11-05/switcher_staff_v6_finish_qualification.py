import json,datetime,subprocess,sys,os
from qualify import E,ROOT,snapshot,write
source=json.loads((E/'switcher-staff-source-v6.source.json').read_text());assert snapshot()['files']==source['files']
for name in ['app-analysis','full-flutter']:
 d=json.loads((E/('switcher-staff-v6-'+name+'-v1.terminal.json')).read_text());assert d['exit_code']==0 and d['source_unchanged']and d['source_sha256']==source['sha256']
state={'status':'RUNNING','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'supervisor_pid':os.getpid(),'source_sha256':source['sha256'],'preceding':'Original v6 analysis and full Flutter tests passed. Governance v1 failed on a synthetic fixture password expression; old fixture bytes retained, expression replaced by generated random secret. No product input change.','steps':[]}
steps=[('governance-v2','switcher_staff_v6_governance_capsule_v2.py',[]),('android-compile','build_switcher_staff_v6_artifact.py',['android']),('ios-compile','build_switcher_staff_v6_artifact.py',['ios']),('artifact-readback','read_switcher_staff_v6_artifacts.py',[])]
for name,script,args in steps:
 state['active_step']=name;write(E/'switcher-staff-v6-finish.active.json',state)
 with (E/('switcher-staff-v6-finish-step-'+name+'.log')).open('x')as log:result=subprocess.run([sys.executable,str(E/script),*args],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
 state['steps'].append({'step':name,'exit_code':result.returncode})
 if result.returncode:
  state['status']='STOPPED_AT_FAILED_STEP';write(E/'switcher-staff-v6-finish.terminal.json',state);print(json.dumps(state));raise SystemExit(result.returncode)
state.update(status='TERMINAL_ALL_REQUIRED_LOCAL_GATES_PASSED',active_step=None,source_unchanged=snapshot()['files']==source['files'],finished_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
write(E/'switcher-staff-v6-finish.terminal.json',state);write(E/'switcher-staff-v6-finish.active.json',state);print(json.dumps(state));raise SystemExit(0 if state['source_unchanged']else 99)
