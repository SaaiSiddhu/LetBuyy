"""Seal prepared source/runtime identities. Does not execute the native command."""
from pathlib import Path
from hashlib import sha256
from datetime import datetime,timezone
import json,os,shutil

root=Path('/Volumes/Projects/LetBuyy')
b=Path('/private/tmp/madeyours-checkout-reentry-proposal-20261024-06')
r=b/'packaging-receipts'
own=Path(__file__).parent
load=lambda p:json.loads(p.read_text())
digest=lambda p:sha256(p.read_bytes()).hexdigest()
save=lambda p,v:p.write_text(json.dumps(v,indent=2)+'\n')
pin=lambda p:{'path':str(p),'sha256':digest(p)}
assert not (r/'sealed-boundary.json').exists(), 'Never reseal/overwrite an admitted epoch'
m=load(r/'materialization.json');p=load(r/'runtime-preflight-03.json');cli=load(r/'cli-runtime-preflight.json');selected=load(r/'runner-selection.json')
assert p['admission']=='PASS_PREFLIGHT_ONLY_REVIEWER_NATIVE22_NEXT' and p['summary']['failures']==0
assert p['materializationSha256']==digest(r/'materialization.json')
assert p['preflightSha256']==digest(r/'preflight.mjs')
assert cli['scriptSha256']==digest(r/'cli-runtime-preflight.cjs')
assert all(cli['summary'][k]==0 for k in ['loadedMainSource','executedDeclarations','fetchCalls','socketCalls','subprocessCalls'])
assert selected==[x['path']for x in m['nativeSuites']],selected
assert sum(x['topLevelTests']for x in m['nativeSuites'])==22
assert len(m['files'])==1127
for f in m['files']:assert digest(b/f['path'])==f['sha256'],f['path']
for f in m['overlayFiles']:assert digest(b/f['path'])==f['proposalSha256'],f['path']
for f in cli['sharedThirdPartyRuntimeFiles']:assert digest(Path(f['path']))==f['sha256'],f['path']
for f in m['sharedThirdPartyPackages']:assert digest(Path(f['realPath'])/'package.json')==f['packageJsonSha256'],f['name']
for f in m['dependencyLinks']:assert str((b/f['path']).resolve())==f['realPath'],f['path']
assert digest(Path(m['tsxCli']['target']))==m['tsxCli']['sha256']

