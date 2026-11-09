from pathlib import Path
import subprocess,json,sys,datetime
from qualify import ROOT,E,snapshot,write
n=Path('/private/tmp/letbuyy-merchant-local-20261106-dzfklhx4')
s=json.loads((E/'merchant-media-atomic-source-v50.source.json').read_text());assert snapshot()['files']==s['files']
owned=json.loads((n/'media-atomic-v50-owned.json').read_text());assert owned['failedSuites']==0 and owned['tests']>0 and not any(owned['cleanup']['remaining'].values())
command=['node','scripts/governance/run-executable-suites.mjs','--jobs','1','--no-reap','--kind','postgres','--timeout','600','--suite','tests/executable/tenant-redteam-postgres.test.mjs','--log-dir',str(n/'media-atomic-v50-tenant-logs'),'--json-out',str(n/'media-atomic-v50-tenant.json')]
with(n/'media-atomic-v50-tenant-launch.log').open('x')as log:r=subprocess.run(command,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
write(E/'media-atomic-v50-tenant-terminal.json',{'exit_code':r.returncode,'source_unchanged':snapshot()['files']==s['files'],'source_sha256':s['sha256']})
if r.returncode or snapshot()['files']!=s['files']:sys.exit(r.returncode or 99)
print('Owned tenant red-team terminal passed. Starting source50 broad pipeline.',flush=True)
r=subprocess.run(['python3',str(E/'run_media_atomic_v50_pipeline.py')],cwd=ROOT)
sys.exit(r.returncode)
