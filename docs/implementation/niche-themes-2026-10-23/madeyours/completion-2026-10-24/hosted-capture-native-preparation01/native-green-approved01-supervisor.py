"""Execution-only whole-parent budget supervision. Canonical child argv unchanged.
One exact new harness PID; ordinary SIGTERM cleanup only. No other native start.
"""
from pathlib import Path
import json,hashlib,subprocess,os,time,datetime,signal,threading,sys
own=Path(__file__).parent
activation=Path('/Volumes/Projects/LetBuyy/docs/implementation/niche-theme-programme/completion-2026-10-24/themes-shared-review-20261025-01/HOSTED_CAPTURE_NATIVE_GREEN_ACTIVATION_01.json')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(activation)=='d4c025461286e9f4226445eefc5e2001ca72da57ebdf48d573de8455395a03f9'
a=json.loads(activation.read_text());assert a['status']=='GRANTED_EXACT_SINGLE_FRESH_OWNED_CAPTURE_GREEN_COHORT'
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat(a['expiresAt'])
assert a['maxAttempts']==1 and a['timeoutSecondsWholeParent']==600 and a['greenExecutionGranted'] and not a['apparelExecutionGranted']
assert sha(Path(a['humanApproval']['path']))==a['humanApproval']['sha256']
review=activation.parent/a['acceptedNativeRedReview']['path'];assert sha(review)==a['acceptedNativeRedReview']['sha256']
accepted=json.loads(review.read_text());assert accepted['status']=='ACCEPT_ACTUAL_EXPECTED_RED_CAUSAL_PROOF_AND_COMPLETE_OWNER_CLEANUP_HANDBACK'
assert accepted['runId']=='487161ab7e7c' and accepted['cleanup']=={'failures':[],'remaining':{'containers':[],'networks':[],'volumes':[]}}
assert sha(Path('/Volumes/Projects/LetBuyy')/a['acceptedSoleOwnerHandoff']['path'])==a['acceptedSoleOwnerHandoff']['sha256']

manifest=Path(a['sourceManifest']['path']);assert sha(manifest)==a['sourceManifest']['sha256'];m=json.loads(manifest.read_text());root=Path(a['cwd']);assert sha(root/'services/api-gateway/src/routes/checkout.ts')=='bed680202cc7ff86ee1a43ddfbeb327ae6732ade104b7d3b57b703bade50fa08'
for f in m['files']:assert sha(root/f['path'])==f['sha256'],f['path']
for f in m['links']:assert os.readlink(root/f['path'])==f['target'] and str((root/f['path']).resolve())==f['resolved'],f['path']
assert sha(root/'services/api-gateway/src/__tests__/owned-db/hosted-checkout-buyer-ownership.postgres.test.ts')==a['acceptedWitnessTestSha256']
assert sha(root/'services/api-gateway/src/__tests__/owned-db/hosted-checkout-capture-proof-qualification.manual.ts')==a['acceptedWrapperSha256']
for value in a['outputs'].values():assert not Path(value).exists(),value
startPath=own/'native-green-approved01-parent-start.json';resultPath=own/'native-green-approved01-parent-result.json';logPath=own/'native-green-approved01-parent.log'
assert all(not f.exists()for f in [startPath,resultPath,logPath])
images=json.loads((own/'native-green-approved01-image-bindings.json').read_text());assert images['inspection']['exit_code']==0
# Canonical existing image bindings make the exact installed IDs the defaults;
# no source or CLI argument changes and no tag-based implicit pull.
childEnv=os.environ.copy();childEnv['LETBUYY_EXECUTABLE_PG_IMAGE']=images['postgres']['id'];childEnv['LETBUYY_EXECUTABLE_REST_IMAGE']=images['postgrest']['id'];childEnv['LETBUYY_EXECUTABLE_PULL']='never';childEnv.pop('CI',None)
argv=[a['command']['executable'],*a['command']['arguments']]
assert argv.count('--suite')==1 and '--no-reap'in argv and '--through-migration'not in argv
assert argv[argv.index('--timeout')+1]=='600' and argv[argv.index('--jobs')+1]=='1' and argv[argv.index('--prepared-transactions')+1]=='2'
started=time.monotonic();startedUtc=datetime.datetime.now(datetime.timezone.utc);deadline=started+600
start={'activationSha256':sha(activation),'argv':argv,'cwd':str(root),'startMonotonic':started,'deadlineMonotonic':deadline,'startUTC':startedUtc.isoformat(),'deadlineUTC':(startedUtc+datetime.timedelta(seconds=600)).isoformat(),'imageBindings':{'postgres':images['postgres']['id'],'postgrest':images['postgrest']['id']},'pullAllowed':False,'nativeAttempts':1,'protectedOriginalPids':[54685,55109],'pid':None}
startPath.write_text(json.dumps(start,indent=2)+'\n')
p=subprocess.Popen(argv,cwd=root,env=childEnv,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
assert p.pid not in [54685,55109];start['pid']=p.pid;startPath.write_text(json.dumps(start,indent=2)+'\n');print(json.dumps({'event':'owned_green_parent_started','pid':p.pid,'deadlineUTC':start['deadlineUTC']}),flush=True)
log=logPath.open('x');readerErrors=[]
def drain():
 try:
  for line in p.stdout:log.write(line);log.flush();sys.stdout.write(line);sys.stdout.flush()
 except Exception as error:readerErrors.append(type(error).__name__)
reader=threading.Thread(target=drain,daemon=True);reader.start()
receiptPath=Path(a['outputs']['--run-receipt']);observedReceipt=None;terminationReason=None;terminationSent=None
while p.poll()is None:
 if observedReceipt is None and receiptPath.exists():
  observedReceipt=json.loads(receiptPath.read_text())
  if observedReceipt.get('runnerPid')!=p.pid:
   terminationReason='unexpected_owned_runner_pid_mismatch';terminationSent=time.monotonic();p.send_signal(signal.SIGTERM)
  else:print(json.dumps({'event':'owned_green_run_receipt','runId':observedReceipt.get('runId'),'runnerPid':p.pid,'containerBase':observedReceipt.get('containerBase')}),flush=True)
 if terminationSent is None and time.monotonic()>=deadline:
  terminationReason='whole_parent_600s_deadline';terminationSent=time.monotonic();p.send_signal(signal.SIGTERM)
  print(json.dumps({'event':'owned_green_budget_sigterm','exactOwnedPid':p.pid,'elapsed':terminationSent-started}),flush=True)
 time.sleep(0.5)
code=p.wait();reader.join(timeout=5);elapsed=time.monotonic()-started;log.close()
result={'status':'WHOLE_PARENT_BUDGET_STOPPED'if terminationReason else'OWNED_GREEN_PARENT_TERMINAL','pid':p.pid,'nativeExitCode':code,'startMonotonic':started,'deadlineMonotonic':deadline,'elapsedSecondsIncludingProvisionAndCleanup':elapsed,'overBudget':elapsed>600,'terminationReason':terminationReason,'ordinarySigtermAtElapsed':terminationSent-started if terminationSent else None,'runReceipt':observedReceipt,'readerComplete':not reader.is_alive(),'readerErrors':readerErrors,'canonicalResultPath':a['outputs']['--json-out'],'greenStarted':True,'apparelStarted':False,'oldRuntimeTouched':False}
resultPath.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'event':'owned_green_parent_terminal',**result}),flush=True)
sys.exit(124 if terminationReason or elapsed>600 else code)
