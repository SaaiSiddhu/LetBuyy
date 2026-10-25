# Explicit local materialization only. Does not launch apps or contact a service.
from pathlib import Path
import json,hashlib,os,shutil,datetime
main=Path('/Volumes/Projects/LetBuyy');prior=Path('/private/tmp/letbuyy-shared-completion-20261024-01');integration=Path('/private/tmp/letbuyy-shared-integration-20261024-01');candidate=Path('/private/tmp/letbuyy-shared-completion-20261024-05')
evidence=main/'docs/implementation/niche-theme-programme/completion-2026-10-24/shared-runtime06'
assert not candidate.exists();candidate.mkdir(mode=0o700);evidence.mkdir()
base=json.loads((integration/'source-copy-receipt.json').read_text());paths={x['path']for x in base['files']}
extras=['packages/theme-engine/test/first-party-child-customization.test.ts','apps/commerce/web/src/context/cart-context-revision.test.tsx','apps/commerce/web/src/lib/theme-engine/madeyours-cart-edit.test.ts','packages/checkout-core/test/madeyours-cart-edit.test.ts','services/api-gateway/src/__tests__/owned-db/madeyours-cart-edit.postgres.test.ts','services/api-gateway/src/__tests__/owned-db/first-party-customization-qualification.manual.ts','tests/owned-db/theme-completion-razorpay-browser.manual.ts','services/api-gateway/src/__tests__/owned-db/hosted-checkout-webhook-first-qualification.manual.ts','docs/implementation/niche-theme-programme/completion-2026-10-24/SHARED_RUNTIME_ADMISSION.json']
proposalBase='docs/implementation/niche-theme-programme/completion-2026-10-24/'
extras += [proposalBase+'shared-integration01/cart-edit03.qualified-'+x+'.proposal.sql'for x in ['up','down']]
extras += [proposalBase+'child-customization-integration01/'+x for x in ['customization210.up.proposal.sql','customization210.down.proposal.sql','DISTRIBUTION_PROPOSAL.json','NATIVE_ADMISSION.json']]
extras += ['docs/implementation/niche-themes-2026-10-23/circuit/completion-2026-10-24/facet-private-implementation-03/UNNUMBERED_circuit_facets.up.proposal.sql']
extras += ['apps/commerce/web/src/app/api/storefront/[subdomain]/cart/[cartToken]/route.ts','apps/commerce/web/src/app/api/storefront/cart-proxy.test.ts']
paths.update(extras);files=[];sha=lambda b:hashlib.sha256(b).hexdigest()
for relative in sorted(paths):
 assert not relative.startswith('/')and '..'not in relative.split('/')and 'node_modules'not in relative.split('/')
 assert not any(x in relative.split('/') for x in ['.git','.next','.wrangler','.turbo'])
 assert not Path(relative).name.startswith('.env') and Path(relative).name!='.npmrc'
 source=main/relative;assert source.is_file()and source.resolve().is_relative_to(main),relative
 data=source.read_bytes();target=candidate/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);os.chmod(target,source.stat().st_mode&0o777);files.append({'path':relative,'sha256':sha(data),'bytes':len(data)})
links=json.loads((prior/'dependency-links.json').read_text());workspace=0;missing=[]
for link in links:
 target=candidate/link['path'];target.parent.mkdir(parents=True,exist_ok=True);assert target.parent.resolve().is_relative_to(candidate)
 dest=link['resolved']
 if link['workspace']:
  assert dest.startswith(str(prior)+'/');dest=str(candidate)+dest[len(str(prior)):];workspace+=1
 target.symlink_to(dest)
 if not target.exists():missing.append(link['path'])
extra=candidate/'apps/commerce/web/node_modules/zod';assert not extra.exists();extra.symlink_to(main/'node_modules/.pnpm/zod@4.3.6/node_modules/zod');assert extra.is_dir()
metadata=json.loads((prior/'dependency-executable-metadata-proof.json').read_text())['files']
for row in metadata:
 relative=row['path'];data=(integration/relative).read_bytes()
 for old in [str(integration),str(prior)]:data=data.replace(old.encode(),str(candidate).encode())
 target=candidate/relative;target.parent.mkdir(parents=True,exist_ok=True);assert target.parent.resolve().is_relative_to(candidate)
 assert not target.is_symlink();target.write_bytes(data);os.chmod(target,(integration/relative).stat().st_mode&0o777)
assert not missing
for row in files:assert sha((main/row['path']).read_bytes())==row['sha256'],'Source moved during copy'
r={'recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'candidate':str(candidate),'status':'CURRENT_MAIN_COHERENT_COPY_NOT_YET_SEALED_OR_LAUNCHED','files':files,'sourceFiles':len(files),'dependencyLinks':len(links)+1,'workspaceLinks':workspace,'metadataFiles':len(metadata),'missingLinks':missing,'secretsCopied':False,'userAppsTouched':False}
(candidate/'source-copy-receipt.json').write_text(json.dumps(r,indent=2)+'\n');(evidence/'MATERIALIZATION.json').write_text(json.dumps({k:v for k,v in r.items() if k!='files'},indent=2)+'\n');print(json.dumps({k:v for k,v in r.items()if k!='files'}))
