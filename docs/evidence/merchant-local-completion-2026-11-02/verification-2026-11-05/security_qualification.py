from pathlib import Path
import subprocess,sys,json,datetime,os
from qualify import ROOT,E,snapshot,write
source=json.loads((E/'security-source-v1.source.json').read_text())
if snapshot()['files']!=source['files']: raise RuntimeError('Source changed')
full=json.loads((E/'security-full-flutter-v1.terminal.json').read_text())
text=(E/'security-full-flutter-v1.log').read_text()
assert full['status']=='TERMINAL' and full['exit_code']==1 and full['source_unchanged']
assert '+1433 -1: Some tests failed.' in text
assert text.strip().split('Failing tests:')[-1].strip().endswith('positive hosted invitation remains in its existing namespace; local restore cannot adopt it')
steps=[
 ('app-analysis',[sys.executable,str(E/'qualify.py'),'run','security-source-v1','security-app-analysis-v1','/Users/saai_mithra/Library/Developer/flutter/bin/flutter','analyze','--no-pub']),
 ('ui-kit-analysis',[sys.executable,str(E/'qualify.py'),'run','security-source-v1','uikit-security-analysis-v1','/Users/saai_mithra/Library/Developer/flutter/bin/flutter','analyze','--no-pub']),
 ('governance',[sys.executable,str(E/'security_governance_capsule.py')]),
 ('android-compile',[sys.executable,str(E/'build_security_artifact.py'),'android']),
 ('ios-compile',[sys.executable,str(E/'build_security_artifact.py'),'ios']),
]
state={'supervisor_pid':os.getpid(),'source_sha256':source['sha256'],'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'full_flutter':{'pass':1433,'fail':1,'skip':0,'known_protected_staff_failure_only':True},'steps':[],'status':'RUNNING'}
for name,command in steps:
    state['active_step']=name;write(E/'security-qualification.active.json',state)
    with (E/('security-step-'+name+'.log')).open('w') as log:
        result=subprocess.run(command,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
    state['steps'].append({'step':name,'exit_code':result.returncode})
    if result.returncode:
        state['status']='STOPPED_AT_FAILED_STEP';write(E/'security-qualification.terminal.json',state)
        print(json.dumps(state));sys.exit(result.returncode)
state['status']='TERMINAL_ALL_ORDERED_LOCAL_GATES_PASSED_WITH_KNOWN_FULL_SUITE_FAILURE'
state['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
state['source_unchanged']=snapshot()['files']==source['files']
write(E/'security-qualification.terminal.json',state);print(json.dumps(state));sys.exit(0 if state['source_unchanged'] else 99)
