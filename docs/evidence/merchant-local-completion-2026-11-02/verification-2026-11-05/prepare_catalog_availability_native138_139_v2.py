from pathlib import Path
import json,secrets,hashlib,shutil
v=Path(__file__).resolve().parent
oldA=Path('/private/tmp/letbuyy-merchant-local-20261108-7b0b676b70');oldI=Path('/private/tmp/letbuyy-ios-ui-20261108-a2502e54e4')
a=Path('/private/tmp/letbuyy-merchant-local-20261108-'+secrets.token_hex(5));a.mkdir(mode=0o700)
i=Path('/private/tmp/letbuyy-ios-ui-20261108-'+secrets.token_hex(5));i.mkdir(mode=0o700)
seed=''' const proofKey=randomUUID();const proof=await gateway.request('/v1/products',{method:'POST',headers:{...await signedIdentityHeaders(owner,email,tenant.siteId),'X-Store-ID':tenant.siteId,'X-Idempotency-Key':proofKey},body:JSON.stringify({store_id:tenant.siteId,name:'Synthetic availability proof',price:125,stock:0,images:[],product_options:[{name:'Code',position:0,values:['M','L']}],variants:[{title:'M',stock:3,options:{Code:'M'}},{title:'L',stock:4,options:{Code:'L'}}]})});assert.equal(proof.status,201,proof.text);const availabilityId=proof.json!.data.id;
 const availabilityState=()=>JSON.parse(owned.psql(`SELECT jsonb_build_object('base',p.stock,'available',catalog_available_quantity(p),'M',(SELECT i.available-i.reserved FROM inventory_levels i JOIN product_variants v ON v.id=i.variant_id WHERE i.product_id=p.id AND v.option1='M'AND i.location_id='${tenant.locationId}'),'L',(SELECT i.available-i.reserved FROM inventory_levels i JOIN product_variants v ON v.id=i.variant_id WHERE i.product_id=p.id AND v.option1='L'AND i.location_id='${tenant.locationId}'))FROM products p WHERE id='${availabilityId}'`));assert.deepEqual(availabilityState(),{base:0,available:7,M:3,L:4});
'''
web='''  await marker('native-availability-initial.json');
  await page.goto(merchantOrigin+'/'+tenant.subdomain+'/products');let proofRow=page.getByRole('row').filter({hasText:'Synthetic availability proof'});await expect(proofRow).toHaveCount(1);await expect(proofRow).toContainText('7 in stock');await page.screenshot({path:join(root,'web-availability-seven.png'),fullPage:true});
  await page.goto(merchantOrigin+'/'+tenant.subdomain+'/products/'+availabilityId);await expect(page.getByLabel('Stock for M',{exact:true})).toHaveValue('3');await expect(page.getByLabel('Stock for L',{exact:true})).toHaveValue('4');await page.getByLabel('Stock for M',{exact:true}).fill('1');await page.getByRole('button',{name:'Save product',exact:true}).click();await expect.poll(()=>availabilityState()).toEqual({base:0,available:5,M:1,L:4});
  await page.goto(merchantOrigin+'/'+tenant.subdomain+'/products');proofRow=page.getByRole('row').filter({hasText:'Synthetic availability proof'});await expect(proofRow).toContainText('5 in stock');writeFileSync(join(root,'web-availability-updated.json'),JSON.stringify({run_id:owned.runId,available:5})+'\\n',{mode:0o600,flag:'wx'});
  await marker('native-availability-updated.json');assert.deepEqual(availabilityState(),{base:0,available:6,M:2,L:4});await page.reload();proofRow=page.getByRole('row').filter({hasText:'Synthetic availability proof'});await expect(proofRow).toContainText('6 in stock');await page.screenshot({path:join(root,'web-availability-native-six.png'),fullPage:true});writeFileSync(join(root,'web-availability-final.json'),JSON.stringify({run_id:owned.runId,available:6,parent_stock:0,live_variants:[2,4],accepted:true})+'\\n',{mode:0o600,flag:'wx'});
'''
fixtures={}
for oldn,newn,platform,root in [(136,138,'android',a),(137,139,'ios',i)]:
 original=f'merchant-code-create-retire-v{oldn}-local-{platform}.postgres.test.ts';dest=f'merchant-catalog-availability-v{newn}-local-{platform}.postgres.test.ts';s=(v/original).read_text().replace(f'v{oldn}',f'v{newn}')
 needle=" const provision=await gateway.request('/v1/employees'";assert s.count(needle)==1;s=s.replace(needle,seed+needle)
 needle="  await marker('native-create-uncertain.json');";assert s.count(needle)==1;s=s.replace(needle,web+needle)
 needle='price_history_retained:true,ui,';assert s.count(needle)==1;s=s.replace(needle,'price_history_retained:true,catalog_availability:{initial:7,web:5,native:6,base:0},ui,')
 (v/dest).write_text(s);fixtures[platform]=dest
