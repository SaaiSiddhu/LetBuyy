// Owned local qualification only. These profiles reproduce the owner-approved
// hosted native418 sequence; they do not change the default complete-schema lane.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

export const NATIVE_AUTH_MIGRATION_PROFILES=Object.freeze([
    'native-auth-production-413-418',
    'native-auth-staging-415-418',
]);
export function parseNativeAuthMigrationProfile(value) {
    if(value===undefined)return undefined;
    if(!NATIVE_AUTH_MIGRATION_PROFILES.includes(value))throw new Error('Unknown native auth migration profile');
    return value;
}
const hash=value=>createHash('sha256').update(value).digest('hex');
export function nativeAuthMigrationEntries(repoRoot,names,profile) {
    parseNativeAuthMigrationProfile(profile);
    if(profile===undefined)throw new Error('An explicit native auth migration profile is required');
    const read=name=>readFileSync(join(repoRoot,'database/supabase/migrations',name),'utf8');
    const selected=names.filter(name=>parseInt(name,10)<=413).map(name=>({name,source:read(name)}));
    if(!selected.some(entry=>entry.name==='413_shipping_profile_commands.sql'))throw new Error('Native auth baseline413 is missing');
    const native=names.filter(name=>parseInt(name,10)===418);
    if(native.length!==1||native[0]!=='418_merchant_accounts_mobile_handoff.sql')throw new Error('Native auth migration418 is missing or ambiguous');
    if(profile==='native-auth-staging-415-418') {
        const registry=JSON.parse(readFileSync(join(repoRoot,'config/supabase/history-aliases.json'),'utf8'));
        if(registry.aliases.length!==2)throw new Error('Unexpected staging migration aliases');
        for(const alias of registry.aliases) {
            if(!['414_atomic_warehouse_commands.sql','415_gift_card_issue_replay_integrity.sql'].includes(alias.recorded_name))throw new Error('Unexpected staging migration identity');
            const canonical=read(alias.canonical_name);
            if(hash(canonical)!==alias.canonical_source_sha256)throw new Error('Staging canonical source hash changed');
            const source=alias.recorded_name==='414_atomic_warehouse_commands.sql'
                ?canonical.replaceAll("migration='415'","migration='414'").replaceAll("VALUES('415',","VALUES('414',").replaceAll("SELECT '415',","SELECT '414',")
                :canonical;
            if(hash(source)!==alias.recorded_source_sha256)throw new Error('Staging historical execution source hash changed');
            selected.push({name:alias.recorded_name,source,canonicalName:alias.canonical_name,canonicalSha256:hash(canonical)});
        }
    }
    selected.push({name:native[0],source:read(native[0])});
    return selected;
}
