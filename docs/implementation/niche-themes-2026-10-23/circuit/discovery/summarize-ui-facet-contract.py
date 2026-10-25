"""Summarize existing in-process evidence; does not execute/qualify a runtime."""
import hashlib,json,re
from pathlib import Path
b=Path(__file__).resolve().parent
r=json.loads((b/'ui-facet-contract/report.json').read_text())
initial=json.loads((b/'ui-facet-contract/baseline-red/findings.json').read_text())
base=json.loads((b/'ui-facet-contract/baseline-red/report.json').read_text())
log=(b/'ui-facet-contract.log').read_text()
stats={k:int(re.search(r'^# '+k+r' (\d+)$',log,re.M).group(1)) for k in ['tests','pass','fail','skipped','cancelled']}
assert len(r['rows'])==18 and not stats['skipped'] and not stats['cancelled'], 'Incomplete oracle execution'
current_harness_hash=hashlib.sha256((b/'ui-facet-contract.test.ts').read_bytes()).hexdigest()
assert current_harness_hash==r['inputs']['docs/implementation/niche-themes-2026-10-23/circuit/discovery/ui-facet-contract.test.ts'], 'Harness changed since recorded run; rerun before summarizing'
name_map={'letbuyy-bloom':'Playfield','letbuyy-forge':'Circuit','letbuyy-refresh':'Pantry','letbuyy-craft':'Habitat','letbuyy-summit':'Kindred','letbuyy-nova':'MadeYours','letbuyy-aura':'Dewdrop','letbuyy-ride':'Trailmark','letbuyy-dawn':'Marginalia'}
observations=[dict(f,slug=row['slug'],route=row['route'],html=row['html']) for row in r['rows'] for f in row['findings']]
initial['issues'] += [
 {'id':'UI-LABEL-HAB-001','owner':'Habitat','observed':'Selected material/finish options display the normalized current transport value instead of the supplied source facet label.','path':'packages/theme-engine/src/habitat-discovery.ts','repro':'Admitted value wood/label Wood and natural/label Natural; inspect the selected option in both real template DOMs.'},
 {'id':'UI-LABEL-MG-001','owner':'Marginalia','observed':'Product-kind choices use fixed display labels instead of the supplied facet labels.','path':'packages/theme-engine/src/marginalia-discovery.ts','repro':'Admitted value book/label book and stationery/label stationery; inspect actual option text Books/Stationery in both template DOMs.'},
]
for issue in initial['issues']:
 id=issue['id']
 def relevant(f):
  if id=='UI-CIR-001':return f['slug']=='letbuyy-forge' and f['check']=='submission'
  if id=='UI-MY-001':return f['slug']=='letbuyy-nova' and 'personalization_method' in f['message']
  if id=='UI-TM-001':return f['slug']=='letbuyy-ride' and f['check']=='submission' and 'length_' in f['message']
  if id=='UI-MG-001':return f['slug']=='letbuyy-dawn' and 'ruling' in f['message']
  if id=='UI-DD-001':return f['slug']=='letbuyy-aura' and f['check']=='capability'
  if id=='UI-LABEL-HAB-001':return f['slug']=='letbuyy-craft' and 'wrong facet label' in f['message']
  if id=='UI-LABEL-MG-001':return f['slug']=='letbuyy-dawn' and 'wrong facet label' in f['message']
  if id=='UI-SEARCH-001':return 'Missing supplied' in f['message'] and f['slug'] in ['letbuyy-refresh','letbuyy-craft','letbuyy-summit','letbuyy-aura'] and f['route']=='search' and f['check']=='submission'
  if id=='UI-NAV-001':return f['check']=='navigation'
  return False
 issue['currentStatus']='open' if any(relevant(f) for f in observations) else 'resolved-in-current-oracle'
 if id=='UI-TM-001':
  issue['currentStatus']='open-ui-and-pending-backend390-physical-capability' if any(relevant(f) for f in observations) else 'pending-backend390-physical-capability'
  issue['resolutionBoundary']='Actual386 UI is honest and preserves active length pairs; no real length/unit facets exist. Synthetic capability UI passes but does not close backend390 work.'
 if id=='UI-LABEL-MG-001':
  if not any(relevant(f) for f in observations):issue['currentStatus']='harness-corrected-fixed-canonical-enum'
  issue['allowedMapping']={'book':'Books','stationery':'Stationery'}
 issue['currentObservations']=sum(relevant(f) for f in observations)
 if id=='UI-MG-001':issue['repro']='Book bibliography is checked with books_kind=book. A separate actual stationery render checks books_kind=stationery&books_ruling=lined, including lined/grid submission. See auxiliaryHtml, avoiding contradictory book+stationery facts.'
table=[]
for slug,name in name_map.items():
 def failing(report):return sum(any(f['check']==check for f in row['findings']) for row in report['rows'] if row['slug']==slug for check in ['submission','navigation','capability'])
 table.append({'theme':name,'baselineFailingChecksOf6':failing(base),'currentFailingChecksOf6':failing(r),'currentObservationCount':sum(f['slug']==slug for f in observations)})
summary=dict(initial,result='GREEN_UI_CONTRACT_WITH_PENDING_BACKEND390_CAPABILITY' if not stats['fail'] and not r.get('sourceChangedDuringRun') else 'RED_UI_QUERY_CONTRACT_FINDINGS',stats=stats,renderedTemplates=len(r['rows'])+sum(len(row.get('auxiliaryHtml',[]))for row in r['rows']),networkCalls=r['networkCalls'],findingObservations=len(observations),issues=initial['issues'],matrix=table,backend390PhysicalCapabilityStatus='PENDING_REAL_BACKEND_CAPABILITY_NOT_CLOSED_BY_UI_OR_SYNTHETIC_CASES',fixtureCorrection='Book bibliography and stationery ruling now have separate actual rendered subcases; no assertion was suppressed. Initial expanded red baseline remains immutable.',harnessSha256=hashlib.sha256((b/'ui-facet-contract.test.ts').read_bytes()).hexdigest(),capabilityGaps=[dict(gap,slug=row['slug'],route=row['route'])for row in r['rows'] for gap in row.get('capabilityGaps',[])],syntheticPhysicalCapabilities=[dict(row['syntheticPhysicalCapability'],slug=row['slug'],route=row['route'])for row in r['rows'] if row.get('syntheticPhysicalCapability')],sourceChangedDuringRun=r.get('sourceChangedDuringRun',[]),inputs=r.get('inputs',{}))
summary['sourceStability']={}
for row in r['rows']:
 for path,value in row['sourceHashes'].items():
  summary['sourceStability'].setdefault(path,[])
  if value not in summary['sourceStability'][path]:summary['sourceStability'][path].append(value)
summary['unchanged']='This oracle changes no production source. Circuit owns its separately recorded factory/discovery repair; other theme fixes belong to their owners. No DB/build/browser/network resource is used.'
(b/'ui-facet-contract/findings.json').write_text(json.dumps(summary,indent=2)+'\n')
(b/'ui-facet-contract/theme-failure-table.json').write_text(json.dumps(table,indent=2)+'\n')
print(json.dumps({'stats':stats,'networkCalls':r['networkCalls'],'sourceChangedDuringRun':r.get('sourceChangedDuringRun',[]),'table':table},indent=2))
