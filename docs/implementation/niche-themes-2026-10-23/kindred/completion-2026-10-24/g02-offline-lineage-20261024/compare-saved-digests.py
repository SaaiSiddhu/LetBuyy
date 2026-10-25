"""Finite offline comparison of the admitted Kindred artifact and saved run936 receipts.

Reads files only; never connects to a database, API, browser or runtime. The
serialization below is deliberately limited to this artifact's scalar domain.
It is not a general implementation of PostgreSQL JSONB serialization.
"""

from collections import Counter
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path


ROOT = Path('/Volumes/Projects/LetBuyy')
OUT = Path(__file__).resolve().parent
BASE = Path('docs/implementation/niche-themes-2026-10-23/kindred/completion-2026-10-24')
EVIDENCE = Path('docs/implementation/theme-editor-2026-10-23/evidence')
ARTIFACT = Path('docs/implementation/niche-theme-programme/release-v2/proposals/81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f/letbuyy-summit-2.0.0.json')


def digest(data):
    return sha256(data).hexdigest()


def no_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON object key')
        result[key] = value
    return result


def read_json(relative):
    return json.loads((ROOT / relative).read_text(), object_pairs_hook=no_duplicates)


def ordered(value):
    if isinstance(value, dict):
        return {key: ordered(value[key]) for key in sorted(value, key=lambda k: (len(k.encode('utf-8')), k.encode('utf-8')))}
    if isinstance(value, list):
        return [ordered(item) for item in value]
    if value is None or isinstance(value, (str, bool, int)):
        return value
    raise ValueError('Artifact scalar outside the reviewed finite serialization domain')


def serialized_digest(value):
    raw = json.dumps(ordered(value), ensure_ascii=False, allow_nan=False, separators=(', ', ': ')).encode('utf-8')
    return {'sha256': digest(raw), 'bytes': len(raw)}


def file_receipt(relative):
    raw = (ROOT / relative).read_bytes()
    return {'path': str(relative), 'sha256': digest(raw), 'bytes': len(raw)}


assert OUT == ROOT / BASE / 'g02-offline-lineage-20261024'
artifact = read_json(ARTIFACT)
ledger_path = EVIDENCE / 'stable936-kindred-finite-nonorder-boundary.json'
ledger = read_json(ledger_path)
ledger_hashes = {row['path']: row['sha256'] for row in ledger['artifacts']}
input_receipts = [file_receipt(ARTIFACT), file_receipt(ledger_path)]
checks = []


def check(name, passed, **context):
    checks.append({'name': name, 'passed': bool(passed), **context})


check('Accepted artifact file matches frozen SHA256', input_receipts[0]['sha256'] == '54f9d916749d64f80b6bd5dd6ec85a7e50b5e17bef765e61fffe727d94c8d411')
check('Saved controller ledger matches independent baseline pin', input_receipts[1]['sha256'] == '1d70a3cf27f72c9b53dcd8028707c59ad657b42d35eae5f69026d35f5cf1bc70')
check('Artifact identity is Kindred v2', (artifact['slug'], artifact['version'], artifact['id']) == ('letbuyy-summit', '2.0.0', '7b669c70-0000-4000-8000-000000000010'))
document = artifact['document']
manifest = artifact['persistence']['themePackageVersion']['package_manifest']
expected = {
    'installedConfigSqlSha256': serialized_digest(document),
    'packageManifestSqlSha256': serialized_digest(manifest),
}
check('Admitted manifest liquidBundle alias equals admitted document bundle', manifest['liquidBundle'] == document['liquidBundle'])
check('Admitted manifest themeBundle alias equals admitted document bundle', manifest['themeBundle'] == document['liquidBundle'])
rows = []
for stage in ('installed', 'a-published', 'b-private', 'b-published', 'a-restored', 'b-reapplied'):
    path = EVIDENCE / f'stable936-kindred-{stage}-readback.json'
    saved = read_json(path)
    receipt = file_receipt(path)
    input_receipts.append(receipt)
    check(f'{stage}: original manifest hash', receipt['sha256'] == ledger_hashes[str(path)])
    check(f'{stage}: retained guarded read-only collector flags', saved.get('guardVerified') is True and saved.get('readOnly') is True and saved['runId'] == '936e5f577646')
    actual = saved['actual']
    candidates = [row for row in actual['instances'] if row['slug'] == 'letbuyy-summit']
    assert len(candidates) == 1
    instance = candidates[0]
    check(f'{stage}: same saved Kindred site and immutable package/version/instance',
          actual['siteId'] == '2f958a36-71bf-4e8f-89fd-d3363f4fe42c'
          and instance['packageId'] == 'b327f956-f30b-4772-ab80-48318724325e'
          and instance['packageVersionId'] == '04941797-d597-480f-8893-8cf72c7adb17'
          and instance['instanceId'] == '0e00c2e3-c609-419a-8df9-b19367d03721')
    for key, value in expected.items():
        check(f'{stage}: {key} matches admitted artifact serialization', instance[key] == value['sha256'], observed=instance[key], recomputed=value['sha256'])
    if stage == 'installed':
        initial = actual['drafts']
        check('Initial draft v1 also matches admitted document serialization', len(initial) == 1 and initial[0]['version'] == 1 and initial[0]['manifestSha256'] == expected['installedConfigSqlSha256']['sha256'])
    rows.append({'stage': stage, 'recordedAt': saved['recordedAt'], 'savedReceipt': receipt, 'siteId': actual['siteId'], 'instance': instance, 'productsCount': actual['productsCount'], 'ordersCount': actual['ordersCount'], 'currentRelease': actual['currentRelease']})

