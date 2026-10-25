"""Task-owned source mirror using the established Git-list/copy candidate convention.
Never writes to the checkout/held candidate, reads env files, installs dependencies or creates a deployment.
"""
import hashlib,json,pathlib,shutil,subprocess,tempfile
source=pathlib.Path('/Volumes/Projects/LetBuyy')
target=pathlib.Path(tempfile.mkdtemp(prefix='letbuyy-madeyours-n7-',dir='/private/tmp'))
paths=subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard'],cwd=source).decode().split('\0')
roots={'packages','services','scripts','tests','database','config'}
extensions={'.ts','.tsx','.js','.mjs','.cjs','.json','.yaml','.yml','.sql','.graphql','.html','.css','.sh','.py'}
root_files={'package.json','pnpm-workspace.yaml','pnpm-lock.yaml','tsconfig.json','tsconfig.base.json','AGENTS.md'}
skipped={'node_modules','.git','.next','.turbo','.wrangler','.dart_tool','dist','build','coverage','test-results','playwright-report','__pycache__','.aws','.agents','.codex'}
inventory=[];package_dirs={pathlib.Path('.')}
for name in sorted(set(paths)):
 if not name:continue
 relative=pathlib.Path(name)
 if any(part in skipped or part.startswith(('.env','.dev.vars')) for part in relative.parts):continue
 if name not in root_files and (relative.parts[0] not in roots or relative.suffix not in extensions):continue
 if relative.suffix in {'.pem','.key','.p12','.pfx'}:continue
 original=source/relative
 if not original.is_file() or original.is_symlink():continue
 output=target/relative;output.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(original,output)
 content=output.read_bytes();inventory.append({'path':name,'sha256':hashlib.sha256(content).hexdigest(),'bytes':len(content)})
 if relative.name=='package.json':package_dirs.add(relative.parent)
# Reuse external installed libraries, but point every workspace link at this exact source mirror.
links=0
for parent in sorted(package_dirs):
 modules=source/parent/'node_modules'
 if not modules.is_dir():continue
 destination=target/parent/'node_modules';destination.mkdir(parents=True,exist_ok=True)
 entries=[]
 for entry in modules.iterdir():
  if entry.name.startswith('@') and entry.is_dir():
   (destination/entry.name).mkdir(exist_ok=True)
   entries.extend((child,destination/entry.name/child.name) for child in entry.iterdir())
  else:entries.append((entry,destination/entry.name))
 for original,output in entries:
  resolved=original.resolve()
  try:
   inside=resolved.relative_to(source)
   # The virtual store itself is installed dependency data; direct workspace package links are rebased.
   actual=target/inside if inside.parts[0] in roots else resolved
  except ValueError:actual=resolved
  if output.exists() or output.is_symlink():continue
  output.symlink_to(actual,target_is_directory=actual.is_dir());links+=1
required=['tests/owned-db/money-ledger-reconciliation-traversal.postgres.test.ts','scripts/governance/owned-client-launcher.mjs','scripts/governance/owned-money-ledger-scheduled-probe.mjs','services/queue-workers/src/index.ts','database/supabase/migrations/388_cart_order_fact_snapshots.sql','database/supabase/rollback/388_cart_order_fact_snapshots.rollback.sql']
parity=[]
for name in required:
 a=hashlib.sha256((source/name).read_bytes()).hexdigest();b=hashlib.sha256((target/name).read_bytes()).hexdigest()
 if a!=b:raise RuntimeError('Candidate source changed during copy: '+name)
 parity.append({'path':name,'sha256':b})
# Launcher guard sees no app environment files. No contents were opened, copied or changed.
for app in ['apps/commerce/web','apps/platform/identity','apps/merchant/web','apps/internal/console']:
 for suffix in ['.env','.env.local','.env.development','.env.development.local','.env.production','.env.production.local']:
  if (target/app/suffix).exists():raise RuntimeError('Unexpected environment file in task candidate')
record={'candidate':str(target),'source':str(source),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip(),'basis':'Source-only Git-listed test mirror; unchanged app-env refusal, no credentials copied; external libraries reused and workspace links rebased','sourceFiles':len(inventory),'dependencyLinks':links,'requiredParity':parity,'inventory':inventory}
(target/'n7-candidate-lineage.json').write_text(json.dumps(record,indent=2)+'\n')
receipt=source/'docs/implementation/niche-themes-2026-10-23/madeyours/n7-candidate-receipt.json';receipt.write_text(json.dumps({key:value for key,value in record.items() if key!='inventory'},indent=2)+'\n')
print(json.dumps({key:value for key,value in record.items() if key not in {'inventory','requiredParity'}},indent=2))
