"""Fixture-only successor to sealed06. No suite/DB/build/provider launch."""
from pathlib import Path
from hashlib import sha256
from datetime import datetime,timezone
import json,os,shutil

MAIN=Path('/Volumes/Projects/LetBuyy')
BASE=Path('/private/tmp/madeyours-checkout-reentry-proposal-20261024-06')
NEW=Path('/private/tmp/madeyours-checkout-reentry-proposal-20261024-07')
REC=BASE/'packaging-receipts'
sha=lambda p:sha256(p.read_bytes()).hexdigest()
load=lambda p:json.loads(p.read_text())
assert sha(REC/'sealed-boundary.json')=='bee033918c136b3e9f264d20b54a7d47423721e5c7349c61df11bc51b33a9f00'
seal=load(REC/'sealed-boundary.json')
for f in seal['files']:assert sha(Path(f['path']))==f['sha256'],f['path']
src=load(REC/'source-input-closure06.json');links=load(REC/'dependency-links06.json')
for f in src['files']:assert sha(BASE/f['path'])==f['sha256'],f['path']
assert not NEW.exists();NEW.mkdir(mode=0o700);out=NEW/'packaging-receipts';out.mkdir()
for f in src['files']:
 dest=NEW/f['path'];dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(BASE/f['path'],dest)
test='services/api-gateway/src/__tests__/owned-db/hosted-checkout-contact-reentry.postgres.test.ts'
p=NEW/test;before=p.read_text();old='seedBuyerAccount(psql, `reentry-${crypto.randomUUID()}`)';fixed='seedBuyerAccount(psql, `reentry-${crypto.randomUUID().slice(0, 16)}`)';assert before.count(old)==1
p.write_text(before.replace(old,fixed))
assert p.read_text().replace(fixed,old)==before
newlinks=[]
for f in links['links']:
 dest=NEW/f['path'];dest.parent.mkdir(parents=True,exist_ok=True)
 target=NEW/Path(f['target']).relative_to(BASE) if f['kind']=='CANDIDATE_WORKSPACE' else Path(f['target'])
 dest.symlink_to(os.path.relpath(target,dest.parent));assert dest.resolve()==target.resolve()
 newlinks.append({**f,'target':str(target),'realPath':str(dest.resolve())})
cli={**links['tsxCli']};dest=NEW/cli['path'];dest.parent.mkdir(parents=True,exist_ok=True);dest.symlink_to(cli['target']);assert sha(Path(cli['target']))==cli['sha256']
files=[];deltas=[]
for f in src['files']:
 current=sha(NEW/f['path']);files.append({**f,'sha256':current})
 if current!=f['sha256']:deltas.append({'path':f['path'],'beforeSha256':f['sha256'],'afterSha256':current})
assert len(deltas)==1 and deltas[0]['path']==test
for f in src['overlays']:
 if f['path']!=test:assert sha(NEW/f['path'])==f['proposalSha256'],f['path']
for f in src['files']:assert sha(BASE/f['path'])==f['sha256'],f['path']
record={'classification':'PRIVATE07_FIXTURE_LABEL_ONLY_PREFLIGHT_PENDING','createdAt':datetime.now(timezone.utc).isoformat(),'candidate':str(NEW),'parentBoundary':{'path':str(REC/'sealed-boundary.json'),'sha256':sha(REC/'sealed-boundary.json')},'files':files,'fixtureOnlyDelta':deltas[0],'oldExpression':old,'correctedExpression':fixed,'unchangedProductionOverlays':10,'unchangedNative15Suite':{'path':'services/api-gateway/src/__tests__/owned-db/hosted-checkout-buyer-ownership.postgres.test.ts','sha256':sha(NEW/'services/api-gateway/src/__tests__/owned-db/hosted-checkout-buyer-ownership.postgres.test.ts')},'dependencyLinks':newlinks,'tsxCli':cli,'metadataInheritedUnchanged':{'path':str(REC/'runtime-package-metadata06.json'),'sha256':sha(REC/'runtime-package-metadata06.json')},'vendorIdentityInheritedUnchanged':{'path':str(REC/'shared-third-party06.json'),'sha256':sha(REC/'shared-third-party06.json')},'priorNativeResult':{'path':str(MAIN/'docs/implementation/niche-theme-programme/completion-2026-10-24/checkout-native06-run01/runner.json'),'sha256':sha(MAIN/'docs/implementation/niche-theme-programme/completion-2026-10-24/checkout-native06-run01/runner.json'),'runId':'34adae829d85','tests':22,'pass':15,'fail':7,'skipped':0,'cancelled':0,'new7StoppedBeforeCheckout':True,'cleanup':'GREEN_NO_REMAINING_OWNED_RESOURCES','reaped':[]},'pureLabelContract':'NEXT_NO_DB','nativeCommandScope':'ONLY_CORRECTED7_EXISTING15_REUSABLE_FOR_IDENTICAL_PRODUCTION_INPUTS','resources':{'mainSourceWrites':0,'sealed05or06Writes':0,'databaseStarts':0,'nativeRuns':0,'browser':0,'providers':0,'envCredentialsCopied':False}}
(out/'candidate07.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'candidate':str(NEW),'files':len(files),'changedSourceFiles':1,'unchangedProductionOverlays':10,'nativeStarts':0,'next':'Pure actual harness label contract'}))
