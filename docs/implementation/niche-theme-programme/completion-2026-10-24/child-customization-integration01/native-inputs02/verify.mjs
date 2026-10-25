import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discover } from './capture.mjs';
const here=dirname(fileURLToPath(import.meta.url));
export function verify(captured, actual=discover()) {
  assert.equal(captured.suitePath,actual.suitePath);
  assert.equal(captured.migrationCeiling,null);
  assert.deepEqual(captured.files,actual.files,'All actual source hashes and inputs must match');
  assert.deepEqual(captured.runtimeModules,actual.runtimeModules,'All runtime inputs must be recursively traversed');
  assert.deepEqual(captured.edges,actual.edges,'Both actual Node/tsx and TypeScript edges must match');
  assert.deepEqual(captured.sqlSets,actual.sqlSets,'All current forward/rollback/bootstrap/deploy sets must match');
  assert.equal(captured.migrationCount,actual.migrationCount);assert.equal(captured.migrationMaximum,actual.migrationMaximum);
  return {files:actual.files.length,runtimeModules:actual.runtimeModules.length,edges:actual.edges.length,migrationCount:actual.migrationCount,migrationMaximum:actual.migrationMaximum};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const captured=JSON.parse(readFileSync(resolve(here,'source-closure.json'),'utf8')),actual=discover();
  const result=verify(captured,actual);
  const missing=structuredClone(captured);missing.files.splice(missing.files.findIndex(f=>f.path==='packages/theme-engine/src/first-party-theme-catalog.ts'),1);assert.throws(()=>verify(missing,actual));
  const corrupt=structuredClone(captured);corrupt.files[0].sha256='0'.repeat(64);assert.throws(()=>verify(corrupt,actual));
  const incomplete=structuredClone(captured);incomplete.runtimeModules=incomplete.runtimeModules.filter(p=>p!=='packages/theme-engine/src/first-party-theme-catalog.ts');assert.throws(()=>verify(incomplete,actual));
  process.stdout.write(JSON.stringify({status:'SOURCE_CLOSURE_AND_THREE_NEGATIVE_GUARDS_PASS_NOT_NATIVE_ADMISSION',...result,negativeControls:3,discoveredModulesExecuted:false})+'\n');
}
