// Independent rediscovery and in-memory negative controls; never starts a runner.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { discover } from './capture.mjs';
const here=dirname(fileURLToPath(import.meta.url));
export function verify(captured,actual){
  for(const key of ['root','suitePath','probePath','entryPoints','resolverEnvironment','files','runtimeModules','edges','externalResolutions','installedVendorPackages','installedVendorFiles','optionalInstalledAbsences','runtimeBootstrapFiles','node','nodeBuiltins','dependencyLayoutLinks','dependencyLayoutFiles','sqlSets','migrationCount','migrationMaximum','migrationCeiling','lateBoundControlInputs'])assert.deepEqual(captured[key],actual[key],'Incomplete or changed source/runtime input: '+key);
  assert.equal(captured.discoveredWorkerRunnerNativeModulesExecuted,false);
  assert.equal(captured.databaseDockerModuleLogBuildBrowserProviderActions,0);
  assert.equal(captured.migrationCount,322);assert.equal(captured.migrationMaximum,393);assert.equal(captured.migrationCeiling,null);
  assert(captured.edges.every(edge=>!edge.to.startsWith('apps/')));
  return {files:actual.files.length,runtimeModules:actual.runtimeModules.length,edges:actual.edges.length,vendorFiles:actual.installedVendorFiles.length,sourceOnly:true};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const captured=JSON.parse(readFileSync(resolve(here,'SOURCE_CLOSURE.json'),'utf8')),actual=discover();
  const result=verify(captured,actual),controls=[];
  const missing=structuredClone(captured);missing.files=missing.files.filter(file=>file.path!==captured.probePath);assert.throws(()=>verify(missing,actual));controls.push('missing-new-probe-source');
  const corrupt=structuredClone(captured);corrupt.files[0].sha256='0'.repeat(64);assert.throws(()=>verify(corrupt,actual));controls.push('corrupt-pinned-source');
  const incomplete=structuredClone(captured);incomplete.runtimeModules=incomplete.runtimeModules.filter(path=>path!=='services/api-gateway/src/__tests__/owned-db/plan-parser.ts');assert.throws(()=>verify(incomplete,actual));controls.push('incomplete-runtime-parser-closure');
  const vendor=structuredClone(captured);vendor.installedVendorFiles.splice(0,1);assert.throws(()=>verify(vendor,actual));controls.push('missing-installed-vendor-runtime-file');
  const exports=structuredClone(captured);exports.edges=exports.edges.filter(edge=>edge.kind!=='Node-tsx-import-condition');assert.throws(()=>verify(exports,actual));controls.push('missing-node-import-export-condition');
  const sql=structuredClone(captured);sql.sqlSets['database/supabase/rollback'].splice(0,1);assert.throws(()=>verify(sql,actual));controls.push('missing-current-rollback-set');
  const bootstrap=structuredClone(captured);bootstrap.runtimeBootstrapFiles[0].sha256='0'.repeat(64);assert.throws(()=>verify(bootstrap,actual));controls.push('corrupt-actual-node-bootstrap');
  const output={recordedAt:new Date().toISOString(),status:'INDEPENDENT_REDISCOVERY_AND_SEVEN_NEGATIVE_GUARDS_PASS_SOURCE_ONLY',...result,negativeControls:controls,closureSha256:createHash('sha256').update(readFileSync(resolve(here,'SOURCE_CLOSURE.json'))).digest('hex'),actualNativeAdmissionCreated:false,actualPreflightReceiptCreated:false,discoveredModulesExecuted:false};
  writeFileSync(resolve(here,'SOURCE_VERIFICATION.json'),JSON.stringify(output,null,2)+'\n',{flag:'wx'});
  process.stdout.write(JSON.stringify(output)+'\n');
}
