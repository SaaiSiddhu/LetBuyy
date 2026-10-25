"""Read existing RED artifacts only; never launches tests or database commands."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import re

own = Path(__file__).resolve().parent
repo = Path('/Volumes/Projects/LetBuyy')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
read = lambda n: json.loads((own / n).read_text())
result = read('native-red-approved01-result.json')
parent = read('native-red-approved01-parent-result.json')
receipt = read('native-red-approved01-run-receipt.json')
suite = result['results'][0]
log = next((own / 'native-red-approved01-logs').glob('*.log'))
lines = log.read_text().splitlines()
assert result['runId'] == receipt['runId'] == parent['runReceipt']['runId'] == '487161ab7e7c'
assert receipt['runnerPid'] == parent['pid'] == 38196

events = []
tests = []
failures = []
for i, line in enumerate(lines):
    if line.startswith('# {'):
        try:
            event = json.loads(line[2:])
        except json.JSONDecodeError:
            continue
        if event.get('event', '').startswith('hosted_capture_causal_'):
            events.append({'line': i + 1, **event})
    match = re.match(r'^(\s*)(not ok|ok) (\d+) - (.*)$', line)
    if not match:
        continue
    row = {'line': i + 1, 'depth': len(match[1]) // 4,
           'tapNumber': int(match[3]), 'name': match[4],
           'verdict': 'FAIL' if match[2] == 'not ok' else 'PASS'}
    tests.append(row)
    if row['verdict'] == 'FAIL':
        end = i + 1
        while end < len(lines) and lines[end].strip() != '...':
            end += 1
        block = '\n'.join(lines[i:min(end + 1, len(lines))])
        row['rawFailureBlock'] = block
        if 'matching canonical webhook/browser capture must be reported truthfully' in block:
            row['classification'] = 'CAUSAL_METADATA_FALSE_WITH_PRIOR_PASSED_CANONICAL_WITNESS'
        elif 'a browser attempt key cannot hide the original webhook capture' in block:
            row['classification'] = 'SEPARATE_QUERY_ASSERTION_NOT_CAUSAL_METADATA_RED'
        else:
            row['classification'] = 'PARENT_AGGREGATES_SIX_FAILED_CHILDREN'
        failures.append(row)

assert len(tests) == result['tests'] == 25
assert sum(t['verdict'] == 'PASS' for t in tests) == result['assertionsPassed'] == 18
assert len(failures) == result['assertionsFailed'] == 7
observations = [e for e in events if e['event'] == 'hosted_capture_causal_observation02']
preconditions = [e for e in events if e['event'] == 'hosted_capture_causal_preconditions_pass02']
assert len(observations) == len(preconditions) == 6
causal = []
for observation, marker in zip(observations, preconditions):
    c = observation['causal']
    order = c['order']
    capture, = c['capture']
    entries = c['entries']
    assert marker['ordering'] == observation['ordering']
    assert marker['authenticated'] == observation['authenticated']
    assert marker['line'] > observation['line']
    assert order['payment_status'] == 'paid'
    assert order['currency'] == capture['currency'] == 'INR'
    assert order['total_minor'] == observation['expectedAmountMinor'] == '21100'
    assert capture['site_id'] == order['site_id']
    assert capture['source_type'] == 'payment_capture'
    assert capture['source_id'] == 'razorpay:' + order['payment_id']
    assert capture['writer_module'] == 'settlement'
    assert capture['id'] == marker['canonicalCaptureId']
    assert capture['idempotency_key'] == marker['originalCaptureKey']
    assert len(entries) == 2 and sorted(e['side'] for e in entries) == ['credit', 'debit']
    for entry in entries:
        assert entry['transaction_id'] == capture['id']
        assert entry['site_id'] == order['site_id']
        assert entry['currency'] == 'INR' and entry['amount_minor'] == '21100'
    assert marker['debitMinor'] == marker['creditMinor'] == '21100'
    assert c['hosted']['order_id'] == order['id']
    assert c['hosted']['checkout_state'] == 'completed'
    assert c['hosted']['flag'] == marker['metadataFlag']
    if observation['ordering'] == 'webhook first':
        assert capture['idempotency_key'] == 'native-webhook-first:' + order['payment_id']
    causal.append({'ordering': observation['ordering'], 'authenticated': observation['authenticated'],
                   'observationLine': observation['line'], 'passedPreconditionLine': marker['line'],
                   'metadataFlag': marker['metadataFlag'], 'canonicalCaptureId': capture['id'],
                   'originalCaptureKey': capture['idempotency_key'], 'amountMinor': '21100',
                   'entryCount': 2, 'currency': 'INR'})
webhook = [c for c in causal if c['ordering'] == 'webhook first']
assert len(webhook) == 2 and all(c['metadataFlag'] is False for c in webhook)

closure = read('SQL_BOOTSTRAP_CLOSURE.json')
expected_migrations = [(Path(m['path']).name, m['sha256']) for m in closure['migrations']]
actual_migrations = [(m['name'], m['sha256']) for m in suite['migrations']['applied']]
assert actual_migrations == expected_migrations and len(actual_migrations) == 322
assert max(m['prefix'] for m in suite['migrations']['applied']) == 393

source = []
for name in ['red-materialization.json', 'green-materialization.json']:
    manifest = read(name)
    root = Path(manifest['root'])
    changed = [f['path'] for f in manifest['files'] if sha(root / f['path']) != f['sha256']]
    changed_links = [f['path'] for f in manifest['links']
                     if os.readlink(root / f['path']) != f['target']
                     or str((root / f['path']).resolve()) != f['resolved']]
    source.append({'manifest': name, 'manifestSha256': sha(own / name),
                   'root': str(root), 'filesChecked': len(manifest['files']),
                   'linksChecked': len(manifest['links']),
                   'changedFiles': changed, 'changedLinks': changed_links,
                   'checkoutSha256': sha(root / 'services/api-gateway/src/routes/checkout.ts'),
                   'witnessSha256': sha(root / 'services/api-gateway/src/__tests__/owned-db/hosted-checkout-buyer-ownership.postgres.test.ts'),
                   'wrapperSha256': sha(root / 'services/api-gateway/src/__tests__/owned-db/hosted-checkout-capture-proof-qualification.manual.ts')})
frozen_prior = json.loads((own.parent / 'RESUME02_SOURCE_AND_BROWSER_HANDOFF.json').read_text())['frozenPins']
frozen = [{'path': f['path'], 'expectedSha256': f['sha256'], 'actualSha256': sha(Path(f['path'])),
           'exact': sha(Path(f['path'])) == f['sha256']} for f in frozen_prior]
freeze_path = Path(frozen_prior[-1]['path'])
freeze = json.loads(freeze_path.read_text())
frozen_assets = [{'path': str(freeze_path.parent / path), 'expectedSha256': expected,
                  'actualSha256': sha(freeze_path.parent / path),
                  'exact': sha(freeze_path.parent / path) == expected}
                 for path, expected in freeze['files'].items()]

recorded = datetime.datetime.now(datetime.timezone.utc).isoformat()
evidence_names = ['native-red-approved01-result.json', 'native-red-approved01-run-receipt.json',
                  'native-red-approved01-parent-start.json', 'native-red-approved01-parent-result.json',
                  'native-red-approved01-parent.log', 'native-red-approved01-image-bindings.json',
                  'native-red-approved01-supervisor.py', 'red-materialization.json',
                  'green-materialization.json', 'SQL_BOOTSTRAP_CLOSURE.json',
                  'PREFLIGHT_TERMINAL_PAIR_APPROVED03.json']
evidence = [{'path': str(own / n), 'sha256': sha(own / n), 'bytes': (own / n).stat().st_size}
            for n in evidence_names]
evidence.append({'path': str(log), 'sha256': sha(log), 'bytes': log.stat().st_size})
report = {
    'recordedAt': recorded,
    'status': 'CAUSAL_RED_REPRODUCED_NATIVE_FAILED_STOPPED_FOR_INDEPENDENT_REVIEW',
    'ownerThreadId': '01a164ba-e017-7b90-9053-efc5357459a6',
    'runId': result['runId'], 'nativeAttempts': 1,
    'activation': 'themes-shared-review-20261025-01/HOSTED_CAPTURE_NATIVE_RED_ACTIVATION_01.json',
    'counts': {k: result[k] for k in ['tests','assertionsPassed','assertionsFailed','cancelled','skipped','todo']},
    'countInterpretation': '17 top-level + 6 ordering/auth children + 2 fault children = 25 TAP tests. Seven failures include the parent aggregating six failed children; not seven distinct defects.',
    'nativeExitCode': suite['code'], 'timedOut': suite['timedOut'], 'wholeParent': parent,
    'causalWitnesses': causal, 'rawCausalEvents': events,
    'allIndividualFailures': failures, 'allTapTests': tests,
    'causalConclusion': 'Both guest and bound webhook-first paths passed the exact canonical capture/order/site/provider/key/amount/currency/two-entry balance witness, then failed the unchanged flag=true assertion with flag=false. Concurrent paths also reached a false-flag witness. Browser-first paths had flag=true and failed the separate query assertion; those are not the causal metadata reproduction.',
    'coverageLimit': 'Each ordering child stops at its first failed assertion. Later assertions within those six children were not reached; RED does not certify later retry/notification/conservation checks in those children.',
    'migrations': {'count':len(actual_migrations),'maxPrefix':393,'ceiling':None,
                   'exactAppliedHashOrderMatchesPinnedClosure':True,
                   'actualApplied':suite['migrations']['applied'],
                   'fourQualifiedUps':closure['fourQualifiedUpsInOrder'],
                   'upEvidence':'Accepted unchanged wrapper synchronously hash-checks and applies all four proposals before requiring the suite. Suite execution proves that path returned; no separate per-UP database receipt is emitted.'},
    'proxyRequests':suite['proxyRequests'],
    'proxyCounterLimit':'One upstreamErrors is retained from the canonical runner. This report does not independently attribute that counter to a particular expected fault.',
    'cleanup':result['cleanup'],'suiteCleanup':suite['cleanup'],
    'reaped':result['reaped'],'strayProcessesStopped':suite['strayProcessesStopped'],
    'sourceReverification':source,'frozenSourcePins':frozen,'frozenArtifactPins':frozen_assets,
    'preservation': {'testRerun':False,'greenStarted':False,'apparelStarted':False,
                     'mainSourceWrittenByThisWork':False,'frozenSourceWrittenByThisWork':False,
                     'originalRuntimeResourceActions':False,'realProviderOrEmailCalls':False,
                     'browserActions':False,'cleanupScope':'Only canonical new-run labelled resources; no reap'},
    'original23MadeYoursCases': {'executedByThisRun':0,'lastVerifiedStatus':'23 NOT_RUN',
                                'notSubstitutedBy':'This native suite uses local provider and notification fakes and is not browser/actual Razorpay Test Mode acceptance.'},
    'next':'Independent allocator reviews actual RED, all failures, source bindings and cleanup. GREEN requires its separate exact activation. Editor retains the sole browser queue; original 23 need a recovered allocated shared fixture and real case evidence.',
    'evidence':evidence,
}
for filename, value in [('NATIVE_RED_ACTUAL_REPORT01.json',report),
                        ('NATIVE_RED_CAUSAL_WITNESSES01.json',{'recordedAt':recorded,'runId':result['runId'],'events':events,'witnesses':causal}),
                        ('NATIVE_RED_FAILURES01.json',{'recordedAt':recorded,'runId':result['runId'],'failures':failures}),
                        ('NATIVE_RED_POSTRUN_PINS01.json',{'recordedAt':recorded,'source':source,'frozenSource':frozen,'frozenArtifacts':frozen_assets})]:
    output = own / filename
    assert not output.exists(), filename
    output.write_text(json.dumps(value,indent=2)+'\n')
markdown = f'''The single RED cohort reproduced the capture metadata defect and exited 1. It is not an all-pass result.

Run `{result['runId']}` executed 25 TAP tests: 18 passed and 7 failed, with zero skipped, cancelled or TODO. The seven failures comprise four metadata assertions, two separate query assertions, and the parent aggregating the six failed children.

Both guest and bound webhook-first paths reached the accepted raw witness: one canonical capture tied to the original provider payment and durable key, a paid INR order, and exactly two ledger entries of 21,100 minor units, one debit and one credit. The completed hosted checkout still reported capture false. The next unchanged metadata assertion failed. Concurrent paths also showed false metadata. Browser-first paths reported true metadata and failed the separate query assertion; those failures are preserved separately. Each failed child stopped at that assertion, so its later checks are not certified.

The whole parent, including provisioning and cleanup, took {parent['elapsedSecondsIncludingProvisionAndCleanup']:.3f} seconds of the 600-second budget. The full 322 migration hashes and order match the pinned closure through prefix 393; no ceiling was used. The accepted wrapper applies exactly the four admitted unnumbered UPs before requiring this suite.

Canonical cleanup reports zero failures and no remaining run-labelled containers, networks or volumes. Per-suite REST and database cleanup succeeded; no reaping or stray-process stop occurred. Post-run RED/GREEN source and link pins and the four frozen source pins were checked again. The artifact pins are recorded individually in the machine-readable report.

GREEN has not started. The original 23 MadeYours browser cases remain last verified as NOT_RUN; this native fake-provider suite does not count as their execution or as actual Razorpay Test Mode proof. Editor retains the browser queue. No Main or frozen source was changed by this work.

Actual result: [native-red-approved01-result.json]({own}/native-red-approved01-result.json)

Full suite log: [native log]({log})

All failures: [NATIVE_RED_FAILURES01.json]({own}/NATIVE_RED_FAILURES01.json)

Raw causal witnesses: [NATIVE_RED_CAUSAL_WITNESSES01.json]({own}/NATIVE_RED_CAUSAL_WITNESSES01.json)

Full report and evidence hashes: [NATIVE_RED_ACTUAL_REPORT01.json]({own}/NATIVE_RED_ACTUAL_REPORT01.json)
'''
output = own / 'NATIVE_RED_ACTUAL_REPORT01.md'
assert not output.exists()
output.write_text(markdown)
index = {'recordedAt':recorded,'status':report['status'],'runId':result['runId'],
         'files':[{'path':str(own / n),'sha256':sha(own / n)} for n in
                  ['NATIVE_RED_ACTUAL_REPORT01.json','NATIVE_RED_ACTUAL_REPORT01.md',
                   'NATIVE_RED_CAUSAL_WITNESSES01.json','NATIVE_RED_FAILURES01.json','NATIVE_RED_POSTRUN_PINS01.json']]}
index_path = own / 'NATIVE_RED_EVIDENCE_INDEX01.json'
assert not index_path.exists()
index_path.write_text(json.dumps(index,indent=2)+'\n')
print(json.dumps({'status':report['status'],'runId':result['runId'],'index':str(index_path),
                  'indexSha256':sha(index_path),'sourceChangedFiles':[s['changedFiles'] for s in source],
                  'sourceChangedLinks':[s['changedLinks'] for s in source],
                  'frozenSourceExact':all(f['exact'] for f in frozen),
                  'artifactCount':len(frozen_assets),'artifactsExact':all(f['exact'] for f in frozen_assets)}))
