from pathlib import Path
import subprocess,sys,json,datetime,os
from qualify import ROOT,E,snapshot,write
source=json.loads((E/'supporting-source-v2.source.json').read_text())
if snapshot()['files']!=source['files']: raise RuntimeError('Source changed')
full=json.loads((E/'supporting-full-flutter-v2.terminal.json').read_text())
text=(E/'supporting-full-flutter-v2.log').read_text()
assert full['status']=='TERMINAL' and full['exit_code']==1 and full['source_unchanged']
assert '+1466 -1: Some tests failed.' in text
assert text.strip().split('Failing tests:')[-1].strip().endswith('positive hosted invitation remains in its existing namespace; local restore cannot adopt it')
steps=[
 ('ui-kit-analysis',[sys.executable,str(E/'qualify.py'),'run','supporting-source-v2','uikit-supporting-analysis-v1','/Users/saai_mithra/Library/Developer/flutter/bin/flutter','analyze','--no-pub']),
 ('governance',[sys.executable,str(E/'supporting_governance_capsule.py')]),
 ('android-compile',[sys.executable,str(E/'build_supporting_artifact.py'),'android']),
 ('ios-compile',[sys.executable,str(E/'build_supporting_artifact.py'),'ios']),
]
analysis=json.loads((E/'supporting-app-analysis-v2.terminal.json').read_text())
assert analysis['exit_code']==0 and analysis['source_unchanged'] and analysis['source_sha256']==source['sha256']

state={'supervisor_pid':os.getpid(),'source_sha256':source['sha256'],'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'full_flutter':{'pass':1466,'fail':1,'skip':0,'known_protected_staff_failure_only':True},'steps':[],'status':'RUNNING'}
for name,command in steps:
    state['active_step']=name;write(E/'supporting-qualification.active.json',state)
    with (E/('supporting-step-'+name+'.log')).open('w') as log:
        result=subprocess.run(command,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
    state['steps'].append({'step':name,'exit_code':result.returncode})
    if result.returncode:
        state['status']='STOPPED_AT_FAILED_STEP';write(E/'supporting-qualification.terminal.json',state)
        print(json.dumps(state));sys.exit(result.returncode)
state['status']='TERMINAL_ALL_ORDERED_LOCAL_GATES_PASSED_WITH_KNOWN_FULL_SUITE_FAILURE'
state['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
state['source_unchanged']=snapshot()['files']==source['files']
write(E/'supporting-qualification.terminal.json',state);print(json.dumps(state));sys.exit(0 if state['source_unchanged'] else 99)
