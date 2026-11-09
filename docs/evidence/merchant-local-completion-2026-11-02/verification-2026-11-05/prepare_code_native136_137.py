from pathlib import Path
import json,secrets,hashlib,shutil
v=Path('docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05').resolve();old=Path(json.loads((v/'native134-prepared.json').read_text())['root']);iosold=Path(json.loads((v/'native133-prepared.json').read_text())['root']);android=Path('/private/tmp/letbuyy-merchant-local-20261108-'+secrets.token_hex(5));android.mkdir(mode=0o700);ios=Path('/private/tmp/letbuyy-ios-ui-20261108-'+secrets.token_hex(5));ios.mkdir(mode=0o700)
androidName='merchant-code-create-retire-v136-local-android.postgres.test.ts';iosName='merchant-code-create-retire-v137-local-ios.postgres.test.ts'
for original,dest,oldv,newv in [('merchant-create-retire-v134-local-android.postgres.test.ts',androidName,'v134','v136'),('merchant-create-retire-v133-local-ios.postgres.test.ts',iosName,'v133','v137')]:
 s=(v/original).read_text().replace(oldv,newv);s=s.replace('assert.deepEqual(created.images,[]);',"assert.deepEqual(created.images,[]);assert.equal(owned.psql(`SELECT name FROM product_options WHERE product_id='${created.id}'ORDER BY position LIMIT1`),'Code');".replace('LIMIT1','LIMIT 1'));s=s.replace("await expect(page.getByLabel('Price for M',{exact:true})).toHaveValue('125');", "await expect(page.getByRole('button',{name:'Rename option Code',exact:true})).toBeVisible();await expect(page.getByLabel('Price for M',{exact:true})).toHaveValue('125');");(v/dest).write_text(s)
for name in ['Auth.py','Create.py','ui_helpers.py','run_fixture.py','run_ui.py','run_ui_guard.py','run_chain.py']:
 s=(old/name).read_text().replace(str(old),str(android)).replace('v134','v136').replace('ANDROID134','ANDROID136').replace('merchant-create-retire-v136-local-android.postgres.test.ts',androidName)
 if name=='Create.py':s=s.replace("fill(0,'Size')","fill(0,'Code')")
 if name=='run_chain.py':s=s.replace('source-v102','source-v103').replace('retirement-v98-flutter','retirement-v103-flutter').replace('retirement-v98-analysis','retirement-v103-analysis').replace('retirement-v102-governance','retirement-v103-governance').replace('/private/tmp/letbuyy-ios-ui-20261108-133778cee8',str(iosold))
 (android/name).write_text(s);compile(s,str(android/name),'exec')
d=json.loads((old/'android-device-receipt.json').read_text());d['run_root']=str(android/'native-product-media-v136');(android/'android-device-receipt.json').write_text(json.dumps(d,indent=2)+'\n');(android/'control-admission.json').write_text('{}\n')
for name in ['Auth.swift','Create.swift','verify_installed.py','run_fixture.py','run_ui.py','run_ui_guard.py','run_chain-reviewed-v2.py']:
 s=(iosold/name).read_text().replace(str(iosold),str(ios)).replace('v133','v137').replace('133()','137()').replace('merchant-create-retire-v137-local-ios.postgres.test.ts',iosName)
 if name=='Create.swift':s=s.replace('fill(field(app,"Option name"),"Size")','fill(field(app,"Option name"),"Code")')
 if name=='run_ui.py':s=s.replace('/private/tmp/letbuyy-ios-ui-20261108-9ae2f99d13/journey.json',str(iosold/'journey.json'))
 if name=='run_chain-reviewed-v2.py':s=s.replace(str(old),str(android)).replace('source-v102','source-v103').replace('retirement-v98-flutter','retirement-v103-flutter').replace('retirement-v98-analysis','retirement-v103-analysis').replace('retirement-v102-governance','retirement-v103-governance')
 (ios/name).write_text(s)
 if name.endswith('.py'):compile(s,str(ios/name),'exec')
shutil.copytree(iosold/'MerchantUI.xcodeproj',ios/'MerchantUI.xcodeproj');p=ios/'MerchantUI.xcodeproj/project.pbxproj';p.write_text(p.read_text().replace(str(iosold),str(ios)));d=json.loads((iosold/'device-receipt.json').read_text());d['run_root']=str(ios/'native-ios-v137');(ios/'device-receipt.json').write_text(json.dumps(d,indent=2)+'\n');(ios/'control-admission.json').write_text('{}\n')
for root,n,fixture in [(android,136,androidName),(ios,137,iosName)]:
 (v/f'native{n}-prepared.json').write_text(json.dumps({'root':str(root),'fixture':str(v/fixture),'source':'merchant-creation-retirement-source-v103','scope':'Normal synthetic UI; Code option creation before price125, real lost201->503 recovery,web135/native readback, zero-stock retirement/history; no provider/full122/host9002. Preserve device data/mappings; iOS137 after Android136 cleanup.','controls':{str(p):hashlib.sha256(p.read_bytes()).hexdigest()for p in root.glob('*')if p.is_file()}},indent=2)+'\n')
print('Android136',android);print('iOS137',ios)
