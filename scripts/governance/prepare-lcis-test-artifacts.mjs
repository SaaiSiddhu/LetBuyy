#!/usr/bin/env node
// Rebuild test prerequisites from source. No hosted data, model calls or fixture
// claims are added to the project graph. Missing tools/generators fail closed.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
function run(command,args){
    const result=spawnSync(command,args,{cwd:root,stdio:'inherit'});
    if(result.error){process.stderr.write(`LCIS test preparation: ${result.error.message}\n`);process.exit(1);}
    if(result.status!==0)process.exit(result.status??1);
}
run('graphify',['update','.','--no-cluster']);
for(const generator of ['db-intel','infra-intel','domain-intel','relationship-intel','memory-intel','execution-intel','runbook-engine']) {
    run(process.execPath,[`tools/graph-server/${generator}.mjs`]);
}
