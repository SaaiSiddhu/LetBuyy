from pathlib import Path
import subprocess,json,datetime
w=Path('/tmp/letbuyy-mobile-performance-20261030');rows=json.loads((w/'final-qa-stages.json').read_text())
for name,script in [('pricing-recovery','pricing-recovery.cjs'),('normal-local-smoke','normal-local-smoke.cjs')]:
 with(w/(name+'.log')).open('w')as f:code=subprocess.run(['node',str(w/script)],stdout=f,stderr=subprocess.STDOUT,timeout=300).returncode
 row=next(x for x in rows if x['stage']==name);row.update(initial_exit_code=row['exit_code'],exit_code=code,rerun_finished_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),initial_evidence='evidence/trials/initial-'+name+'.log',correction='Wait for actual plan headings, not skeleton card; use actual html lang contract rather than regional hreflang')
 (w/'final-qa-stages.json').write_text(json.dumps(rows,indent=2));print(name+' rerun '+str(code),flush=True)
assert all(x['exit_code']==0 for x in rows),rows
with(w/'final-qa-progress.log').open('a')as f:f.write('\nCorrected transport harnesses: both affected checks rerun successfully; all 11 final QA stages pass. Original failures retained separately.\n')