source={'classification':'SEALED06_1127_EXACT_PRIVATE_NATIVE_INPUTS','candidate':str(b),'sealed05':m['sealed05'],'entryRoots':selected,'files':m['files'],'overlays':m['overlayFiles'],'staticOnlyAppInputs':[f['path']for f in m['files']if f['path'].startswith('apps/')],'sourceMigrationMaximum':393,'sourceMigrationCount':322,'nativeExecuted':False}
save(r/'source-input-closure06.json',source)
metadata=[f for f in m['files']if Path(f['path']).name=='package.json' or Path(f['path']).name.startswith('tsconfig') or Path(f['path']).name=='runtime.manifest.json']
save(r/'runtime-package-metadata06.json',{'classification':'ACTUAL_UNMODIFIED_PACKAGE_EXPORT_IMPORT_CONFIG_METADATA','files':metadata,'workspacePackages':m['workspacePackages'],'defaultNativeLoader':'Node/tsx at candidate root with no inherited NODE_PATH/NODE_OPTIONS/TSX_TSCONFIG_PATH; normal package export conditions; gateway type-only paths are not used for runtime execution.'})
save(r/'dependency-links06.json',{'classification':'PRIVATE_WORKSPACE_REBINDING_AND_UNCHANGED_VENDOR_SHARING','links':m['dependencyLinks'],'tsxCli':m['tsxCli'],'omittedUnloadedWorkspaceAliases':m['omittedUnloadedWorkspaceAliases'],'noMainWorkspaceSourceLinks':True})
save(r/'shared-third-party06.json',{'classification':'SHARED_INSTALLED_THIRD_PARTY_IDENTITIES_NO_WORKSPACE_SOURCE','packages':m['sharedThirdPartyPackages'],'runtimeFilesLoadedByActualCLIWorkerImport':cli['sharedThirdPartyRuntimeFiles'],'runtimeResolvedEntries':p['external'],'sameLockfile':next(f for f in m['files']if f['path']=='pnpm-lock.yaml')})
args=['-u','NODE_PATH','-u','NODE_OPTIONS','-u','TSX_TSCONFIG_PATH','node','scripts/governance/run-executable-suites.mjs','--kind','gateway-db']
for path in selected:args+=['--suite',path]
args+=['--jobs','1','--timeout','180','--through-migration','393','--json']
command={'classification':'REVIEWER_NATIVE_COMMAND_PREPARED_NOT_EXECUTED','cwd':str(b),'executable':'env','arguments':args,'expectedSuites':m['nativeSuites'],'expectedTopLevelTests':22,'runnerSha256':digest(b/'scripts/governance/run-executable-suites.mjs'),'requireBeforeStart':'Independent reviewer verifies sealed-boundary/source/metadata/link/vendor hashes and current single native-lane allocation; refuse any mismatch before DB.','output':'Reviewer owns --log-dir/result output; choose an unused reviewer-owned path. Do not overwrite these source/preflight receipts.','mainApply':False,'browserLease':False,'providerCalls':'Local synthetic provider regressions only; actual Razorpay Test Mode remains a separate unrun gate.'}
save(r/'native-command06.json',command)
shutil.copyfile(r/'preflight.mjs',r/'preflight-03.mjs.txt')
shutil.copyfile(own/'prepare-native-candidate06.py',r/'prepare-native-candidate06.py.txt')
shutil.copyfile(Path(__file__),r/'seal-native06.py.txt')
boundaryNames=['materialization.json','materialization-01.json','source-input-closure06.json','runtime-package-metadata06.json','dependency-links06.json','shared-third-party06.json','native-command06.json','runtime-preflight-01.json','preflight-01.mjs.txt','preflight-01-adjudication.json','runtime-preflight-02.json','preflight-02.mjs.txt','runtime-preflight-03.json','preflight-03.mjs.txt','preflight.mjs','cli-runtime-preflight.cjs','cli-runtime-preflight.json','cli-ipc-sandbox-refusal.json','05-leak-reproduction.json','runner-inventory-refusal-and-correction.json','runner-selection.json','sealed05-literal-import-graph.json','sealed05-source-input-closure.json','prepare-native-candidate06.py.txt','seal-native06.py.txt']
boundary={'classification':'IMMUTABLE06_PRIVATE_NATIVE_SOURCE_RUNTIME_BOUNDARY_REVIEWER_ADMISSION_REQUIRED','sealedAt':datetime.now(timezone.utc).isoformat(),'candidate':str(b),'files':[pin(r/name)for name in boundaryNames],
 'summary':{'sourceFiles':1127,'sealed05InputsUnchanged':1071,'additionalRuntimeConfigs':16,'unchangedRegisteredInventoryFilesNotSelected':40,'workspacePackages':15,'packageManifests':sum(Path(f['path']).name=='package.json'for f in m['files']),'dependencyLinks':len(m['dependencyLinks']),'sharedThirdPartyPackages':len(m['sharedThirdPartyPackages']),'workspaceResolutions':p['summary']['workspaceResolutions'],'externalResolutions':p['summary']['externalResolutions'],'relativeResolutions':p['summary']['relativeResolutions'],'actualWorkerImportPrivateModules':cli['summary']['loadedPrivateModules'],'loadedMainSource':0,'declarationFilesExecuted':0,'providerNetworkCalls':0,'nativeTestsRun':0},
 'overlayByteIdentity':'All11 files exactly match sealed05 proposalSha256; packaging only, no implementation rewrite.',
 'preservedFailures':['05 default resolution escaped to Main and its canonical buyer-binding export was undefined','preflight01 checked a wrong named route export; canonical default export correction is isolated to the probe','tsx CLI IPC sandbox refusal before the script; exact bounded CLI run later approved and passed','Canonical runner list refused incomplete root inventory before any DB;40 actual registered sources copied byte-for-byte, never selected or stubbed'],
 'resources':{'mainSourceWrites':0,'sealed05Writes':0,'envCredentialsCopied':False,'nativeStarts':0,'databaseStarts':0,'browserActions':0,'providerCalls':0},'next':'One independent reviewer-owned22-case native batch only after exact boundary check; no other native lane, Main apply or browser handoff.'}
save(r/'sealed-boundary.json',boundary)
handoff={'schemaVersion':1,'classification':'CHECKOUT06_PACKAGING_READY_FOR_INDEPENDENT_NATIVE22_ADMISSION_NOT_NATIVE_ACCEPTANCE','sealedAt':boundary['sealedAt'],'candidate':str(b),'immutableBoundary':pin(r/'sealed-boundary.json'),'sourceManifest':pin(r/'source-input-closure06.json'),'runtimeMetadata':pin(r/'runtime-package-metadata06.json'),'dependencyLinks':pin(r/'dependency-links06.json'),'sharedThirdPartyIdentity':pin(r/'shared-third-party06.json'),'preflight':pin(r/'runtime-preflight-03.json'),'exactCliPreflight':pin(r/'cli-runtime-preflight.json'),'nativeCommand':pin(r/'native-command06.json'),'sealed05':m['sealed05'],'summary':boundary['summary'],'implementationChanges':0,'nativeStatus':'NOT_RUN_REVIEWER_SINGLE_LANE_NEXT','madeYoursBrowserCases':{'run':0,'notRun':23},'mainAndBrowserLease':None,'preservation':boundary['resources'],'next':'Independent reviewer rechecks and runs exact22 in its owned output lane. Do not alter06, repeat completed implementation or execute another native cohort here.'}
save(own/'CHECKOUT_RUNTIME_HANDOFF06.json',handoff)
print(json.dumps({'boundarySha256':handoff['immutableBoundary']['sha256'],'sourceSha256':handoff['sourceManifest']['sha256'],'metadataSha256':handoff['runtimeMetadata']['sha256'],'linkSha256':handoff['dependencyLinks']['sha256'],'nativeCommandSha256':handoff['nativeCommand']['sha256'],'sourceFiles':1127,'overlayUnchanged':11,'preflight':'PASS','nativeTestsRun':0}))
