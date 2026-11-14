from pathlib import Path
import json,csv,re,hashlib,datetime
r=Path.cwd();out=r/'reports/letbuyy-mobile-performance-2026-10-30';w=Path('/tmp/letbuyy-mobile-performance-20261030');jsons=0
for p in out.rglob('*.json'):json.loads(p.read_text());jsons+=1
counts={}
for p in out.glob('*.csv'):
 with p.open(newline='')as f:rows=list(csv.DictReader(f));assert all(None not in x for x in rows),p;counts[p.name]=len(rows)
assert counts['URL-INVENTORY.csv']==489 and counts['TEST-MATRIX.csv']==16 and counts['PERFORMANCE-COMPARISON.csv']==36,counts
links=0
for p in out.glob('*.md'):
 for x in re.findall(r'\[[^\]]+\]\(([^)]+)\)',p.read_text()):
  if x.startswith(('http://','https://','#')):continue
  target=x.split('#')[0];q=Path(target)if target.startswith('/')else p.parent/target;assert q.exists(),(p,x);links+=1
m=json.loads((out/'SOURCE-MANIFEST.json').read_text())
for x in m['changes']:assert hashlib.sha256((r/x['path']).read_bytes()).hexdigest()==x['after_sha256'],x['path']
for x in m['binary_assets']:
 for which in ['before','after']:assert hashlib.sha256((out/x[which+'_asset']).read_bytes()).hexdigest()==x[which+'_sha256']
f=json.loads((out/'evidence/candidate-fidelity.json').read_text())
for x in f['files']:
 for root in [r,w/'candidate']:assert hashlib.sha256((root/x['path']).read_bytes()).hexdigest()==x['sha256'],x['path']
a=json.loads((out/'acceptance.json').read_text());assert not a['deployed']and not a['all_warnings_resolved']and not a['whole_repository_green'];assert len(a['remaining_lab_threshold_breaches'])==7 and a['server_cleanup']['normal_services_unchanged'];assert all(x['exit_code']==0 for x in a['stage_results'])
result={'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'json_files_parsed':jsons,'csv_rows':counts,'valid_markdown_local_links':links,'current_source_and_candidate_files':f['count'],'source_patch_files':len(m['changes']),'binary_before_after_hashes_match':True,'current_source_hashes_match':True,'text_patch_sha256':hashlib.sha256((out/'TASK-SOURCE-CHANGES.patch').read_bytes()).hexdigest(),'remaining_warning_runs':7,'whole_repository_green_claimed':False,'deployed':False,'passed':True};(out/'evidence/deliverable-validation.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
