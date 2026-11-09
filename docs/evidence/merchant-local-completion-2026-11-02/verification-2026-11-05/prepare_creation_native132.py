from pathlib import Path
import json,hashlib,secrets,shutil,os
repo=Path.cwd();v=repo/'docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05';old=Path('/private/tmp/letbuyy-merchant-local-20261108-f7a3c2efea');r=Path('/private/tmp/letbuyy-merchant-local-20261108-'+secrets.token_hex(5));r.mkdir(mode=0o700)
name='merchant-create-retire-v132-local-android.postgres.test.ts';fixture=(v/'merchant-variant-kyc-v129-local-android.postgres.test.ts').read_text().replace('v129','v132').replace('owned Android current-source variants and original private KYC replay with web sync','owned Android canonical product creation recovery and variant retirement with web sync')
fixture=fixture.replace("url.pathname==='/v1/kyc/documents/upload'", "url.pathname==='/v1/products'")
fixture=fixture.replace('OWNED_LOST_KYC_RESPONSE','OWNED_LOST_CREATE_RESPONSE').replace('Synthetic response lost after actual private document committed','Synthetic response lost after actual product creation committed')
fixture=fixture.replace('calls.push({source,range:', 'calls.push({source,body_digest:body?digest(Buffer.from(body)):undefined,range:')
a=fixture.index("  const variants=()=>",fixture.index("await marker('native-android-auth-verified.json')"));b=fixture.index('\n }finally{',a)
fixture=fixture[:a]+r'''
  await marker('native-create-uncertain.json');
  const createdProduct=()=>JSON.parse(owned.psql(`SELECT to_jsonb(p)FROM products p WHERE store_id='${tenant.siteId}'AND name='Synthetic native new product'`));
  let created=createdProduct();assert(created&&created.id);assert.deepEqual(created.images,[]);
  const createdId=created.id;const variants=()=>JSON.parse(owned.psql(`SELECT jsonb_agg(to_jsonb(v)ORDER BY position,id)FROM product_variants v WHERE product_id='${createdId}'`));
  let rows=variants();assert.equal(rows.length,1);const createdVariant=rows[0].id;assert.equal(Number(rows[0].price),125);assert.equal(rows[0].inventory_qty,0);assert.equal(rows[0].option1,'M');
  assert(lostModelUpload);const creates=()=>calls.filter(c=>c.source==='actual-mobile-bff'&&c.path==='/v1/products'&&c.method==='POST');
  assert.equal(creates().length,1);assert.equal(creates()[0].status,201);assert.equal(creates()[0].wire_status,503);
  writeFileSync(join(root,'native-create-committed-verified.json'),JSON.stringify({run_id:owned.runId,product_id:createdId,variant_id:createdVariant,accepted:true})+'\n',{mode:0o600,flag:'wx'});
  await marker('native-create-recovered.json');assert.equal(createdProduct().id,createdId);assert.equal(creates().length,2);assert.equal(creates()[1].status,201);assert.equal(creates()[1].key_digest,creates()[0].key_digest);assert.equal(creates()[1].body_digest,creates()[0].body_digest);
  assert.equal(owned.psql(`SELECT count(*)FROM products WHERE store_id='${tenant.siteId}'AND name='Synthetic native new product'`),'1');
  await page.goto(merchantOrigin+'/'+tenant.subdomain+'/products/'+createdId);await expect(page.getByLabel('Title',{exact:true})).toHaveValue('Synthetic native new product');await expect(page.getByLabel('Price for M',{exact:true})).toHaveValue('125');await expect(page.getByLabel('Stock for M',{exact:true})).toHaveValue('0');
  await page.getByLabel('Price for M',{exact:true}).fill('135');await page.getByRole('button',{name:'Save product',exact:true}).click();await expect.poll(()=>Number(variants()[0].price)).toBe(135);
  const history=()=>owned.psql(`SELECT jsonb_agg(to_jsonb(t)ORDER BY id)FROM product_price_observations t WHERE variant_id='${createdVariant}'`),priceHistory=history();assert(Number(owned.psql(`SELECT count(*)FROM product_price_observations WHERE variant_id='${createdVariant}'`))>=2);
  await page.screenshot({path:join(root,'web-created-variant-readback.png'),fullPage:true});writeFileSync(join(root,'web-created-variant-updated.json'),JSON.stringify({run_id:owned.runId,accepted:true})+'\n',{mode:0o600,flag:'wx'});
  await marker('native-created-variant-retired.json');rows=variants();assert.equal(rows.length,1);assert.equal(rows[0].id,createdVariant);assert(rows[0].deleted_at);assert.equal(Number(rows[0].price),135);assert.equal(history(),priceHistory);
  const read=await gateway.request('/v1/products/'+createdId,{headers:await signedIdentityHeaders(owner,email,tenant.siteId)});assert.equal(read.status,200,read.text);assert.deepEqual(read.json!.data.variants,[]);assert.deepEqual(read.json!.data.product_options,[]);
  await page.reload();await expect(page.getByLabel('Title',{exact:true})).toHaveValue('Synthetic native new product');await expect(page.getByLabel('Retire variant M',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Price for M',{exact:true})).toHaveCount(0);
  await page.screenshot({path:join(root,'web-retired-variant-history-kept.png'),fullPage:true});writeFileSync(join(root,'web-retired-variant-readback.json'),JSON.stringify({run_id:owned.runId,accepted:true})+'\n',{mode:0o600,flag:'wx'});
  const ui=await marker('journey-done.json');assert(ui.accepted);assert.deepEqual(betaInventory(),initialBetaInventory);assert.equal(alphaRoster(),initialAlphaRoster);
  writeFileSync(join(root,'create-retire-readback.json'),JSON.stringify({run_id:owned.runId,product_id:createdId,variant_id:createdVariant,created_products:1,create_requests:2,original_key_equal:true,original_body_equal:true,images:0,inherited_variant_price:125,web_variant_price:135,retired_uuid_retained:true,price_history_retained:true,ui,whole_features_accepted:0,scope:'Actual normal Android auth; image/description-free creation; options before price; lost201->503 reply, original replay; web135 native readback; zero-stock native retirement and web live-read removal; no provider or whole122 acceptance.'},null,2)+'\n',{mode:0o600,flag:'wx'});checkSource(source,'native creation/retirement readback');
''' +fixture[b:]
(v/name).write_text(fixture)
for f in ['Auth.py','ui_helpers.py','run_fixture.py','run_ui.py','run_ui_guard.py','run_chain.py']:
 s=(old/f).read_text().replace(str(old),str(r)).replace('v129','v132').replace('ANDROID129','ANDROID132').replace('merchant-variant-kyc-v132-local-android.postgres.test.ts',name)
 if f=='run_ui.py':
  a=s.index("for phase,expected in ");b=s.index(':\n',a)
  s=s[:a]+"for phase,expected in [('Auth','ANDROID132_NORMAL_AUTH_PASSED'),('Create','ANDROID132_CREATE_RETIRE_ACCEPTED')]"+s[b:]
 if f=='run_chain.py':
  s=s.replace('merchant-options-accessibility-source-v95','merchant-creation-retirement-source-v102')
  a=s.index('for name in [');b=s.index("prior=Path(",a)
  s=s[:a]+"for name in ['merchant-creation-retirement-v98-flutter','merchant-creation-retirement-v98-analysis','merchant-creation-retirement-v102-governance']:\n d=json.loads((v/(name+'.terminal.json')).read_text());assert d['exit_code']==0\n"+s[b:]
 (r/f).write_text(s)
