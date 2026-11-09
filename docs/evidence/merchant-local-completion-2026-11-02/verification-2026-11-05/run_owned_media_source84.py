from pathlib import Path
import tempfile,subprocess,json,os
from qualify import ROOT,E
r=Path(tempfile.mkdtemp(prefix="letbuyy-media-commands-source84-",dir="/private/tmp"));r.chmod(0o700)
args=["node","scripts/governance/run-executable-suites.mjs","--jobs","1","--no-reap","--kind","gateway-db","--timeout","900","--suite","tests/owned-db/merchant-media-commands-workerd.postgres.test.ts","--log-dir",str(r/"logs"),"--json-out",str(r/"runner.json")]
(E/"media-recovery-v84-owned-db-control.json").write_text(json.dumps({"root":str(r),"suite":"tests/owned-db/merchant-media-commands-workerd.postgres.test.ts","scope":"Fresh isolated local PG/PostgREST/compiled workerd/R2 only. No provider or hosted activation."},indent=2)+"\n")
result=subprocess.run(args,cwd=ROOT)
print("Owned Media database terminal",result.returncode,"private root",str(r))
raise SystemExit(result.returncode)
