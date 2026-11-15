from pathlib import Path
import json
import hashlib
import zipfile
import datetime
from qualify import E, snapshot, write

current=json.loads((E/'web-viewport-source-v1.source.json').read_text())
prior=json.loads((E/'product-optional-source-v1.source.json').read_text())
assert snapshot()['files']==current['files']
changed=sorted(p for p in set(prior['files'])|set(current['files'])
               if prior['files'].get(p)!=current['files'].get(p))
assert changed==['apps/merchant/web/src/app/globals.css']
gates=json.loads((E/'product-optional-v1-qualification.terminal.json').read_text())
assert gates['source_unchanged'] and all(step['exit_code']==0 for step in gates['steps'])
android=json.loads((E/'product-optional-v1-android-compile-v1.terminal.json').read_text())
apk=Path(android['artifact']['path'])
assert hashlib.sha256(apk.read_bytes()).hexdigest()==android['artifact']['sha256']
with zipfile.ZipFile(apk) as archive:
    assert 'assets/flutter_assets/kernel_blob.bin' in archive.namelist()
    icons=hashlib.sha256(archive.read('assets/flutter_assets/fonts/MaterialIcons-Regular.otf')).hexdigest()
ios=json.loads((E/'product-optional-v1-ios-compile-v1.terminal.json').read_text())
app=Path(ios['artifact']['path'])
expected=json.loads((E/'product-optional-v1-ios-compile-v1-artifact-files.json').read_text())['files']
actual={str(p.relative_to(app)):hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(app.rglob('*')) if p.is_file()}
assert actual==expected
assert hashlib.sha256(json.dumps(actual,sort_keys=True,separators=(',',':')).encode()).hexdigest()==ios['artifact']['manifest_sha256']
assert len([p for p,h in actual.items() if p.endswith('/fonts/MaterialIcons-Regular.otf') and h==icons])==1
assert snapshot()['files']==current['files']
out={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
     'status':'RETAINED_MOBILE_BYTES_AND_IDENTICAL_CURRENT_INPUTS_PASS',
     'source_sha256':current['sha256'],'prior_build_source_sha256':prior['sha256'],
     'only_changed_input':changed,'android':android['artifact'],'ios':ios['artifact'],
     'ios_files_read_back':len(actual),'material_icons_sha256':icons,
     'scope':'Mobile input equality plus independently retained normal Android/iOS debug bytes. No new iOS launch or release;current web layout still needs native56 actual browser acceptance.'}
assert not (E/'web-viewport-v1-mobile-artifact-readback.json').exists()
write(E/'web-viewport-v1-mobile-artifact-readback.json',out)
print(json.dumps({'status':out['status'],'ios_files':len(actual),'source_unchanged':True}))
