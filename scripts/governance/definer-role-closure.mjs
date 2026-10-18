// Conservative source tripwire; actual catalog/role behavior belongs to the owned DB lane.
export function sqlTokens(sql) {
    const out = [];
    for (let i = 0; i < sql.length;) {
        const start = i, rest = sql.slice(i);
        if (/^\s/.test(rest)) { i++; continue; }
        if (rest.startsWith('--')) { i = sql.indexOf('\n', i); if (i < 0) break; continue; }
        if (rest.startsWith('/*')) {
            let depth = 1; i += 2;
            while (i < sql.length && depth) {
                if (sql.startsWith('/*', i)) { depth++; i += 2; }
                else if (sql.startsWith('*/', i)) { depth--; i += 2; }
                else i++;
            }
            if (depth) throw new SyntaxError('Unclosed SQL comment');
            continue;
        }
        if (rest[0] === "'" || rest[0] === '"') {
            const quote = rest[0]; let value = '', closed = false; i++;
            while (i < sql.length) {
                if (sql[i] === quote) {
                    if (sql[i + 1] === quote) { value += quote; i += 2; continue; }
                    i++; closed = true; break;
                }
                value += sql[i++];
            }
            if (!closed) throw new SyntaxError('Unclosed SQL literal');
            out.push({kind: quote === "'" ? 'string' : 'identifier', value, start, end:i}); continue;
        }
        const dollar = rest.match(/^\$(?:[a-z_][a-z0-9_]*)?\$/i)?.[0];
        if (dollar) {
            const end = sql.indexOf(dollar, i + dollar.length);
            if (end < 0) throw new SyntaxError('Unclosed SQL body');
            i = end + dollar.length;
            out.push({kind:'body', value:sql.slice(start + dollar.length, end), start, end:i}); continue;
        }
        const word = rest.match(/^[a-z_][a-z0-9_$]*|^\d+/i)?.[0];
        if (word) { i += word.length; out.push({kind:'word', value:word.toLowerCase(), start, end:i}); continue; }
        const symbol = rest.match(/^(?:\|\||::|<>|!=|:=|<=|>=)/)?.[0] ?? rest[0];
        i += symbol.length; out.push({kind:'symbol', value:symbol, start, end:i});
    }
    return out;
}
// Comments disappear; literals/bodies remain distinct tokens and retain their real contents.
export const tokenText = tokens => tokens.map(t => t.kind === 'string' ? "'" + t.value.replaceAll("'", "''") + "'" : t.value).join(' ');
export const normalizedSql = sql => tokenText(sqlTokens(sql));
export function sqlStatements(sql) {
    const rows = []; let current = [];
    for (const token of sqlTokens(sql)) {
        current.push(token);
        if (token.value === ';' && token.kind === 'symbol') { rows.push(current); current = []; }
    }
    if (current.length) rows.push(current);
    return rows;
}
export const stripSqlComments = sql => {
    const chars = sql.split('').map(c => c === '\n' ? '\n' : ' ');
    for (const t of sqlTokens(sql)) for (let i = t.start; i < t.end; i++) chars[i] = sql[i];
    return chars.join('');
};
export function splitSqlList(tokens) {
    const groups = []; let group = [], depth = 0;
    for (const t of tokens) {
        if (t.kind === 'symbol' && ['(', '['].includes(t.value)) depth++;
        if (t.kind === 'symbol' && [')', ']'].includes(t.value)) depth--;
        if (depth < 0) throw new SyntaxError('Unbalanced SQL list');
        if (t.value === ',' && depth === 0) { groups.push(group); group = []; }
        else group.push(t);
    }
    if (depth) throw new SyntaxError('Unbalanced SQL list');
    if (group.length) groups.push(group);
    return groups;
}
const typeName = tokens => tokenText(tokens).replaceAll('pg_catalog . ', '').replaceAll(' [ ]', '[]')
    .replace(/^int4$|^int$/, 'integer').replace(/^int8$/, 'bigint').replace(/^bool$/, 'boolean')
    .replace(/^timestamp with time zone$/, 'timestamptz').replace(/^timestamp without time zone$/, 'timestamp');
