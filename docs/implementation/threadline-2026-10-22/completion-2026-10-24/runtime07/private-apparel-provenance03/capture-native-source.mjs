// Metadata-only recursive resolution. No discovered application module is imported.
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {discoverNativeSource}=require('./qualification-inputs.ts');
const closure=discoverNativeSource(process.cwd());
fs.writeFileSync('native-source-closure.json',JSON.stringify(closure,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({files:closure.files.length,modules:closure.runtimeModules.length,edges:closure.edges.length,tools:closure.toolDependencies.length,migrations:closure.migrationCount,max:closure.migrationMaximum,applicationModulesExecuted:false,nativeExecuted:false}));
