import datetime
import json
import os
import subprocess
import sys
from qualify import E, ROOT, snapshot, write

name='web-viewport-source-v1'
source=json.loads((E/(name+'.source.json')).read_text())
assert snapshot()['files']==source['files']
steps=[
 ('web-tests',[sys.executable,str(E/'qualify.py'),'run',name,'web-viewport-v1-web-tests-v1','pnpm','--dir',str(ROOT/'apps/merchant/web'),'test']),
 ('web-types',[sys.executable,str(E/'qualify.py'),'run',name,'web-viewport-v1-web-types-v1','pnpm','--dir',str(ROOT/'apps/merchant/web'),'typecheck']),
 ('governance',[sys.executable,str(E/'web_viewport_v1_governance_capsule.py')]),
 ('mobile-artifact-readback',[sys.executable,str(E/'read_web_viewport_mobile_artifacts.py')]),
]
state={'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'supervisor_pid':os.getpid(),
       'source_sha256':source['sha256'],'status':'RUNNING','steps':[],
       'mobile_reuse':'web-viewport-v1-preservation-mobile-reuse.json;1580PASS/analysis/builds;onlywebCSSchanged',
       'web_production_build':'Pending exact native56 actual owned Next production runtime and browser story.'}
assert not (E/'web-viewport-v1-qualification.terminal.json').exists()
for step,command in steps:
 state['active_step']=step;write(E/'web-viewport-v1-qualification.active.json',state)
 with(E/('web-viewport-v1-step-'+step+'.log')).open('x')as log:
  result=subprocess.run(command,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
 state['steps'].append({'step':step,'exit_code':result.returncode})
 if result.returncode:
  state['status']='STOPPED_AT_FAILED_STEP';write(E/'web-viewport-v1-qualification.terminal.json',state);print(json.dumps(state));raise SystemExit(result.returncode)
state.update(status='TERMINAL_SCOPED_GATES_PASS_RUNTIME_WEB_BUILD_PENDING',active_step=None,
             finished_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),source_unchanged=snapshot()['files']==source['files'])
write(E/'web-viewport-v1-qualification.terminal.json',state);write(E/'web-viewport-v1-qualification.active.json',state)
print(json.dumps(state));raise SystemExit(0 if state['source_unchanged'] else 99)