for name in ['Auth.py','Create.py','ui_helpers.py','run_fixture.py','run_ui.py','run_ui_guard.py','run_chain.py']:
 s=(oldA/name).read_text().replace(str(oldA),str(a)).replace('v136','v138').replace('ANDROID136','ANDROID138').replace('merchant-code-create-retire-v138-local-android.postgres.test.ts',fixtures['android'])
 if name=='run_chain.py':
  s=s.replace('merchant-creation-retirement-source-v103','merchant-catalog-availability-source-v106').replace('merchant-creation-retirement-v103-flutter','merchant-catalog-availability-v105-flutter').replace('merchant-creation-retirement-v103-analysis','merchant-catalog-availability-v106-analysis').replace('merchant-creation-retirement-v103-governance-v2','merchant-catalog-availability-v106-governance').replace('/private/tmp/letbuyy-ios-ui-20261108-38aeee4bfb',str(oldI))
 if name=='Create.py':
  needle="tap('Products tab');tap('Add');wait('Save',30,True)";assert needle in s
  flow='''tap('Products tab')
def proof_card(stock):
 end=time.monotonic()+45
 while time.monotonic()<end:
  items=[x for x in nodes()if x.get('package')=='com.letbuyy.store'and x.get('clickable')=='true'and visible(x)and label(x).startswith('Product Synthetic availability proof,')]
  if len(items)==1 and ', Stock '+str(stock)+','in label(items[0]):return items[0]
  if not items:swipe()
  else:time.sleep(.3)
 raise RuntimeError('Actual canonical catalog availability did not become '+str(stock))
proof_card(7);screen('native-availability-seven.png');write('native-availability-initial.json',{'stock':7});filewait('web-availability-updated.json',180)
tap('Refresh');item=proof_card(5);screen('native-availability-web-five.png');tapnode(item);wait('Update',30,True);choose_section('Variants');tapnode(scrollto('Edit M variant',True));wait('Edit variant',20)
for _ in range(12):
 fs=fields();quantity=[x for x in fs if x.get('text')=='1']
 if len(quantity)==1:break
 swipe()
assert len(quantity)==1,'Observed M quantity1 required';fill(fs.index(quantity[0]),'2');tap('Save variant');tap('Update');wait('Products tab',45,True);proof_card(6);screen('native-availability-native-six.png');write('native-availability-updated.json',{'stock':6});filewait('web-availability-final.json',180)
tap('Add');wait('Save',30,True)'''
  s=s.replace(needle,flow)
 (a/name).write_text(s);compile(s,str(a/name),'exec')
