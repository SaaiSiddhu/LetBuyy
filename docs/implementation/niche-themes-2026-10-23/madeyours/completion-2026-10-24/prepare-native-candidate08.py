"""Successor08: one native test's source-backed oracle/fixture corrections only."""
from pathlib import Path
from hashlib import sha256
from datetime import datetime,timezone
import json,os,shutil,difflib
BASE=Path('/private/tmp/madeyours-checkout-reentry-proposal-20261024-07')
NEW=Path('/private/tmp/madeyours-checkout-reentry-proposal-20261024-08')
load=lambda p:json.loads(p.read_text())
sha=lambda p:sha256(p.read_bytes()).hexdigest()
assert sha(BASE/'packaging-receipts/sealed-boundary07.json')=='8d19ca2e46fa4c360b1db70c848c83314710ed38308faa27d6bfbb041705f3ed'
src=load(BASE/'packaging-receipts/source-input-closure07.json');links=load(BASE/'packaging-receipts/dependency-links07.json')
for f in src['files']:assert sha(BASE/f['path'])==f['sha256'],f['path']
assert not NEW.exists();NEW.mkdir(mode=0o700);rec=NEW/'packaging-receipts';rec.mkdir()
for f in src['files']:
 dest=NEW/f['path'];dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(BASE/f['path'],dest)
test='services/api-gateway/src/__tests__/owned-db/hosted-checkout-contact-reentry.postgres.test.ts';p=NEW/test;before=p.read_text();text=before
def change(old,new):
 global text
 assert text.count(old)==1,old[:180]
 text=text.replace(old,new)
change("INSERT INTO products(id,store_id,name,price,sku,is_active) VALUES('${productId}','${site.siteId}','Synthetic re-entry item',199,'SYN-REENTRY-${productId}',true);", "INSERT INTO products(id,store_id,name,price,sku,is_active,stock) VALUES('${productId}','${site.siteId}','Synthetic re-entry item',199,'SYN-REENTRY-${productId}',true,50);")
change("['available','available_quantity','committed_quantity','updated_at'].includes(key)","['available','available_quantity','committed_quantity','updated_at','version'].includes(key)")
change("            assert.deepEqual(stable(now),stable(old),'Only the documented one-unit commit fields may change');", "            //141 reserve +216 commit each update the level;141's version trigger increments twice.\n            assert.equal(Number(now.version),Number(old.version)+2,'Exactly reserve+commit inventory versions');\n            assert.deepEqual(stable(now),stable(old),'Only one-unit commit fields and exact canonical version metadata may change');")
change("            assert.deepEqual(strip(now,['stock','updated_at']),strip(old,['stock','updated_at']),'Order consumption may not rewrite product facts/options/version');", "            //216 synchronizes default-SKU stock once; the baseline product trigger increments once.\n            assert.equal(Number(now.version),Number(old.version)+1,'Exactly one canonical stock-mirror product version');\n            assert.equal(Number(now.stock),Number(old.stock)-1,'Exactly one unit consumed from the coherent product stock mirror');\n            assert.deepEqual(strip(now,['stock','updated_at','version']),strip(old,['stock','updated_at','version']),'Order consumption preserves every unrelated product fact/option/field');")
anchor="function allowedControlChanges(before:Controls, after:Controls, flow:Pick<Flow,'cartId'|'sessionId'>, step:string, key:string, sessionMayChange:boolean, outboxKeys:string[]) {"
scope="function checkoutStepScope(step:string,cartId:string):string {\n    const scopes:Record<string,string>={contact:'contact',delivery:'delivery','payment-intent':'payment_intent',confirm:'confirm'};\n    assert.ok(Object.hasOwn(scopes,step),'Unknown hosted checkout step');\n    return `checkout.${scopes[step]}:${cartId}`;\n}\n"
change(anchor,scope+anchor+"\n    //Retain refusal provenance even when the strict comparison below throws.\n    proof('allowed-acknowledgement-delta',{step,sessionMayChange,allowedOutboxKeys:outboxKeys,before,after});")
change("if(name==='outbox_events' || !allowed(old)) assert.deepEqual(current,old);", "if(name==='outbox_events' || !allowed(old)) assert.deepEqual(current,old); else if(name==='idempotency_keys') for(const field of ['id','site_id','scope','key','request_hash','created_at']) assert.deepEqual(current[field],old[field],`Acknowledgement preserves idempotency ${field}`);")
change("compare('idempotency_keys',row=>row.scope===`checkout.${step}:${flow.cartId}` && row.key===key && !before.idempotency_keys.some(old=>old.id===row.id && old.status==='completed'));", "compare('idempotency_keys',row=>row.site_id===site.siteId && row.scope===checkoutStepScope(step,flow.cartId) && row.key===key && !before.idempotency_keys.some(old=>old.id===row.id && old.status==='completed'));")
end="    compare('outbox_events',row=>outboxKeys.includes(String(row.idempotency_key)));\n    proof('allowed-acknowledgement-delta',{step,sessionMayChange,allowedOutboxKeys:outboxKeys,before,after});"
change(end,"    compare('outbox_events',row=>outboxKeys.includes(String(row.idempotency_key)));")
p.write_text(text)
newlinks=[]
for f in links['links']:
 dest=NEW/f['path'];dest.parent.mkdir(parents=True,exist_ok=True);target=NEW/Path(f['target']).relative_to(BASE) if f['kind']=='CANDIDATE_WORKSPACE' else Path(f['target']);dest.symlink_to(os.path.relpath(target,dest.parent));assert dest.resolve()==target.resolve();newlinks.append({**f,'target':str(target),'realPath':str(dest.resolve())})