receipt=json.loads((old/'android-device-receipt.json').read_text());receipt['run_root']=str(r/'native-product-media-v132');(r/'android-device-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
(r/'control-admission.json').write_text('{}\n')
(r/'Create.py').write_text(r'''exec((__import__('pathlib').Path(__file__).resolve().parent/'ui_helpers.py').read_text(),globals())
ready=json.loads((root/'journey-ready.json').read_text())
tap('Products tab');tap('Add Product');wait('Save',30,True)
# Normal editor entry, without image or description requirements.
fill(0,'Synthetic native new product')
choose_section('Variants');tapnode(scrollto('Manage product options',True));wait('Product options',20)
tapnode(scrollto('Add product option',True));fill(0,'Size');fill(1,'M');tap('Apply change');tap('Apply options')
choose_section('Pricing');fill(0,'125');tap('Save');wait('Retry pending save',45,True)
screen('native-created-uncertain.png');write('native-create-uncertain.json',{'accepted':True});filewait('native-create-committed-verified.json',120)
tap('Retry pending save');wait('Products tab',45,True);write('native-create-recovered.json',{'accepted':True});filewait('web-created-variant-updated.json',180)
def product():
 tap('Products tab');ns=nodes();items=[x for x in ns if x.get('package')=='com.letbuyy.store'and x.get('clickable')=='true'and label(x).startswith('Product Synthetic native new product,')];assert len(items)==1;tapnode(items[0]);wait('Update',30,True)
product();choose_section('Variants');tapnode(scrollto('Edit M variant',True));wait('Edit variant',20)
for _ in range(10):
 fs=fields()
 if any(x.get('text')=='135.0'for x in fs):break
 swipe()
assert any(x.get('text')=='135.0'for x in fs);screen('native-created-web-price-readback.png');back()
tapnode(scrollto('Retire M variant',True));tap('Retire variant');tap('Update');wait('Products tab',45,True)
write('native-created-variant-retired.json',{'accepted':True});filewait('web-retired-variant-readback.json',180)
product();choose_section('Variants');ns=nodes();assert not match('Edit M variant',ns,True);assert not match('Retire M variant',ns,True)
screen('native-retired-variant-readback.png');back();wait('Products tab',30,True)
write('journey-done.json',{'accepted':True});print('ANDROID132_CREATE_RETIRE_ACCEPTED',flush=True)
''')
(v/'native132-prepared.json').write_text(json.dumps({'root':str(r),'fixture':str(v/name),'source':'merchant-creation-retirement-source-v102','scope':'Normal synthetic auth and UI; no session injection, no provider, no host9002 contact; original emulator data/mappings preserved','controls':{str(p):hashlib.sha256(p.read_bytes()).hexdigest()for p in r.glob('*.py')}},indent=2)+'\n');print(r)
