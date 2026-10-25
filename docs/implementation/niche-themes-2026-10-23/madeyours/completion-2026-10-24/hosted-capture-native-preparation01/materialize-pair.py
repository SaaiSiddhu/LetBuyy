"""Source copies and read-only dependency hashing only. No process/DB/native calls."""
from pathlib import Path
import os,json,hashlib,datetime,shutil
MAIN=Path('/Volumes/Projects/LetBuyy');BASE=Path('/private/tmp/letbuyy-shared-completion-20261024-06');OWN=Path(__file__).parent
ALLOC=MAIN/'docs/implementation/niche-theme-programme/completion-2026-10-24/themes-shared-review-20261025-01/HOSTED_CAPTURE_RED_GREEN_NATIVE_PREPARATION_01.json'
a=json.loads(ALLOC.read_text());manifest=json.loads((BASE/'source-copy-receipt.json').read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert len(manifest['files'])==6547
excluded=[r for r in manifest['files'] if '.env.' in Path(r['path']).name or Path(r['path']).name.endswith('.env')]
assert len(excluded)==6
(OWN/'ENV_DECLARATION_EXCLUSIONS.json').write_text(json.dumps({'originalReceiptCount':6547,'excluded':excluded,'rule':'Declared names/hashes only; no value printing or runtime environment copy. Any actual import/read of an omitted path must refuse closure.','valuesInspectedOrPrinted':False},indent=2)+'\n')
source={r['path']:r for r in manifest['files'] if r not in excluded}
for rel,row in source.items():
 p=BASE/rel;assert not p.is_symlink() and sha(p)==row['sha256'],rel
 assert not Path(rel).name.startswith('.env') and Path(rel).name!='.npmrc'
# Enumerate only real node_modules metadata/link entries without following them.
links=[];metadata=[]
for current,dirs,files in os.walk(BASE,followlinks=False):
 here=Path(current);rel=here.relative_to(BASE)
 dirs[:]=[d for d in dirs if d not in {'.git','.next','.wrangler','.turbo','.cache'}]
 for name in list(dirs)+files:
  q=here/name;r=q.relative_to(BASE)
  if 'node_modules' not in r.parts:continue
  if q.is_symlink():links.append((str(r),q.resolve(strict=True)));continue
  if q.is_file() and '.bin' not in r.parts:
   assert not q.name.startswith('.env') and q.name!='.npmrc';metadata.append(str(r))
reports=[]
for label,directory in zip(['RED','GREEN'],a['sourceMaterializations']):
 dest=Path(directory)
 if dest.exists():
  assert label=='RED' and not (OWN/'red-materialization.json').exists(), 'Only resume our incomplete unsealed first copy'
  for row in excluded:
   q=dest/row['path']
   if q.exists():q.unlink() # exact owned transient copied template only, no user/source deletion
 else:dest.mkdir(mode=0o700)
 for rel in source:
  target=dest/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(BASE/rel,target)
 for rel in metadata:
  target=dest/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(BASE/rel,target)
 applied=[]
 for ov in a['exactOverlays']:
  target=dest/ov['path'];target.parent.mkdir(parents=True,exist_ok=True)
  if label=='RED' and ov['path'].endswith('/routes/checkout.ts'):
   assert sha(target)==ov['beforeSha256'];applied.append({'path':ov['path'],'sha256':sha(target),'kind':'INTENTIONAL_BASELINE_ROUTE'})
  else:
   src=Path(ov['privatePath']);assert sha(src)==ov['afterSha256'];shutil.copy2(src,target);applied.append({'path':ov['path'],'sha256':sha(target),'kind':'SEALED_PROPOSAL01_OVERLAY'})
 # Explicit proposed fourth, test-only layer; immutable49f705 original remains untouched.
 witness=OWN/'buyer-ownership-witness02.proposed.ts';testrel='services/api-gateway/src/__tests__/owned-db/hosted-checkout-buyer-ownership.postgres.test.ts'
 shutil.copy2(witness,dest/testrel);applied.append({'path':testrel,'sha256':sha(dest/testrel),'kind':'PROPOSED_WITNESS02_REQUIRES_THEMES_ACCEPTANCE','replacesSealedTestSha256':a['currentTestSha256']})
 linkrows=[]
 for rel,real in links:
  q=dest/rel;q.parent.mkdir(parents=True,exist_ok=True)
  if '.bin' in Path(rel).parts:continue
  if real.is_relative_to(BASE):target=dest/real.relative_to(BASE);kind='PRIVATE_WORKSPACE'
  elif real.is_relative_to(MAIN) and not real.is_relative_to(MAIN/'node_modules'):
   target=dest/real.relative_to(MAIN);assert target.exists(),(rel,real);kind='PRIVATE_WORKSPACE_REBOUND'
  elif real.is_file() and real.is_relative_to(MAIN/'node_modules') and not real.is_relative_to(MAIN/'node_modules/.pnpm'):
   assert real.name=='.pnpm-workspace-state.json', (rel,real)
   if q.is_symlink():q.unlink()
   shutil.copy2(real,q);continue # pin a real installation metadata copy; never a Main source link
  else:
   assert real.is_relative_to(MAIN/'node_modules/.pnpm'),(rel,real);target=real;kind='SHARED_THIRD_PARTY'
  if q.is_symlink():
   assert q.resolve(strict=True)==target.resolve(strict=True);q.unlink()
  assert not q.exists(),str(q)
  q.symlink_to(os.path.relpath(target,q.parent) if kind.startswith('PRIVATE') else str(target))
  linkrows.append({'path':rel,'target':os.readlink(q),'resolved':str(q.resolve(strict=True)),'kind':kind})
 # Direct unchanged installed CLI: no pnpm shim with inherited Main NODE_PATH.
 cli=(MAIN/'node_modules/tsx').resolve()/'dist/cli.mjs';bindir=dest/'node_modules/.bin';bindir.mkdir(parents=True,exist_ok=True)
 if (bindir/'tsx').is_symlink():(bindir/'tsx').unlink()
 (bindir/'tsx').symlink_to(cli)
 linkrows.append({'path':'node_modules/.bin/tsx','target':str(cli),'resolved':str(cli),'kind':'SHARED_THIRD_PARTY_CLI'})
 files=[]
 for current,dirs,names in os.walk(dest,followlinks=False):
  for name in names:
   q=Path(current)/name
   if not q.is_symlink():files.append({'path':str(q.relative_to(dest)),'sha256':sha(q),'bytes':q.stat().st_size})
 files.sort(key=lambda x:x['path'])
 migrations=sorted((dest/'database/supabase/migrations').glob('*.sql'));assert len(migrations)==322 and max(int(q.name.split('_')[0])for q in migrations)==393
 report={'label':label,'root':str(dest),'classification':'EXACT_SOURCE_MATERIALIZATION_PROPOSED_WITNESS_PENDING_REVIEW_NO_PREFLIGHT_OR_NATIVE','sourceBase':{'path':str(BASE/'source-copy-receipt.json'),'sha256':sha(BASE/'source-copy-receipt.json'),'originalReceiptFiles':6547,'excludedEnvDeclarations':6,'allowedBaseFiles':len(source)},'files':files,'links':linkrows,'overlays':applied,'metadataFiles':len(metadata),'tsxCli':{'path':str(cli),'sha256':sha(cli)},'migrations':{'count':322,'maximum':393},'noEnvCredentialsOrDataInFinalCopy':True,'preflightExecuted':False,'nativeExecuted':False}
 (OWN/(label.lower()+'-materialization.json')).write_text(json.dumps(report,indent=2)+'\n');reports.append(report)
left={r['path']:r['sha256']for r in reports[0]['files']};right={r['path']:r['sha256']for r in reports[1]['files']};assert left.keys()==right.keys();diff=[k for k in left if left[k]!=right[k]];assert diff==['services/api-gateway/src/routes/checkout.ts'],diff
# Link strings are root-independent relative workspace links or exact vendor links.
assert [(r['path'],r['target'])for r in reports[0]['links']]==[(r['path'],r['target'])for r in reports[1]['links']]
(OWN/'PAIR_DIFF.json').write_text(json.dumps({'differentFiles':diff,'identicalTestSha256':left['services/api-gateway/src/__tests__/owned-db/hosted-checkout-buyer-ownership.postgres.test.ts'],'identicalWrapperSha256':left[a['exactOverlays'][2]['path']],'sameLinkTargets':True,'filesPerCandidate':len(left),'sourceBaseUnchanged':all(sha(BASE/rel)==row['sha256']for rel,row in source.items()),'noExecution':True},indent=2)+'\n')
print(json.dumps({'materialized':a['sourceMaterializations'],'files':len(left),'links':len(reports[0]['links']),'onlyDifference':diff,'nativeStarts':0}),flush=True)
