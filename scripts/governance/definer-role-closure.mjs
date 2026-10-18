// Shared source tripwire for named definer closure. Actual role behavior is proved in the owned database lane.
export const stripSqlComments = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');

// Names of functions created with SECURITY DEFINER. The header runs from CREATE to the body's opening
// dollar quote, which is where SECURITY DEFINER has to appear.
export function definerFunctions(sql) {
    const source = stripSqlComments(sql);
    const names = [];
    const pattern = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-z0-9_]+)\s*\(([\s\S]*?)\bAS\s+\$[a-z_]*\$/gi;
    let match;
    while ((match = pattern.exec(source))) {
        if (/\bSECURITY\s+DEFINER\b/i.test(match[0])) names.push(match[1]);
    }
    return [...new Set(names)];
}

// A privilege statement may name several function signatures. Commas inside
// argument lists are not separators; select by public function name within the
// whole ON FUNCTION list rather than requiring it to be first in that list.
function privilegeChanges(sql, name) {
    const statements = stripSqlComments(sql).matchAll(/(REVOKE|GRANT)\s+(?:ALL(?:\s+PRIVILEGES)?|EXECUTE)\s+ON\s+FUNCTION\s+([^;]*?)\b(?:FROM|TO)\s+([^;]+);/gi);
    const namesFunction = new RegExp(`\\bpublic\\.${name}\\s*\\(`, 'i');
    return [...statements].filter(statement => namesFunction.test(statement[2]));
}

// The roles a migration revokes EXECUTE (or ALL) from, for one function, across every REVOKE naming it.
export function revokedRoles(sql, name) {
    const roles = new Set();
    for (const statement of privilegeChanges(sql, name)) {
        if (statement[1].toLowerCase() !== 'revoke') continue;
        for (const role of statement[3].split(',')) roles.add(role.trim().toLowerCase());
    }
    return roles;
}

export function offenders(sql) {
    return definerFunctions(sql).filter((name) => {
        const roles = revokedRoles(sql, name);
        return !['public', 'anon', 'authenticated'].every((role) => roles.has(role));
    });
}


/** Names created with definer authority, regardless of later replacement: used to bind a forward closure to the actual catalog. */
export function governedDefinerNames(migrations, fromExclusive=256) {
    return [...new Set(migrations.filter(m=>m.number>fromExclusive).flatMap(m=>definerFunctions(m.sql)))].sort();
}

/** Named revocations count only after the latest definition; a later grant can reopen them. */
export function currentDefinerClosureOffenders(migrations, fromExclusive=256) {
    const ordered=[...migrations].sort((a,b)=>a.number-b.number||a.name.localeCompare(b.name));
    const definitions=new Map();
    for(let index=0;index<ordered.length;index++) {
        const migration=ordered[index];
        if(migration.number<=fromExclusive)continue;
        const sql=stripSqlComments(migration.sql);
        const headers=/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-z0-9_]+)\s*\([\s\S]*?\bAS\s+\$[a-z_]*\$/gi;
        for(const header of sql.matchAll(headers)) {
            if(/\bSECURITY\s+DEFINER\b/i.test(header[0])) definitions.set(header[1],{index,offset:header.index,name:migration.name});
            else definitions.delete(header[1]);
        }
    }
    const missing=[];
    for(const [name,definition] of definitions) {
        const suffix=ordered.slice(definition.index).map((m,i)=>i===0?stripSqlComments(m.sql).slice(definition.offset):stripSqlComments(m.sql)).join('\n');
        const closed=new Set();
        for(const change of privilegeChanges(suffix,name)) {
            const roles=change[3].split(',').map(r=>r.trim().toLowerCase());
            if(change[1].toLowerCase()==='revoke')for(const role of roles)closed.add(role);
            else {
                // Dynamic grantees are not proof of a backend-only grant. A later
                // explicit closure must follow them; direct Data API grants reopen.
                if(roles.some(role=>!/^([a-z_][a-z0-9_]*|"[a-z_][a-z0-9_]*")(?: with grant option)?$/i.test(role)))closed.clear();
                for(const role of roles)closed.delete(role.replace(/ with grant option$/,''));
            }
        }
        if(!['public','anon','authenticated'].every(role=>closed.has(role)))missing.push(`${definition.name}: public.${name}`);
    }
    return missing.sort();
}
