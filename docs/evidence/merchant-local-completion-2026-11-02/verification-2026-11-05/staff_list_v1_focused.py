from pathlib import Path
import subprocess,os,json,datetime
from qualify import ROOT,E,snapshot,write
source=json.loads((E/'staff-list-source-v1.source.json').read_text());assert snapshot()['files']==source['files']
label='staff-list-v1-focused';assert not (E/(label+'.terminal.json')).exists()
steps=[
 ('shared-types',['pnpm','--filter','@letbuyy/shared-types','typecheck'],ROOT),
 ('gateway-types',['pnpm','--filter','@letbuyy/api-gateway','typecheck'],ROOT),
 ('ts-sdk-types',['pnpm','--filter','@letbuyy/api-client','typecheck'],ROOT),
 ('ts-sdk-contract',['node_modules/.bin/tsx','--test','tests/contracts/merchant-staff-list-api-client.test.ts'],ROOT),
 ('dart-sdk-contract',['/Users/saai_mithra/Library/Developer/flutter/bin/dart','test','test/staff_list_test.dart'],ROOT/'packages/dart/api_client'),
 ('mobile-staff',['/Users/saai_mithra/Library/Developer/flutter/bin/flutter','test','--no-pub','test/staff_scope_boundary_test.dart','test/staff_environment_isolation_test.dart','test/mobile_services_test.dart'],ROOT/'apps/merchant/mobile'),
 ('owned-db',['node','scripts/governance/run-executable-suites.mjs','--jobs','1','--no-reap','--kind','gateway-db','--prepared-transactions','2','--timeout','300',
 '--suite','services/api-gateway/src/__tests__/owned-db/merchant-staff-list.postgres.test.ts',
 '--suite','services/api-gateway/src/__tests__/owned-db/merchant-staff-lifecycle.postgres.test.ts',
 '--suite','services/api-gateway/src/__tests__/owned-db/merchant-staff-invitation.postgres.test.ts',
 '--suite','tests/owned-db/merchant-staff-invitation-delivery.postgres.test.ts',
 '--log-dir',str(E/(label+'-db-logs')),'--json-out',str(E/(label+'-db.json'))],ROOT),
]
state={'supervisor_pid':os.getpid(),'source_sha256':source['sha256'],'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'RUNNING','steps':[]}
for name,command,cwd in steps:
 assert snapshot()['files']==source['files']
 state['active_step']=name;write(E/(label+'.active.json'),state)
 with (E/(label+'-'+name+'.log')).open('x') as log:
  child=subprocess.Popen(command,cwd=cwd,stdout=log,stderr=subprocess.STDOUT)
  state['child_pid']=child.pid;write(E/(label+'.active.json'),state);code=child.wait()
 state['steps'].append({'step':name,'exit_code':code});state['source_unchanged']=snapshot()['files']==source['files']
 if code or not state['source_unchanged']:
  state['status']='STOPPED_AT_FAILED_STEP';write(E/(label+'.terminal.json'),state);print(json.dumps(state));raise SystemExit(code or 99)
state.update(status='SCOPED_TYPES_SDK_MOBILE_OWNED_DB_PASS',active_step=None,finished_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
write(E/(label+'.terminal.json'),state);write(E/(label+'.active.json'),state);print(json.dumps(state))