export function functionIdentity(signature) {
    const match = signature.match(/^public\s*\.\s*([a-z_][a-z0-9_]*)\s*\(([^()]*)\)$/i);
    if (!match) return null;
    const types = splitSqlList(sqlTokens(match[2])).map(typeName);
    if (types.some(t => !/^[a-z_][a-z0-9_]*(?:\[\])?$/.test(t))) return null;
    return `public.${match[1].toLowerCase()}(${types.join(',')})`;
}
export function functionDefinitions(sql) {
    const found = [];
    for (const statement of sqlStatements(sql)) {
        const text = tokenText(statement);
        if (!/^create (?:or replace )?function public \./.test(text)) continue;
        const open = statement.findIndex(t => t.value === '('); let depth = 1, end = open + 1;
        for (; end < statement.length && depth; end++) {
            if (statement[end].value === '(') depth++;
            if (statement[end].value === ')') depth--;
        }
        if (depth || open < 0) throw new SyntaxError('Unknown function header');
        const name = statement[open - 1].value;
        const args = splitSqlList(statement.slice(open + 1, end - 1));
        const inputNames = [], types = [];
        for (let arg of args) {
            const mode = /^(in|inout|out|variadic)$/.test(arg[0]?.value) ? arg.shift().value : 'in';
            if (mode === 'out') continue;
            const stop = arg.findIndex(t => ['default', '='].includes(t.value));
            if (stop >= 0) arg = arg.slice(0, stop);
            inputNames.push(arg[0]?.value); types.push(typeName(arg.slice(1)));
        }
        const identity = statement.slice(0,end).some(t=>t.kind==='identifier') ? null : functionIdentity(`public.${name}(${types.join(',')})`);
        found.push({name, identity, inputNames, definer:/\bsecurity definer\b/.test(tokenText(statement.slice(end).filter(t => t.kind !== 'body'))), start:statement[0].start});
    }
    return found;
}
export const definerFunctions = sql => [...new Set(functionDefinitions(sql).filter(f => f.definer).map(f => f.name))];
function directPrivileges(tokens) {
    // Body/string tokens cannot masquerade as an executable top-level ACL.
    if (tokens.some(t => ['body','string','identifier'].includes(t.kind))) return null;
    const match = tokenText(tokens).match(/^(revoke|grant) (?:all(?: privileges)?|execute) on function ([\s\S]*?) (from|to) ([\s\S]*?) ;$/);
    if (!match || ((match[1] === 'revoke') !== (match[3] === 'from'))) return null;
    const signatures = match[2].split(/\) , /).map((s, i, rows) => functionIdentity(i < rows.length - 1 ? s + ')' : s));
    const roles = match[4].split(' , ').map(r => r.replace(/ with grant option$/, ''));
    if (signatures.some(s => !s) || roles.some(r => !/^[a-z_][a-z0-9_]*$/.test(r))) return null;
    return {action:match[1], signatures, roles};
}
// Entire executable grammar must match: one text variable, literal signatures,
// unconditional literal-prefix/suffix EXECUTEs. No IF/EXIT/assignment/nested loop.
function finitePrivileges(body) {
    const match = normalizedSql(body).match(/^declare ([a-z_][a-z0-9_]*) text ; begin foreach \1 in array array \[ ([\s\S]*?) \] loop ([\s\S]*?) end loop ; end(?: ;)?$/);
    if (!match) return null;
    const rows = splitSqlList(sqlTokens(match[2]));
    if (!rows.length || rows.some(row => row.length !== 1 || row[0].kind !== 'string')) return null;
    const signatures = rows.map(row => functionIdentity(row[0].value));
    if (signatures.some(s => !s) || new Set(signatures).size !== signatures.length) return null;
    const changes = [];
    for (const statement of sqlStatements(match[3])) {
        if (statement.length !== 7 || statement[0].value !== 'execute' || statement[1].kind !== 'string' || statement[2].value !== '||' || statement[3].value !== match[1] || statement[4].value !== '||' || statement[5].kind !== 'string' || statement[6].value !== ';') return null;
        for (const signature of signatures) {
            const change = directPrivileges(sqlTokens(statement[1].value + signature + statement[5].value + ';'));
            if (!change) return null;
            changes.push(change);
        }
    }
    return changes.length ? changes : null;
}
// Negative evidence only. Conditional/dynamic ACLs never close a function. Bind
// an uncertain change to a target only when that target is literal or its sole
// assignment is a literal signature / a FOREACH over a constant literal array.
function splitAtSemicolons(tokens) {
    const rows=[];let row=[];
    for(const token of tokens) {if(token.kind==='symbol' && token.value===';'){rows.push(row);row=[];}else row.push(token);}
    if(row.length)rows.push(row);return rows;
}
// These statements cannot alter function ACLs. Match the whole format call:
// literal-escaped custom configuration, or a table-only GRANT whose identifiers
// and privileges come from one finite, unmodified VALUES record.
function nonFunctionDynamicStatement(expression, tokens) {
    if (expression[0]?.value !== 'format' || expression[1]?.value !== '(' || expression.at(-1)?.value !== ')' || expression[2]?.kind !== 'string') return false;
    const template = expression[2].value;
    const config = template.match(/^ALTER FUNCTION (public\.[a-z_][a-z0-9_]*\([^()]*\)) SET [a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*=%L$/i);
    if (config && functionIdentity(config[1]) && expression[3]?.value === ',' && expression.length > 5) {
        // No trailing concatenation or second SQL statement can follow format().
        let depth = 0;
        return expression.slice(4,-1).every(t => {
            if (t.value === '(') depth++;
            if (t.value === ')') depth--;
            return depth >= 0 && ![';', '||', ','].includes(t.value);
        }) && depth === 0;
    }
    if (template !== 'GRANT %s ON TABLE %s TO service_role') return false;
    const match = tokenText(expression).match(/^format \( '[^']+' , ([a-z_][a-z0-9_]*) \. permission , \1 \. signature \)$/);
    if (!match) return false;
    const record = match[1];
    const structural = tokenText(tokens.map(t => ['string','body'].includes(t.kind) ? {...t,kind:'symbol',value:'#'} : t));
    if (new RegExp('\\b' + record + ' (?:\\:=|=)|\\b' + record + ' \\. [a-z_]+ (?:\\:=|=)|\\binto ' + record + '\\b|\\bcall\\b').test(structural)) return false;
    if (new RegExp('\\bforeach ' + record + '\\b').test(structural)) return false;
    if ([...structural.matchAll(new RegExp('\\bfor ' + record + ' in\\b','g'))].length !== 1) return false;
    const text = tokenText(tokens);
    const head = text.match(new RegExp('for ' + record + ' in select \\* from \\( values ([\\s\\S]*?) \\) as [a-z_][a-z0-9_]* \\( signature , permission \\) loop'));
    if (!head) return false;
    const rows = splitSqlList(sqlTokens(head[1]));
    return rows.length > 0 && rows.every(row => {
        if (row[0]?.value !== '(' || row.at(-1)?.value !== ')') return false;
        const cells = splitSqlList(row.slice(1,-1));
        return cells.length === 2 && cells.every(cell => cell.length === 1 && cell[0].kind === 'string')
            && /^public\.[a-z_][a-z0-9_]*$/.test(cells[0][0].value)
            && /^(?:SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)$/.test(cells[1][0].value);
    });
}
function uncertainPrivileges(body) {
    const tokens = sqlTokens(body), events = [], bindings = new Map(), parents = new Map();
    const structural = tokenText(tokens.map(t => ['string','body'].includes(t.kind) ? {...t,value:'#',kind:'symbol'} : t));
    const begin=tokens.findIndex(t=>t.kind==='word' && t.value==='begin');
    if(tokens[0]?.value==='declare' && begin>0) {
        for(const declaration of splitAtSemicolons(tokens.slice(1,begin))) {
            const name=declaration[0]?.value, assign=declaration.findIndex(t=>t.value===':=');
            const type=tokenText(declaration.slice(1,assign));
            const value=declaration.slice(assign+1);
            if(assign<0 || declaration[0]?.kind!=='word')continue;
            if(['text','constant text'].includes(type) && value.length===1 && value[0].kind==='string' && functionIdentity(value[0].value)) bindings.set(name,[functionIdentity(value[0].value)]);
            if(type==='constant text [ ]' && value[0]?.value==='array' && value[1]?.value==='[' && value.at(-1)?.value===']') {
                const rows=splitSqlList(value.slice(2,-1));
                if(rows.length && rows.every(r=>r.length===1 && r[0].kind==='string' && functionIdentity(r[0].value)))bindings.set(name,rows.map(r=>functionIdentity(r[0].value)));
            }
        }
    }
    for(const m of structural.matchAll(/foreach ([a-z_][a-z0-9_]*) in array ([a-z_][a-z0-9_]*) loop/g))if(bindings.has(m[2])) {bindings.set(m[1],bindings.get(m[2]));parents.set(m[1],m[2]);}
    for(const name of bindings.keys()) {
        const executable=tokenText(tokens.slice(begin+1).map(t=>['string','body'].includes(t.kind)?{...t,value:'#',kind:'symbol'}:t));
        const intoTarget=tokens.some((t,i)=>t.kind==='word' && t.value==='into' && tokens[i-1]?.value!=='insert' && tokens.slice(i+1, tokens.findIndex((v,j)=>j>i && (v.value===';' || (v.kind==='word' && v.value==='from')))).some(v=>v.kind==='word' && v.value===name));
        if(new RegExp(`\\b${name} (?:\\:=|=)|\\bfor ${name} in\\b`).test(executable) || intoTarget || /\bcall\b/.test(executable) || (!parents.has(name) && new RegExp(`\\bforeach ${name}\\b`).test(executable)))bindings.delete(name);
        if(parents.has(name) && ([...structural.matchAll(new RegExp(`\\bforeach ${name}\\b`,'g'))].length!==1 || !bindings.has(parents.get(name))))bindings.delete(name);
    }
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].kind !== 'word') continue;
        if (['grant','revoke'].includes(tokens[i].value)) {
            const end = tokens.findIndex((t,j) => j >= i && t.value === ';');
            const change = directPrivileges(tokens.slice(i,end+1));
            if (change) events.push({action:'unknown',signatures:change.signatures});
        }
        if (tokens[i].value !== 'execute' || ['grant','revoke'].includes(tokens[i-1]?.value)) continue;
        const end = tokens.findIndex((t,j) => j > i && t.value === ';');
        const expression = tokens.slice(i+1,end);
        if (nonFunctionDynamicStatement(expression, tokens)) continue;
        const first = expression[0]?.value === 'format' ? expression[2] : expression[0];
        if (first?.kind !== 'string') { events.push({action:'unknown'}); continue; }
        // This tripwire concerns function ACLs. Literal table/policy commands
        // have separate canonical privilege-journal tests; they are not closure evidence.
        if (!/\bon\s+function\b/i.test(first.value)) {
            if (!/^(?:revoke\b[\s\S]*\bon\s+table\b|alter policy\b|create policy\b)/i.test(first.value)) events.push({action:'unknown'});
            continue;
        }
        let signatures;
        // A fixed target list plus a single identifier-escaped grantee cannot name
        // another function. Unknown format expressions/concatenations stay unbound.
        const fixed=first.value.match(/^(?:GRANT (?:ALL|EXECUTE)|REVOKE (?:ALL|EXECUTE)) ON FUNCTION ([\s\S]+?) (?:TO|FROM) (?:%I|[a-z_, ]+)$/i);
        const format=expression[0]?.value==='format' && expression.length===6 && expression[1]?.value==='(' && expression[3]?.value===',' && expression[4]?.kind==='word' && expression[5]?.value===')';
        if(fixed && (expression.length===1 || format)) {
            const list=splitSqlList(sqlTokens(fixed[1]));
            const parsed=list.map(row=>functionIdentity(tokenText(row)));
            if(parsed.length && parsed.every(Boolean))signatures=parsed;
        }
        const bound=expression[1]?.value==='||' && expression[2]?.kind==='word' ? bindings.get(expression[2].value) : null;
        if(bound) {
            const prefix=first.value, tail=expression.slice(3);
            const literalTail=tail.length===2 && tail[0].value==='||' && tail[1].kind==='string' && /^ (?:TO service_role(?: WITH GRANT OPTION)?|FROM PUBLIC,anon,authenticated,app_tenant(?: RESTRICT)?)$/i.test(tail[1].value);
            const optionalGrant=normalizedSql("|| ' TO service_role' || CASE WHEN v_grantable THEN ' WITH GRANT OPTION' ELSE '' END");
            const safeOptional=tokenText(tail)===optionalGrant;
            if(/^(?:GRANT EXECUTE|REVOKE ALL) ON FUNCTION $/i.test(prefix) && (literalTail || safeOptional))signatures=bound;
        }
        events.push({action:'unknown',signatures});
    }
    return events;
}
function privilegeEvents(sql) {
    const events = [];
    for (const tokens of sqlStatements(sql)) {
        const direct = directPrivileges(tokens);
        if (direct) events.push({...direct, start:tokens[0].start});
        else if (tokens[0]?.value === 'do') {
            const body = tokens.length === 3 && tokens[1].kind === 'body' && tokens[2].value === ';' ? tokens[1] : null;
            const finite = body && finitePrivileges(body.value);
            if (finite) events.push(...finite.map(change => ({...change,start:tokens[0].start})));
            // Unbound dynamic SQL can select any function and role. A later explicit
            // closure can repair it; arbitrary executable blocks never prove closure.
            else if (body) events.push(...uncertainPrivileges(body.value).map(change => ({...change,start:tokens[0].start})));
            else events.push({action:'unknown',start:tokens[0].start});
        } else if (['grant','revoke'].includes(tokens[0]?.value) && tokens.some(t => ['function','functions'].includes(t.value))) events.push({action:'unknown',start:tokens[0].start});
    }
    return events;
}
export function revokedRoles(sql, name) {
    const roles = new Set();
    for (const event of privilegeEvents(sql)) if (event.action === 'revoke' && event.signatures.some(s => s.startsWith(`public.${name}(`))) for (const role of event.roles) roles.add(role);
    return roles;
}
export const offenders = sql => currentDefinerClosureOffenders([{number:257,name:'local',sql}]).map(row => row.split('public.')[1]);
export function governedDefinerNames(migrations, fromExclusive=256) {
    return [...new Set(migrations.filter(m => m.number > fromExclusive).flatMap(m => definerFunctions(m.sql)))].sort();
}
export function currentDefinerClosureOffenders(migrations, fromExclusive=256) {
    const ordered = [...migrations].sort((a,b) => a.number-b.number || a.name.localeCompare(b.name));
    const definitions = new Map();
    for (const migration of ordered) {
        if (migration.number <= fromExclusive) continue;
        const drops = sqlStatements(migration.sql).flatMap(tokens => {
            const m=tokenText(tokens).match(/^drop function (?:if exists )?([\s\S]*?) ;$/);
            const identity=m && functionIdentity(m[1]);
            return identity ? [{action:'drop',identity,start:tokens[0].start}] : [];
        });
        const events = [...drops, ...functionDefinitions(migration.sql).map(f => ({...f,action:'define'})), ...privilegeEvents(migration.sql)].sort((a,b) => a.start-b.start);
        for (const event of events) {
            if (event.action === 'drop') { definitions.delete(event.identity); continue; }
            if (event.action === 'define') {
                const key = event.identity ?? `unknown:${event.name}`;
                if (event.definer) definitions.set(key, {...event, migration:migration.name, closed:new Set()});
                else if(event.identity) definitions.delete(key);
            } else for (const [signature, definition] of definitions) {
                if (event.action === 'unknown' && (!event.signatures || event.signatures.includes(signature))) definition.closed.clear();
                else if (event.signatures.includes(signature)) for (const role of event.roles) {
                    if (event.action === 'revoke') definition.closed.add(role);
                    else definition.closed.delete(role);
                }
            }
        }
    }
    return [...new Set([...definitions.values()].filter(d => !['public','anon','authenticated'].every(r => d.closed.has(r))).map(d => `${d.migration}: public.${d.name}`))].sort();
}