dest=NEW/links['tsxCli']['path'];dest.parent.mkdir(parents=True,exist_ok=True);dest.symlink_to(links['tsxCli']['target'])
files=[];deltas=[]
for f in src['files']:
 current=sha(NEW/f['path']);files.append({**f,'sha256':current,'class':'TEST_ORACLE_FIXTURE_ONLY08' if f['path']==test else f.get('class')})
 if current!=f['sha256']:deltas.append({'path':f['path'],'beforeSha256':f['sha256'],'afterSha256':current})
assert len(deltas)==1 and deltas[0]['path']==test
for f in src['files']:assert sha(BASE/f['path'])==f['sha256'],f['path']
(rec/'oracle-fixture-only.patch').write_text(''.join(difflib.unified_diff(before.splitlines(True),text.splitlines(True),fromfile='a/'+test,tofile='b/'+test)))
record={'classification':'PRIVATE08_TEST_ORACLE_FIXTURE_ONLY_PREFLIGHT_PENDING','createdAt':datetime.now(timezone.utc).isoformat(),'candidate':str(NEW),'parentBoundary':{'path':str(BASE/'packaging-receipts/sealed-boundary07.json'),'sha256':sha(BASE/'packaging-receipts/sealed-boundary07.json')},'files':files,'oneTestSourceDelta':deltas[0],'dependencyLinks':newlinks,'tsxCli':links['tsxCli'],'unchangedProductionOverlays':10,'unchangedOtherFiles':1126,'scopeMapping':'Exact contact/delivery/payment-intent->payment_intent/confirm mapping; same site/cart/key, completed historical receipts and existing request bindings conserved.','inventoryOracle':'Exact+2 level versions for reserve+commit; exact+1 product version for stock mirror; exactly one available/committed/stock unit. Full unrelated-field equality and refusal/replay zero-delta assertions retained.','fixtureBaseline':'Synthetic INSERT product stock50 equals new owned inventory available50. No existing data refilled.','provenance':'Control before/after proof is saved before comparisons, including future refusal failures.','resources':{'mainSourceWrites':0,'sealed05or06or07Writes':0,'databaseStarts':0,'nativeRuns':0,'browser':0,'providers':0,'envCredentialsCopied':False}}
(rec/'candidate08.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'candidate':str(NEW),'files':len(files),'changedTestSources':1,'productionChanges':0,'nativeStarts':0,'testSha':sha(p)}))