d=json.loads((oldA/'android-device-receipt.json').read_text());d['run_root']=str(a/'native-product-media-v138');(a/'android-device-receipt.json').write_text(json.dumps(d,indent=2)+'\n');(a/'control-admission.json').write_text('{}\n')
for name in ['Auth.swift','Create.swift','verify_installed.py','run_fixture.py','run_ui.py','run_ui_guard.py','run_chain-reviewed-v2.py']:
 s=(oldI/name).read_text().replace(str(oldI),str(i)).replace('v137','v139').replace('137()','139()').replace('merchant-code-create-retire-v139-local-ios.postgres.test.ts',fixtures['ios'])
 if name=='run_ui.py':s=s.replace('/private/tmp/letbuyy-ios-ui-20261108-38aeee4bfb/journey.json',str(oldI/'journey.json'))
 if name=='run_chain-reviewed-v2.py':s=s.replace(str(oldA),str(a)).replace('merchant-creation-retirement-source-v103','merchant-catalog-availability-source-v106').replace('merchant-creation-retirement-v103-flutter','merchant-catalog-availability-v105-flutter').replace('merchant-creation-retirement-v103-analysis','merchant-catalog-availability-v106-analysis').replace('merchant-creation-retirement-v103-governance-v2','merchant-catalog-availability-v106-governance')
 if name=='Create.swift':
  needle=' func testCreateRetire139()';assert needle in s
  helpers=''' func proofCard(_ app:XCUIApplication,_ stock:Int)->XCUIElement {let b=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Product Synthetic availability proof,")).firstMatch;let end=Date().addingTimeInterval(45);while Date()<end {if b.exists&&b.isHittable&&b.label.contains(", Stock \\(stock),"){return b};if !b.exists|| !b.isHittable {let list=app.scrollViews.element(boundBy:0);XCTAssertTrue(list.exists);list.swipeUp()}else{Thread.sleep(forTimeInterval:0.3)}};XCTFail("Actual catalog quantity must equal \\(stock)");return b}
 func proofShot(_ app:XCUIApplication,_ name:String){let a=XCTAttachment(screenshot:app.screenshot());a.name=name;a.lifetime = .keepAlways;add(a)}
'''
  s=s.replace(needle,helpers+needle)
  needle='tap(app,"Products tab");tap(app,"Add");';assert s.count(needle)==1
  flow='''tap(app,"Products tab");_ = proofCard(app,7);proofShot(app,"Native availability seven");try marker("native-availability-initial.json",["stock":7]);waitMarker("web-availability-updated.json",180);tap(app,"Refresh");let proof=proofCard(app,5);proofShot(app,"Native web availability five");proof.tap();XCTAssertTrue(app.buttons["Update"].waitForExistence(timeout:30));section(app,"Variants");tap(app,"Edit M variant");XCTAssertEqual(field(app,"Quantity").value as?String,"1");fill(field(app,"Quantity"),"2");tap(app,"Save variant");tap(app,"Update");XCTAssertTrue(app.buttons["Products tab"].waitForExistence(timeout:30));_ = proofCard(app,6);proofShot(app,"Native availability six");try marker("native-availability-updated.json",["stock":6]);waitMarker("web-availability-final.json",180);tap(app,"Add");'''
  s=s.replace(needle,flow)
 (i/name).write_text(s)
 if name.endswith('.py'):compile(s,str(i/name),'exec')
shutil.copytree(oldI/'MerchantUI.xcodeproj',i/'MerchantUI.xcodeproj');p=i/'MerchantUI.xcodeproj/project.pbxproj';p.write_text(p.read_text().replace(str(oldI),str(i)));d=json.loads((oldI/'device-receipt.json').read_text());d['run_root']=str(i/'native-ios-v139');(i/'device-receipt.json').write_text(json.dumps(d,indent=2)+'\n');(i/'control-admission.json').write_text('{}\n')
for root,n,platform in [(a,138,'android'),(i,139,'ios')]:
 (v/f'native{n}-prepared.json').write_text(json.dumps({'root':str(root),'fixture':str(v/fixtures[platform]),'source':'merchant-catalog-availability-source-v106','Flutter105_reuse':'catalog-availability105-to106-input-equivalence.json; only backend verification checksum changed','scope':'Normal synthetic auth; real availability7,web stock edit5/native Refresh5,native variant stock edit6/web6 with base0 preserved; then Code creation/lostreply/replay/retirement/history regression. Only task emulator/simulator,54350–54353,host9002nevercontacted; iOS139 after Android138cleanup.','controls':{str(p):hashlib.sha256(p.read_bytes()).hexdigest()for p in root.glob('*')if p.is_file()}},indent=2)+'\n')
print('Android138',a);print('iOS139',i)
