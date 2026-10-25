import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkCompleteInventory} from './check-complete-inventory.v4.mjs';
const inventory=JSON.parse(readFileSync(new URL('./source-input-closure.v4.json',import.meta.url))),graph=JSON.parse(readFileSync(new URL('./literal-import-graph.v4.json',import.meta.url)));
const missing=structuredClone(inventory);missing.files=missing.files.filter(f=>f.path!=='packages/theme-engine/src/dewdrop-theme-v201.ts');assert.throws(()=>checkCompleteInventory(missing,graph),/Missing actual recursive input/);
const skipped=structuredClone(graph);skipped.runtimeModules=skipped.runtimeModules.filter(p=>p!=='packages/theme-engine/src/first-party-theme-catalog.ts');assert.throws(()=>checkCompleteInventory(inventory,skipped),/Collector must traverse/);
const omitted=structuredClone(graph);omitted.edges=omitted.edges.slice(1);assert.throws(()=>checkCompleteInventory(inventory,omitted),/Complete literal runtime/);
process.stdout.write(JSON.stringify({negativeControls:3,pass:3,fail:0,nativeExecuted:false,MainInputsChanged:false})+'\n');
