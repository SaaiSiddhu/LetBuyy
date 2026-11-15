import datetime,json,os,subprocess,sys
from pathlib import Path
from qualify import ROOT,E,snapshot,write
name='merchant-recovery-source-v7';label='merchant-recovery-v7';source=json.loads((E/(name+'.source.json')).read_text());assert snapshot()['files']==source['files'];assert not(E/(label+'-qualification.terminal.json')).exists()
private=Path(json.loads((E/(label+'-private-root.json')).read_text())['root']);sdk='/Users/saai_mithra/Library/Developer/flutter/bin/flutter';dart='/Users/saai_mithra/Library/Developer/flutter/bin/dart'
steps=[
 ('root-contracts',['node_modules/.bin/tsx','--test']+list(map(str,sorted((ROOT/'tests/contracts').glob('*.test.ts')))),ROOT),
 ('dart-sdk',[dart,'test','test/staff_list_test.dart','test/api_client_test.dart','test/security_api_test.dart'],ROOT/'packages/dart/api_client'),
 ('app-analysis',[sdk,'analyze','--no-pub'],ROOT/'apps/merchant/mobile'),
 ('full-flutter',[sdk,'test','--no-pub'],ROOT/'apps/merchant/mobile'),
 ('web-types',['pnpm','--dir',str(ROOT/'apps/merchant/web'),'typecheck'],ROOT),
 ('web-tests',['pnpm','--dir',str(ROOT/'apps/merchant/web'),'test'],ROOT),
 ('owned-db',['node','scripts/governance/run-executable-suites.mjs','--jobs','1','--no-reap','--kind','gateway-db','--prepared-transactions','2','--timeout','300',
 '--suite','services/api-gateway/src/__tests__/owned-db/merchant-staff-list.postgres.test.ts',
 '--suite','services/api-gateway/src/__tests__/owned-db/merchant-staff-lifecycle.postgres.test.ts',
 '--suite','services/api-gateway/src/__tests__/owned-db/merchant-staff-invitation.postgres.test.ts',
 '--suite','tests/owned-db/merchant-staff-invitation-delivery.postgres.test.ts',
 '--log-dir',str(private/'db-logs'),'--json-out',str(E/(label+'-db.json'))],ROOT),
 ('governance',[sys.executable,str(E/'merchant_recovery_v7_governance_capsule.py')],ROOT),
 ('android-compile',[sys.executable,str(E/'build_merchant_recovery_v7_artifact.py'),'android'],ROOT),
 ('ios-compile',[sys.executable,str(E/'build_merchant_recovery_v7_artifact.py'),'ios'],ROOT),
 ('artifact-readback',[sys.executable,str(E/'read_merchant_recovery_v7_artifacts.py')],ROOT),
 ('invitation-browser',['node','scripts/governance/run-executable-suites.mjs','--jobs','1','--no-reap','--kind','gateway-db','--timeout','900',
 '--suite','services/api-gateway/src/__tests__/owned-db/merchant-staff-invitation-browser.postgres.test.ts',
 '--log-dir',str(private/'invitation-browser-logs'),'--json-out',str(E/(label+'-invitation-browser.json'))],ROOT),
]
state={'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'supervisor_pid':os.getpid(),'source_sha256':source['sha256'],'status':'RUNNING','steps':[],'private_root':str(private),'prior_scoped_passes':'merchant-recovery-v7-reused-scopes.json'}
awake=subprocess.Popen(['/usr/bin/caffeinate','-i','-w',str(os.getpid())])
try:
 for step,command,cwd in steps:
  assert snapshot()['files']==source['files'];state['active_step']=step
  with(E/(label+'-step-'+step+'.log')).open('x')as log:
   child=subprocess.Popen(command,cwd=cwd,stdout=log,stderr=subprocess.STDOUT);state['child_pid']=child.pid;write(E/(label+'-qualification.active.json'),state);code=child.wait()
  state['steps'].append({'step':step,'exit_code':code});state['source_unchanged']=snapshot()['files']==source['files']
  if code or not state['source_unchanged']:
   state['status']='STOPPED_AT_FAILED_STEP';write(E/(label+'-qualification.terminal.json'),state);print(json.dumps(state));raise SystemExit(code or 99)
 state.update(status='CURRENT_ORDERED_SOURCE_AND_INVITATION_BROWSER_PASS',active_step=None,finished_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
 write(E/(label+'-qualification.terminal.json'),state);write(E/(label+'-qualification.active.json'),state);print(json.dumps(state))
finally:
 if awake.poll()is None:awake.terminate();awake.wait(timeout=5)
 write(E/(label+'-awake-closure.json'),{'pid':awake.pid,'exit':awake.returncode,'scope':'Only prevent idle sleep while the exact qualifier is alive; no persistent power setting.'})
