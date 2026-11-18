// Owner decision OWNER_NATIVE418_SOURCE_FREEZE_20261115. This is one exact
// source preservation contract, never an arbitrary migration skip mechanism.
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,readdirSync,realpathSync} from 'node:fs';
import {join,relative,resolve,sep} from 'node:path';

export const NATIVE_AUTH_FREEZE_MANIFEST='config/supabase/native-auth-source-freeze.json';
const APPROVED_MANIFEST_SHA256='0d7b2fe82789253022b19ab7931f7438e1996c4a47feaf2413720c26d65d81c4';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function regularFile(root,path) {
    const absolute=resolve(root,path),base=realpathSync(root);
    if(relative(resolve(root),absolute).startsWith('..'))throw new Error('Native source freeze path escapes its checkout');
    let current=resolve(root);
    for(const component of relative(resolve(root),absolute).split(sep)) {
        current=join(current,component);
        if(lstatSync(current).isSymbolicLink())throw new Error('Native source freeze refuses linked preservation paths');
    }
    if(!lstatSync(absolute).isFile()||!realpathSync(absolute).startsWith(base+sep))throw new Error('Native source freeze requires an owned regular file');
    return readFileSync(absolute);
}
export function loadNativeAuthSourceFreeze(root) {
    if(!existsSync(join(root,NATIVE_AUTH_FREEZE_MANIFEST)))return null;
    const bytes=regularFile(root,NATIVE_AUTH_FREEZE_MANIFEST);
    if(hash(bytes)!==APPROVED_MANIFEST_SHA256)throw new Error('Native source freeze declaration differs from the exact owner-approved contract');
    const manifest=JSON.parse(bytes);
    for(const entry of manifest.files) {
        if(hash(regularFile(root,entry.preservedPath))!==entry.sha256)throw new Error('Native source freeze preserved SQL hash changed: '+entry.name);
        const original=join(root,entry.originalPath);
        if(existsSync(original))throw new Error('Native source freeze has contradictory active SQL: '+entry.name);
        // A broken link is still a contradictory active entry.
        try {lstatSync(original);throw new Error('Native source freeze has an unexpected active entry: '+entry.name);}
        catch(error){if(error.code!=='ENOENT')throw error;}
    }
    const expected=new Set(manifest.files.map(entry=>entry.preservedPath));
    expected.add('docs/implementation/native-signin-source-preservation/README.md');
    const walk=directory=>{
        for(const entry of readdirSync(join(root,directory),{withFileTypes:true})) {
            const path=directory+'/'+entry.name;
            if(entry.isSymbolicLink())throw new Error('Native source freeze refuses linked evidence');
            if(entry.isDirectory())walk(path);
            else if(!expected.has(path))throw new Error('Native source freeze contains undeclared evidence: '+path);
        }
    };
    walk('docs/implementation/native-signin-source-preservation');
    regularFile(root,manifest.nativeMigration);
    regularFile(root,'database/supabase/rollback/418_merchant_accounts_mobile_handoff.rollback.sql');
    const active=readdirSync(join(root,'database/supabase/migrations')).filter(name=>/^\d+_.*\.sql$/.test(name));
    const tail=active.filter(name=>parseInt(name,10)>414);
    if(tail.length!==1||tail[0]!=='418_merchant_accounts_mobile_handoff.sql'||!active.includes('414_gift_card_issue_replay_integrity.sql'))throw new Error('Native source freeze is stale or has an unexpected active sequence');
    return manifest;
}
// Only owned fixtures may reconstruct recorded staging identities from evidence.
// Active migration discovery never calls this function or executes held SQL.
export function readNativeAuthHistoricalSource(root,kind,name) {
    if(!['migrations','rollback'].includes(kind)||name.includes('/')||name.includes('\\'))throw new Error('Invalid historical native source request');
    const active=join(root,'database/supabase',kind,name);
    if(existsSync(active))return regularFile(root,relative(root,active)).toString('utf8');
    const manifest=loadNativeAuthSourceFreeze(root);
    const entry=manifest?.files.find(entry=>entry.kind===kind&&entry.name===name);
    if(!entry)throw new Error('Unknown held native migration source: '+name);
    return regularFile(root,entry.preservedPath).toString('utf8');
}
