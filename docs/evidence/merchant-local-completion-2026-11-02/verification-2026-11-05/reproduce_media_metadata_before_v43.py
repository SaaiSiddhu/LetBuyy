from pathlib import Path
import subprocess,json,hashlib,datetime
from qualify import ROOT,E,snapshot,write
current=json.loads((E/'merchant-kyc-receipt-source-v43.source.json').read_text());assert snapshot()['files']==current['files']
relative='apps/merchant/mobile/lib/screens/content/media_library_screen.dart';target=ROOT/relative;fixed=target.read_bytes();old=(Path('/private/tmp/letbuyy-merchant-kyc-receipt-v39-governance-k9jnxieb')/relative).read_bytes()
source39=json.loads((E/'merchant-kyc-receipt-source-v39.source.json').read_text());digest=lambda b:hashlib.sha256(b).hexdigest();assert digest(old)==source39['files'][relative]
results=[]
try:
 target.write_bytes(old)
 for action in ['Cancel','Save']:
  path=E/('media-metadata-source39-'+action.lower()+'-async-clean-fixture-before.log')
  command=['/Users/saai_mithra/Library/Developer/flutter/bin/flutter','test','--no-pub','test/media_metadata_lifecycle_test.dart','--plain-name',f'focused metadata {action} finishes its animated route without Flutter errors','--reporter','expanded']
  with path.open('x')as log:r=subprocess.run(command,cwd=ROOT/'apps/merchant/mobile',stdout=log,stderr=subprocess.STDOUT)
  text=path.read_text();results.append({'action':action,'exit_code':r.returncode,'production_file_matches_exact39':digest(target.read_bytes())==source39['files'][relative],'disposed_controller_error':'used after being disposed'in text,'dependents_assertion':'_dependents.isEmpty'in text,'semantics_handle_leak':'A SemanticsHandle was active'in text,'log':path.name})
finally:
 assert digest(target.read_bytes())==digest(old),'Owned production preimage drifted; preserve instead of overwriting'
 target.write_bytes(fixed)
 unchanged=snapshot()['files']==current['files']
 write(E/'media-metadata-v43-clean-negative.terminal.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'REPRODUCED'if len(results)==2 and all(r['exit_code']!=0 and r['disposed_controller_error']and not r['semantics_handle_leak']for r in results)and unchanged else'INVESTIGATE','results':results,'fixed_source_restored':unchanged,'fixed_source_sha256':current['sha256'],'purpose':'Same corrected regression isolated per action against the exact source39 production file; source42 implementation restored in finally. No hosted/provider/data change.'})
print(json.dumps({'results':results,'fixed_source_restored':unchanged}));assert unchanged