frozen_sources = {
    'packages/theme-engine/src/kindred-theme.ts': '3a47dc979dbdf5dce395fd44a858e007567820f4fac569fade603ff6da4fd551',
    'packages/theme-engine/src/kindred-discovery.ts': '14dd29777737158a61287bf54e98571c6b3abf1e07ec542d2e7f678180ad473f',
    'packages/theme-engine/src/kindred-styles.ts': '15e6670f6556a7b9cfd8e56891088f0abe9a8ffa1105822be1a1902ecd7282cf',
    'apps/commerce/web/src/app/store/[subdomain]/liquid-theme.css': 'f7f31610c85bf37430fe96fe5cbde8366d3fd9b30e0e43fe7ebfa0ecf3d2f24b',
    'docs/implementation/niche-themes-2026-10-23/kindred/responsive-shopping-2026-10-23/installed-gifts-lifecycle.plan.json': '700a60f8a97b0a0336860bc3b2c4262c2c3cd9749fa287c9b8c5af65c600c9ae',
}
for path, expected_hash in frozen_sources.items():
    receipt = file_receipt(path)
    input_receipts.append(receipt)
    check(f'Frozen input unchanged: {path}', receipt['sha256'] == expected_hash)

phase0_manifest_path = BASE / 'EVIDENCE_MANIFEST.json'
input_receipts.append(file_receipt(phase0_manifest_path))
for row in read_json(phase0_manifest_path)['files']:
    receipt = file_receipt(row['path'])
    check(f'Prior Phase0 document preserved: {row["path"]}', receipt['sha256'] == row['sha256'])

result = {
    'recordedAt': datetime.now(timezone.utc).isoformat(),
    'classification': 'OFFLINE_SAVED_RECEIPT_DIGEST_LINKAGE_NOT_NEW_RUNTIME_ACCEPTANCE',
    'runId': '936e5f577646',
    'artifact': input_receipts[0],
    'serialization': {
        'scope': 'Finite admitted artifact only; reject floats/unsupported scalars and duplicate keys; preserve arrays, booleans and integer values',
        'objectKeyOrder': 'UTF-8 byte length, then bytewise lexical order',
        'encoding': 'UTF-8, unescaped non-ASCII, comma-space and colon-space separators, no trailing newline',
        'references': [
            'https://www.postgresql.org/docs/17/datatype-json.html',
            'https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/utils/adt/jsonb_util.c#L1795-L1844',
            'https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/utils/adt/jsonb.c#L463-L577',
        ],
        'notClaimed': 'No PostgreSQL serializer, SQL query or collector source was executed/independently recovered here; this is a reproduced digest comparison against retained fields',
    },
    'expectedDigests': expected,
    'savedReadbacks': rows,
    'checks': checks,
    'totals': dict(Counter('PASS' if row['passed'] else 'FAIL' for row in checks)),
    'inputReceipts': input_receipts,
    'G02Disposition': 'PARTIAL; new strong content-digest linkage narrows prior gap, historical case result unchanged pending complete catalogue/collector provenance review',
    'remainingLimits': [
        'The saved receipts expose hashes and immutable row identifiers, not full raw installed/catalogue objects or the exact collector SQL.',
        'This does not establish a new explicit joined catalogue-to-installed row query or prove the serving runtime is currently live.',
        'catalogChecksum remains NULL; no checksum was synthesized or written.',
        'B00 publication/reload proof is separate and remains historical; this does not grant cart, identity, checkout, order or current browser execution credit.',
        'G08 failure and KQA-01 OPEN P2 remain unchanged.',
    ],
    'preservation': {'sourceWrites': 0, 'acceptedArtifactWrites': 0, 'priorEvidenceWrites': 0, 'browserActions': 0, 'apiCalls': 0, 'databaseCalls': 0, 'builds': 0, 'processesStarted': [], 'leasesAcquiredOrReturned': []},
}
with (OUT / 'RESULT.json').open('x') as handle:
    json.dump(result, handle, indent=2, ensure_ascii=False)
    handle.write('\n')
print(json.dumps({'classification': result['classification'], 'totals': result['totals'], 'digests': expected, 'G02': result['G02Disposition']}, ensure_ascii=False))
raise SystemExit(0 if all(row['passed'] for row in checks) else 1)
