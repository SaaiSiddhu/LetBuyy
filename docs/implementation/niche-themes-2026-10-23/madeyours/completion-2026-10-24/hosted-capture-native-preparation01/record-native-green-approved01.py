"""Record the already completed GREEN cohort; no test/database/process actions."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import re

own = Path(__file__).resolve().parent
repo = Path('/Volumes/Projects/LetBuyy')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
read = lambda name: json.loads((own / name).read_text())
result = read('native-green-approved01-result.json')
parent = read('native-green-approved01-parent-result.json')
receipt = read('native-green-approved01-run-receipt.json')
suite = result['results'][0]
assert result['runId'] == receipt['runId'] == parent['runReceipt']['runId'] == '0c9598fabf75'
assert parent['pid'] == receipt['runnerPid'] == 41906
log = next((own / 'native-green-approved01-logs').glob('*.log'))
lines = log.read_text().splitlines()
events, tests = [], []
for i, line in enumerate(lines):
    if line.startswith('# {'):
        try:
            event = json.loads(line[2:])
        except json.JSONDecodeError:
            continue
        if event.get('event', '').startswith('hosted_capture_causal_'):
            events.append({'line': i + 1, **event})
    match = re.match(r'^(\s*)(ok|not ok) (\d+) - (.*)$', line)
    if match:
        tests.append({'line': i + 1, 'depth': len(match[1]) // 4,
                      'tapNumber': int(match[3]), 'name': match[4],
                      'verdict': 'PASS' if match[2] == 'ok' else 'FAIL'})
observations = [e for e in events if e['event'] == 'hosted_capture_causal_observation02']
markers = [e for e in events if e['event'] == 'hosted_capture_causal_preconditions_pass02']
witnesses = []
for observation, marker in zip(observations, markers):
    c = observation['causal']
    order = c['order']
    capture, = c['capture']
    entries = c['entries']
    checks = {
        'sameOrderingAndBuyer': observation['ordering'] == marker['ordering'] and observation['authenticated'] == marker['authenticated'],
        'markerAfterRawObservation': marker['line'] > observation['line'],
        'paidOwnedOrder': order['payment_status'] == 'paid' and order['site_id'] == capture['site_id'],
        'currency': order['currency'] == capture['currency'] == 'INR',
        'exactCurrentAmount': order['total_minor'] == observation['expectedAmountMinor'] == '21100',
        'canonicalProviderCapture': capture['source_type'] == 'payment_capture' and capture['source_id'] == 'razorpay:' + order['payment_id'] and capture['writer_module'] == 'settlement',
        'originalCaptureIdAndKey': capture['id'] == marker['canonicalCaptureId'] and capture['idempotency_key'] == marker['originalCaptureKey'],
        'exactTwoSides': len(entries) == 2 and sorted(e['side'] for e in entries) == ['credit','debit'],
        'entriesOwnedExactAndBalanced': all(e['transaction_id'] == capture['id'] and e['site_id'] == order['site_id'] and e['currency'] == 'INR' and e['amount_minor'] == '21100' for e in entries) and marker['debitMinor'] == marker['creditMinor'] == '21100',
        'hostedCompletedSameOrder': c['hosted']['order_id'] == order['id'] and c['hosted']['checkout_state'] == 'completed',
        'truthfulTrueFlag': c['hosted']['flag'] is True and marker['metadataFlag'] is True,
    }
    if observation['ordering'] == 'webhook first':
        checks['preservedOriginalWebhookKey'] = capture['idempotency_key'] == 'native-webhook-first:' + order['payment_id']
    witnesses.append({'ordering': observation['ordering'], 'authenticated': observation['authenticated'],
                      'observationLine': observation['line'], 'markerLine': marker['line'],
                      'captureId': capture['id'], 'originalCaptureKey': capture['idempotency_key'],
                      'captureOwnerObserved': 'browser' if capture['idempotency_key'].startswith('checkout.confirm.capture:') else 'webhook',
                      'metadataFlag': marker['metadataFlag'], 'amountMinor':'21100', 'entryCount':2, 'checks':checks})

closure = read('SQL_BOOTSTRAP_CLOSURE.json')
expected_migrations = [(Path(m['path']).name, int(Path(m['path']).name.split('_')[0]), m['sha256']) for m in closure['migrations']]
actual_migrations = [(m['name'], m['prefix'], m['sha256']) for m in suite['migrations']['applied']]
sources = []
for name in ['red-materialization.json','green-materialization.json']:
    manifest = read(name)
    root = Path(manifest['root'])
    sources.append({'manifest':name,'manifestSha256':sha(own/name),'root':str(root),
                    'filesChecked':len(manifest['files']),'linksChecked':len(manifest['links']),
                    'changedFiles':[f['path'] for f in manifest['files'] if sha(root/f['path']) != f['sha256']],
                    'changedLinks':[f['path'] for f in manifest['links'] if os.readlink(root/f['path']) != f['target'] or str((root/f['path']).resolve()) != f['resolved']],
                    'checkoutSha256':sha(root/'services/api-gateway/src/routes/checkout.ts'),
                    'witnessSha256':sha(root/'services/api-gateway/src/__tests__/owned-db/hosted-checkout-buyer-ownership.postgres.test.ts'),
                    'wrapperSha256':sha(root/'services/api-gateway/src/__tests__/owned-db/hosted-checkout-capture-proof-qualification.manual.ts')})
red_pins = read('NATIVE_RED_POSTRUN_PINS01.json')
frozen_source = [{'path':f['path'],'expectedSha256':f['expectedSha256'],'actualSha256':sha(Path(f['path'])),
                  'exact':sha(Path(f['path'])) == f['expectedSha256']} for f in red_pins['frozenSource']]
asset_stability = [{'path':f['path'],'redObservedSha256':f['actualSha256'],
                    'greenObservedSha256':sha(Path(f['path'])),
                    'unchangedSinceRed':sha(Path(f['path'])) == f['actualSha256'],
                    'matchesAcceptedManifest':sha(Path(f['path'])) == f['expectedSha256']} for f in red_pins['frozenArtifacts']]
qualification = {
    'nativeTerminal0':parent['nativeExitCode'] == suite['code'] == 0,
    'actual25Pass':result['tests'] == result['assertionsPassed'] == len(tests) == 25 and all(t['verdict']=='PASS' for t in tests),
    'noFailSkipCancelTodo':all(result[k] == 0 for k in ['assertionsFailed','skipped','cancelled','todo']),
    'notTimedOutOrOverBudget':not suite['timedOut'] and not parent['overBudget'] and parent['terminationReason'] is None,
    'wholeParentWithin600':parent['elapsedSecondsIncludingProvisionAndCleanup'] < 600,
    'completeOutputReader':parent['readerComplete'] and not parent['readerErrors'],
    'allSixActualTruthfulBalancedWitnesses':len(observations)==len(markers)==len(witnesses)==6 and all(all(w['checks'].values()) for w in witnesses),
    'allOrderingAndBuyerCombinations':{(w['ordering'],w['authenticated']) for w in witnesses} == {(o,a) for o in ['browser first','webhook first','concurrent browser/webhook'] for a in [False,True]},
    'full322ExactOrderedMigrationNamePrefixSha':actual_migrations==expected_migrations and len(actual_migrations)==322,
    'max393NoCeiling':max(m['prefix'] for m in suite['migrations']['applied'])==393 and suite['migrations']['throughMigration'] is None,
    'cleanOwnedResources':result['cleanup']=={'failures':[],'remaining':{'containers':[],'networks':[],'volumes':[]}},
    'suiteRestAndDbClean':suite['cleanup']=={'rest':True,'database':True},
    'noReapOrStrayStop':not result['reaped'] and not suite['strayProcessesStopped'],
    'immutablePairSourceAndLinks':all(not s['changedFiles'] and not s['changedLinks'] for s in sources),
    'correctGreenRoute':sources[1]['checkoutSha256']=='bed680202cc7ff86ee1a43ddfbeb327ae6732ade104b7d3b57b703bade50fa08',
    'sameAcceptedWitnessAndWrapper':all(s['witnessSha256']=='4a7d1a5dfc21b3cd326a0fcb7a82fd778c20b313e383d8282a97f77077a8cf76' and s['wrapperSha256']=='d5660a3d777799c6e74c06f659265196930f01639b0cb1e25a4ce566b84d1fcc' for s in sources),
    'allFourFrozenSourcePinsExact':all(f['exact'] for f in frozen_source),
    'all103ArtifactBytesUnchangedSinceRed':len(asset_stability)==103 and all(f['unchangedSinceRed'] for f in asset_stability),
}
recorded = datetime.datetime.now(datetime.timezone.utc).isoformat()
files = ['native-green-approved01-result.json','native-green-approved01-run-receipt.json',
         'native-green-approved01-parent-start.json','native-green-approved01-parent-result.json',
         'native-green-approved01-parent.log','native-green-approved01-image-bindings.json',
         'native-green-approved01-supervisor.py','red-materialization.json','green-materialization.json',
         'SQL_BOOTSTRAP_CLOSURE.json','NATIVE_RED_REVIEW_HANDOFF01.json','FROZEN_ARTIFACT_DIVERGENCE_OBSERVATION01.json']
evidence = [{'path':str(own/n),'sha256':sha(own/n),'bytes':(own/n).stat().st_size} for n in files]
evidence.append({'path':str(log),'sha256':sha(log),'bytes':log.stat().st_size})
status = 'ACTUAL_GREEN_25_PASS_CLEANUP_COMPLETE_READY_FOR_INDEPENDENT_REVIEW' if all(qualification.values()) else 'GREEN_EVIDENCE_QUALIFICATION_FAILED_STOP_NO_RETRY'
report = {
    'recordedAt':recorded,'status':status,'ownerThreadId':'01a164ba-e017-7b90-9053-efc5357459a6',
    'runId':result['runId'],'nativeAttempts':1,'parent':parent,'qualification':qualification,
    'counts':{k:result[k] for k in ['tests','assertionsPassed','assertionsFailed','cancelled','skipped','todo']},
    'countInterpretation':'17 top-level + 6 ordering/auth children + 2 amount/currency children = 25 actual TAP tests; no total added across overlapping suites.',
    'allTapTests':tests,'rawCausalEvents':events,'causalWitnesses':witnesses,
    'actualConcurrencyOwners':[{'authenticated':w['authenticated'],'owner':w['captureOwnerObserved'],'originalKey':w['originalCaptureKey']} for w in witnesses if w['ordering']=='concurrent browser/webhook'],
    'conditionalCoverageLimit':'Both concurrent GREEN cases were won by the browser capture. The conditional concurrent+webhook-owner+authenticated retry branch at witness source lines487-498 was not entered in this single GREEN run. Separate guest/bound webhook-first cases did exercise preserved webhook capture keys and passed; no extra schedule or rerun is claimed.',
    'reachedOrderingAssertions':[
        {'lines':'483-499','proof':'Truthful metadata, expected original-owner notification submission/acceptance counts and recovery; concurrency-only webhook-owner branch conditional as recorded.'},
        {'lines':'500-506','proof':'One actual canonical ledger GET scoped by site/source type/provider payment/deleted_at and without attempt idempotency_key filter.'},
        {'lines':'507-515','proof':'Same-intent replay returns same order, createCalls=1 and no added notification submission; all fake jobs use the one stable site/order key.'},
        {'lines':'516-532','proof':'One captured payment and canonical ledger transaction; exactly two balanced current-amount entries; completed/converted state and true flag; original capture row/key byte-exact after lost acknowledgement and replay.'},
        {'lines':'534-539','proof':'One primary order, inventory row unchanged after intent, one order.paid key and one checkout.completed event, correct guest/bound ownership.'},
        {'lines':'593-607','proof':'Amount/currency fault children pass 409/replay/no captured ledger/payment/paid event/completed state, unchanged inventory and one refund obligation.'}
    ],
    'assertionEvidenceLimit':'Line mapping refers to the exact accepted witness SHA and six completed PASS children in the retained real Worker/PostgREST/PG TAP log. It is not a second set of executed tests or raw external-provider delivery proof.',
    'migrations':{'count':len(actual_migrations),'maxPrefix':393,'ceiling':None,'exactAppliedOrder':suite['migrations']['applied'],'fourQualifiedUps':closure['fourQualifiedUpsInOrder'],
                  'fourUpExecutionEvidence':'Unchanged accepted hash-checking wrapper applies exactly these four synchronously before requiring the suite; actual suite execution demonstrates the guarded block returned. No per-UP DB receipt was emitted.'},
    'cleanup':result['cleanup'],'suiteCleanup':suite['cleanup'],'proxyRequests':suite['proxyRequests'],
    'proxyCounterLimit':'Canonical upstreamErrors=1 is retained without independently assigning it to a specific intentional fault.',
    'sourcePostRunPins':sources,'frozenSourcePins':frozen_source,'frozenArtifactStability':asset_stability,
    'frozenArtifactFinding':{'matchedAcceptedManifest':sum(f['matchesAcceptedManifest'] for f in asset_stability),'mismatchedAcceptedManifest':sum(not f['matchesAcceptedManifest'] for f in asset_stability),'earlierFinding':'FROZEN_ARTIFACT_DIVERGENCE_OBSERVATION01.json','noRepairOrReseal':True},
    'preservation':{'mainSourceWritten':False,'sealedSourceWritten':False,'originalRuntimeActions':False,'originalKeysOrBackupReads':False,'realProviderCalls':False,'externalEmailDelivery':False,'browserActions':False,'apparelStarted':False,'automaticRetry':False},
    'scopeLimit':'Private immutable GREEN source and fresh owned DB only. Provider and notification seams are local fakes; separate notification transport proposal02 is not integrated by this run. No Main/runtime integration, actual Razorpay Test Mode, browser HTTPS or full visual/theme certificate is established.',
    'original23MadeYoursCases':{'executedByThisNativeRun':0,'lastEditorStatus':'MY00-MY22 remain open pending qualified fixture, trusted HTTPS and position7 browser slot.'},
    'next':'Stop and hand actual GREEN evidence to Root for independent Themes review. No apparel/extra cohort/source edit/runtime recovery under this grant.',
    'evidence':evidence,
}
outputs = {
    'NATIVE_GREEN_ACTUAL_REPORT01.json':report,
    'NATIVE_GREEN_CAUSAL_WITNESSES01.json':{'recordedAt':recorded,'runId':result['runId'],'events':events,'witnesses':witnesses},
    'NATIVE_GREEN_POSTRUN_PINS01.json':{'recordedAt':recorded,'sources':sources,'frozenSource':frozen_source,'frozenArtifacts':asset_stability},
}
for name,value in outputs.items():
    f=own/name;assert not f.exists();f.write_text(json.dumps(value,indent=2)+'\n')
markdown = f'''GREEN run `{result['runId']}` finished with exit {suite['code']}: 25 actual tests passed, zero failed/skipped/cancelled/TODO. Whole-parent duration including provisioning and cleanup was {parent['elapsedSecondsIncludingProvisionAndCleanup']:.3f} seconds. Evidence qualification: {status}.

All six guest/bound × browser-first/webhook-first/concurrent cases emitted a truthful true capture flag with one owned canonical capture and exactly two balanced INR 21,100-minor-unit entries. Replay, original capture identity/key, one order/stock effect, one paid/completed event and the scoped capture query assertions passed. The queue checks use local fake submissions/acceptance and do not prove email delivery. Both concurrent schedules were won by browser capture; the conditional concurrent authenticated webhook-owner retry branch was not entered. No extra schedule was run.

The exact 322 migration name/prefix/hash order through prefix393 and four admitted unnumbered UPs were used. Cleanup has no failures or remaining labelled containers/networks/volumes. RED/GREEN source/link pins remain exact. All four frozen source pins match, and all 103 artifact bytes are unchanged since RED; the previously observed eight accepted-manifest mismatches remain recorded without repair or resealing.

This is private native qualification, not Main/runtime integration or actual Razorpay/browser acceptance. Original MY00–MY22 remain open under Editor's fixture/HTTPS/position7 fence. Apparel was not started. The next action is independent allocator review.

[Full report]({own}/NATIVE_GREEN_ACTUAL_REPORT01.json) · [actual runner result]({own}/native-green-approved01-result.json) · [full native TAP log]({log})
'''
md=own/'NATIVE_GREEN_ACTUAL_REPORT01.md';assert not md.exists();md.write_text(markdown)
index={'recordedAt':recorded,'status':status,'runId':result['runId'],'refs':[{'path':str(own/n),'sha256':sha(own/n)} for n in [*outputs,'NATIVE_GREEN_ACTUAL_REPORT01.md']]}
f=own/'NATIVE_GREEN_EVIDENCE_INDEX01.json';assert not f.exists();f.write_text(json.dumps(index,indent=2)+'\n')
handoff={'recordedAt':recorded,'status':status,'runId':result['runId'],'runnerPid':41906,'nativeExitCode':suite['code'],'tests':25,'pass':result['assertionsPassed'],'fail':result['assertionsFailed'],'skip':result['skipped'],'cancel':result['cancelled'],'todo':result['todo'],'wholeParentSeconds':parent['elapsedSecondsIncludingProvisionAndCleanup'],'allSixActualWitnessesTrue':qualification['allSixActualTruthfulBalancedWitnesses'],'full322OrderedMigrationPins':qualification['full322ExactOrderedMigrationNamePrefixSha'],'cleanup':result['cleanup'],'qualificationFailures':[k for k,v in qualification.items() if not v],'evidenceIndex':{'path':str(f),'sha256':sha(f)},'redHandoff':{'path':str(own/'NATIVE_RED_REVIEW_HANDOFF01.json'),'sha256':sha(own/'NATIVE_RED_REVIEW_HANDOFF01.json')},'frozenSourceExact':qualification['allFourFrozenSourcePinsExact'],'artifactManifestMismatchCount':8,'artifactBytesUnchangedSinceRed':qualification['all103ArtifactBytesUnchangedSinceRed'],'originalBrowserCasesClosed':0,'apparelStarted':False,'requiredNext':'Independent Themes review through authorized Root coordination; no further execution by this owner under the GREEN-only grant.'}
f=own/'NATIVE_GREEN_REVIEW_HANDOFF01.json';assert not f.exists();f.write_text(json.dumps(handoff,indent=2)+'\n')
print(json.dumps({'status':status,'runId':result['runId'],'handoff':str(f),'sha256':sha(f),'qualificationFailures':handoff['qualificationFailures'],'frozenAssetsUnchangedSinceRed':qualification['all103ArtifactBytesUnchangedSinceRed']}))
