from pathlib import Path
import subprocess,tempfile,json
from qualify import ROOT,E
r=Path(tempfile.mkdtemp(prefix="letbuyy-public-range-source84-",dir="/private/tmp"));r.chmod(0o700)
(E/"public-range-source84-control.json").write_text(json.dumps({"root":str(r)})+"\n")
command=["node","scripts/governance/run-executable-suites.mjs","--jobs","1","--no-reap","--kind","gateway-db","--timeout","600","--suite","tests/owned-db/merchant-public-media-range-workerd.postgres.test.ts","--log-dir",str(r/"logs"),"--json-out",str(r/"runner.json")]
with(r/"supervisor.log").open("x")as output:result=subprocess.run(command,cwd=ROOT,stdout=output,stderr=subprocess.STDOUT)
print(json.dumps({"exit":result.returncode,"private_root":str(r)}),flush=True)
raise SystemExit(result.returncode)
