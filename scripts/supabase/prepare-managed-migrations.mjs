#!/usr/bin/env node
// Offline preparation only. No database connection or provider mutation.
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {compileManagedMigrationBatch,compileManagedJournalBatch} from './managed-migration-artifact.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const {values}=parseArgs({options:{revision:{type:'string'},direction:{type:'string',default:'up'},
    from:{type:'string'},through:{type:'string'},names:{type:'string'},out:{type:'string'},'history-sha256':{type:'string'},
    'ack-trusted-admin-maintenance':{type:'boolean',default:false}}});
const hash=text=>createHash('sha256').update(text).digest('hex');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});
try {
    if(!values['ack-trusted-admin-maintenance'])throw new Error('Explicit trusted-administrator maintenance-model acknowledgement is required');
    if(!/^[0-9a-f]{40}$/.test(values.revision??''))throw new Error('--revision must be a complete commit SHA');
    if(!['up','down'].includes(values.direction))throw new Error('--direction must be up or down');
    if(!values.out)throw new Error('--out must name a new directory outside the checkout');
    if(git(['rev-parse','HEAD']).trim()!==values.revision)throw new Error('The selected commit must be the current checkout HEAD');
    if(git(['status','--porcelain']).trim())throw new Error('Artifact preparation requires a clean tracked and untracked source tree');
    const output=join(realpathSync(dirname(resolve(values.out))),resolve(values.out).split('/').at(-1));
    const outputRelative=relative(realpathSync(root),output);
    if(!outputRelative||(!outputRelative.startsWith('..'+(process.platform==='win32'?'\\':'/'))&&!isAbsolute(outputRelative))) {
        throw new Error('Artifact output must be outside the source checkout');
    }
    const adapterFiles=[
        'scripts/supabase/prepare-managed-migrations.mjs','scripts/supabase/managed-migration-artifact.mjs',
        'scripts/governance/managed-catalog-fence.mjs','scripts/governance/definer-role-closure.mjs',
        'database/supabase/deploy/managed-migration-admission-v1.sql',
    ];
    const adapterHashes={};
    for(const path of adapterFiles) {
        const committed=git(['show',values.revision+':'+path]);
        if(hash(readFileSync(join(root,path)))!==hash(committed))throw new Error('Adapter file does not match the pinned revision: '+path);
        adapterHashes[path]=hash(committed);
    }
    const folder='database/supabase/'+(values.direction==='up'?'migrations':'rollback');
    const available=git(['ls-tree','-r','--name-only',values.revision,'--',folder]).trim().split('\n').filter(Boolean);
    let selected;
    if(values.names) {
        if(values.from!==undefined||values.through!==undefined)throw new Error('Select a names file or a range, not both');
        const names=JSON.parse(readFileSync(values.names,'utf8'));
        if(!Array.isArray(names)||!names.length||names.some(name=>typeof name!=='string'||!/^\d{3}_[a-z0-9_]+(?:\.rollback)?\.sql$/.test(name))
           ||new Set(names).size!==names.length)throw new Error('The names file must contain unique canonical migration basenames');
        selected=names.map(name=>folder+'/'+name);
        if(selected.some(path=>!available.includes(path)))throw new Error('The names file refers to a migration absent from the pinned source');
    } else {
        if(!/^\d{1,3}$/.test(values.from??'')||!/^\d{1,3}$/.test(values.through??'')||Number(values.from)>Number(values.through)) {
            throw new Error('--from and --through must specify an increasing inclusive source range');
        }
        selected=available.filter(path=>{const number=Number(path.slice(folder.length+1,folder.length+4));return number>=Number(values.from)&&number<=Number(values.through);});
    }
    selected.sort((a,b)=>Number(a.slice(folder.length+1,folder.length+4))-Number(b.slice(folder.length+1,folder.length+4))||a.localeCompare(b));
    if(values.direction==='down')selected.reverse();
    const entries=selected.map(path=>({name:path.slice(folder.length+1),source:git(['show',values.revision+':'+path])}));
    const artifact=values['history-sha256']
        ?compileManagedJournalBatch(entries,randomUUID(),{expectedHistorySha256:values['history-sha256'],direction:values.direction,
            forwardEntries:values.direction==='down'?entries.map(entry=>{const name=entry.name.replace('.rollback.sql','.sql');
                return {name,source:git(['show',values.revision+':database/supabase/migrations/'+name])};}):[]})
        :compileManagedMigrationBatch(entries,randomUUID());
    const manifest={...artifact.manifest,sourceRevision:values.revision,adapterHashes,direction:values.direction,
        sourcePaths:selected,preparationOnly:true,journaled:Boolean(values['history-sha256']),
        requiresFreshBackupRestoreRehearsalAndStagingAcceptance:true};
    mkdirSync(output,{mode:0o700});
    writeFileSync(join(output,'artifact.sql'),artifact.sql,{mode:0o600,flag:'wx'});
    writeFileSync(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600,flag:'wx'});
    process.stdout.write(JSON.stringify({prepared:true,executed:false,migrations:selected.length,
        sourceRevision:values.revision,manifest:join(output,'manifest.json'),batchSha256:manifest.batchSha256})+'\n');
} catch(error) {
    // Do not print subprocess buffers: they may include SQL or future private input.
    process.stderr.write('Managed migration artifact refused: '+(error instanceof Error&&!('stderr' in error)?error.message:'source verification failed')+'\n');
    process.exitCode=1;
}
