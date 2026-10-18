// Pure, deliberately finite source recognizer. A label/comment is never a guard.
// Unknown PL/pgSQL is rejected; executable catalog behavior is tested separately.
import {sqlTokens, sqlStatements, tokenText, normalizedSql as norm, splitSqlList, functionIdentity, functionDefinitions} from './definer-role-closure.mjs';
const same = (tokens, sql) => tokenText(tokens) === norm(sql);
const word = (t, v) => t?.kind === 'word' && t.value === v;
class GuardParser {
    constructor(source) { this.tokens=sqlTokens(source); this.i=0; }
    take(value) { const t=this.tokens[this.i++]; if(t?.value!==value || (/[a-z]/.test(value[0]) && t.kind!=='word')) throw Error('Unknown guard syntax'); return t; }
    through(value) { const out=[]; while(this.i<this.tokens.length && !((value===';' ? this.tokens[this.i].kind==='symbol' : this.tokens[this.i].kind==='word') && this.tokens[this.i].value===value)) out.push(this.tokens[this.i++]); this.take(value); return out; }
    sequence(stops=['end']) {
        const nodes=[];
        while(this.i<this.tokens.length && !stops.some(v=>word(this.tokens[this.i],v))) {
            const op=this.tokens[this.i]?.value;
            if(op==='select') { nodes.push({op,tokens:this.through(';')}); }
            else if(op==='raise') {
                const tokens=this.through(';');
                if(!word(tokens[0],'raise') || !word(tokens[1],'exception') || tokens.length<3) throw Error('Not a refusal');
                nodes.push({op,tokens});
            } else if(op==='if') {
                this.take('if'); const branches=[];
                let condition=this.through('then');
                branches.push({condition,nodes:this.sequence(['end','elsif','else'])});
                while(word(this.tokens[this.i],'elsif')) {this.take('elsif');condition=this.through('then');branches.push({condition,nodes:this.sequence(['end','elsif','else'])});}
                if(word(this.tokens[this.i],'else')) throw Error('Conditional bypass');
                this.take('end');this.take('if');this.take(';');nodes.push({op,branches});
            } else if(op==='for') {
                this.take('for');const head=this.through('loop'),nodesIn=this.sequence();this.take('end');this.take('loop');this.take(';');nodes.push({op,head,nodes:nodesIn});
            } else throw Error('Unsupported guard statement');
        }
        return nodes;
    }
    parse() {
        const declarations=[];
        if(word(this.tokens[this.i],'declare')) {
            this.take('declare');
            while(!word(this.tokens[this.i],'begin')) {
                const declaration=this.through(';');
                const text=tokenText(declaration);
                if(!/^[a-z_][a-z0-9_]* (?:record|integer|pg_catalog \. pg_proc(?: % rowtype)?|text \[ \](?: := array \[[\s\S]*\])?)$/.test(text)) throw Error('Unknown declaration');
                declarations.push(declaration);
            }
        }
        this.take('begin');const nodes=this.sequence();this.take('end');if(this.tokens[this.i]?.value===';')this.i++;
        if(this.i!==this.tokens.length)throw Error('Trailing guard code');
        return {declarations,nodes};
    }
}
const refuses = node => node?.op==='if' && node.branches.length>0 && node.branches.every(b=>b.nodes.length===1 && b.nodes[0].op==='raise');
function terms(tokens) {
    let depth=0, part=[], parts=[];
    for(const t of tokens) {
        if(t.kind==='symbol' && t.value==='(')depth++;
        if(t.kind==='symbol' && t.value===')')depth--;
        if(word(t,'or') && depth===0){parts.push(tokenText(part));part=[];}else part.push(t);
    }
    parts.push(tokenText(part));return parts.sort();
}
const equalTerms = (tokens, expected) => JSON.stringify(terms(tokens))===JSON.stringify(expected.map(norm).sort());
function literalCell(cell) {
    if(cell.length===1 && cell[0].kind==='string')return cell[0].value;
    if(cell.length===1 && cell[0].kind==='word' && ['true','false'].includes(cell[0].value))return cell[0].value==='true';
    if(cell.length===1 && cell[0].kind==='word' && /^\d+$/.test(cell[0].value))return Number(cell[0].value);
    if(cell[0]?.value==='array' && cell[1]?.value==='[') {
        const end=cell.findIndex(t=>t.kind==='symbol' && t.value===']');
        if(end<0 || !same(cell.slice(end+1),'::text[]'))throw Error('Nonliteral array type');
        const values=splitSqlList(cell.slice(2,end));
        if(values.some(row=>row.length!==1 || row[0].kind!=='string'))throw Error('Nonliteral array');
        return values.map(row=>row[0].value);
    }
    throw Error('Nonliteral ABI row');
}
function finiteRows(head) {
    const text=tokenText(head), start=head.findIndex(t=>word(t,'values'));
    if(start<0 || !same(head.slice(1,start),'IN SELECT * FROM ('))throw Error('Unbounded guard loop');
    let depth=1, end=start+1;
    for(;end<head.length;end++){const t=head[end];if(t.kind==='symbol' && t.value==='(')depth++;if(t.kind==='symbol' && t.value===')')depth--;if(depth===0)break;}
    const rows=splitSqlList(head.slice(start+1,end)).map(row=>{
        if(row[0]?.value!=='(' || row.at(-1)?.value!==')')throw Error('Unknown row');
        return splitSqlList(row.slice(1,-1)).map(literalCell);
    });
    const suffix=head.slice(end+1);if(suffix[0]?.value==='as')suffix.shift();
    if(suffix[0]?.kind!=='word' || suffix[1]?.value!=='(' || suffix.at(-1)?.value!==')')throw Error('Unbound row aliases');
    const columns=splitSqlList(suffix.slice(2,-1)).map(row=>{if(row.length!==1 || row[0].kind!=='word')throw Error('Unknown column');return row[0].value;});
    if(new Set(columns).size!==columns.length || !rows.length)throw Error('Empty/duplicate ABI columns');
    const expected=rows.map(row=>{if(row.length!==columns.length)throw Error('Incomplete ABI row');return Object.fromEntries(columns.map((c,i)=>[c,row[i]]));});
    if(head[0]?.kind!=='word')throw Error('Unbound loop variable');
    return {variable:head[0].value,columns,rows:expected};
}
function expectedRows(head) {
    const {variable,columns,rows:expected}=finiteRows(head);
    const permitted=['name','signature','input_names','result_type','returns_set','overloads'];
    if(columns.some(c=>!permitted.includes(c)) || !columns.includes('signature') || !columns.includes('input_names'))throw Error('Incomplete ABI columns');
    for(const row of expected) {
        row.identity=typeof row.signature==='string' && functionIdentity(row.signature);
        if(!row.identity || !Array.isArray(row.input_names) || row.input_names.some(n=>!/^[a-z_][a-z0-9_]*$/.test(n)))throw Error('Unknown ABI');
        const count=row.identity.slice(row.identity.indexOf('(')+1,-1).split(',').filter(Boolean).length;
        if(row.input_names.length!==count || ('name'in row && row.name!==row.identity.match(/^public\.([^()]+)/)[1]))throw Error('Unbound identity/names');
        if('result_type'in row && (typeof row.result_type!=='string' || !/^(?:public\.)?[a-z_][a-z0-9_]*$/.test(row.result_type)))throw Error('Unknown return ABI');
        if('returns_set'in row && typeof row.returns_set!=='boolean')throw Error('Unknown set ABI');
    }
    if(new Set(expected.map(r=>r.identity)).size!==expected.length)throw Error('Duplicate signature');
    for(const row of expected)if('overloads'in row && row.overloads!==expected.filter(e=>e.name===row.name).length)throw Error('Unbound overload set');
    return {variable,rows:expected};
}
function liveSelection(node,row) {
    if(node?.op!=='select')return null;
    const live=node.tokens[3]?.value;
    if(!/^[a-z_][a-z0-9_]*$/.test(live??''))return null;
    for(const alias of ['', 'p']) {
        const qualified=alias ? alias+'.' : '';
        if(same(node.tokens,`SELECT * INTO ${live} FROM pg_catalog.pg_proc ${alias} WHERE ${qualified}oid=pg_catalog.to_regprocedure(${row}.signature)`))return live;
    }
    return null;
}
function compactLoop(loop) {
    const {variable:e,rows}=expectedRows(loop.head);if(loop.nodes.length!==2)return [];
    const p=liveSelection(loop.nodes[0],e), guard=loop.nodes[1];if(!p || !refuses(guard) || guard.branches.length!==1)return [];
    const returnTerm=rows.every(r=>'result_type'in r) ? `${p}.prorettype IS DISTINCT FROM pg_catalog.to_regtype(${e}.result_type)` : `${p}.prorettype<>'jsonb'::regtype`;
    const conditions=[`${p}.oid IS NULL`,`${p}.prokind<>'f'`,`${p}.proretset`,`${p}.proargnames[1:${p}.pronargs] IS DISTINCT FROM ${e}.input_names`,returnTerm,
        `(SELECT count(*) FROM pg_catalog.pg_proc q WHERE q.pronamespace=${p}.pronamespace AND q.proname=${p}.proname)<>1`];
    if(!equalTerms(guard.branches[0].condition,conditions))return [];
    return rows.map(r=>({...r,level:'typed-ABI'}));
}
function standardLoop(loop) {
    const {variable:e,rows}=expectedRows(loop.head);if(loop.nodes.length!==4 || rows.some(r=>!('name'in r)))return [];
    const [count,countGuard,select,abiGuard]=loop.nodes;
    const c=count.tokens?.[6]?.value;
    if(count.op!=='select' || !['p','q'].some(alias=>same(count.tokens,`SELECT count(*) INTO ${c} FROM pg_catalog.pg_proc ${alias} JOIN pg_catalog.pg_namespace n ON n.oid=${alias}.pronamespace WHERE n.nspname='public' AND ${alias}.proname=${e}.name`)))return [];
    if(!refuses(countGuard) || countGuard.branches.length!==1 || !equalTerms(countGuard.branches[0].condition,[`${c} <> ${rows.every(r=>'overloads'in r)?e+'.overloads':'1'}`,`pg_catalog.to_regprocedure(${e}.signature) IS NULL`]))return [];
    const p=liveSelection(select,e);if(!p || !refuses(abiGuard) || abiGuard.branches.length!==1)return [];
    const typed=rows.every(r=>'result_type'in r && 'returns_set'in r);
    if(!equalTerms(abiGuard.branches[0].condition,typed ? [`COALESCE(${p}.proargnames[1:${p}.pronargs], ARRAY[]::text[]) IS DISTINCT FROM ${e}.input_names`,`${p}.prorettype IS DISTINCT FROM ${e}.result_type::regtype`,`${p}.proretset IS DISTINCT FROM ${e}.returns_set`,`${p}.prokind<>'f'`] : [`${p}.proargnames[1:${p}.pronargs] IS DISTINCT FROM ${e}.input_names`,`${p}.prorettype<>'jsonb'::regtype`,`${p}.proretset`,`${p}.prokind<>'f'`]))return [];
    return rows.map(r=>({...r,level:'typed-ABI'}));
}
// A deliberately bounded one-family transition: known source ABI/body/owner/ACL,
// absent typed target, exclusive catalog serialization, then exact source retirement.
function familyTransitionLoop(loop,definitions) {
    const {variable:e,columns,rows}=finiteRows(loop.head);
    if(JSON.stringify(columns)!==JSON.stringify(['source_signature','source_input_names','target_signature','target_input_names','result_type','source_md5']) || rows.length!==1 || loop.nodes.length!==2)return [];
    const row=rows[0],source=typeof row.source_signature==='string'&&functionIdentity(row.source_signature),target=typeof row.target_signature==='string'&&functionIdentity(row.target_signature);
    if(!source || !target || source===target || source.split('(')[0]!==target.split('(')[0] || !/^[a-z_][a-z0-9_]*$/.test(row.result_type??'') || !/^[0-9a-f]{32}$/.test(row.source_md5??''))return [];
    for(const [identity,names] of [[source,row.source_input_names],[target,row.target_input_names]]) {
        if(!Array.isArray(names)||names.some(n=>typeof n!=='string'||!/^[a-z_][a-z0-9_]*$/.test(n))||names.length!==identity.slice(identity.indexOf('(')+1,-1).split(',').filter(Boolean).length)return [];
    }
    const [select,guard]=loop.nodes,p=select.tokens?.[3]?.value;
    if(select.op!=='select'||!same(select.tokens,`SELECT * INTO ${p} FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(${e}.source_signature)`)||!refuses(guard)||guard.branches.length!==1)return [];
    const conditions=[
        `${p}.oid IS NULL`,
        `${p}.pronamespace IS DISTINCT FROM 'public'::regnamespace`,
        `${p}.proargnames[1:${p}.pronargs] IS DISTINCT FROM ${e}.source_input_names`,
        `${p}.prorettype IS DISTINCT FROM pg_catalog.to_regtype(${e}.result_type)`,
        `${p}.proretset`,
        `${p}.prokind<>'f'`,
        `${p}.pronargdefaults<>0`,
        `(SELECT count(*) FROM pg_catalog.pg_proc q WHERE q.pronamespace=${p}.pronamespace AND q.proname=${p}.proname)<>1`,
        `pg_catalog.to_regprocedure(${e}.target_signature) IS NOT NULL`,
        `${p}.proowner IS DISTINCT FROM pg_catalog.to_regrole(current_user)`,
        `${p}.prolang IS DISTINCT FROM (SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')`,
        `NOT ${p}.prosecdef`,
        `${p}.provolatile<>'v'`,
        `${p}.proisstrict`,
        `${p}.proleakproof`,
        `${p}.proparallel<>'u'`,
        `${p}.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public, pg_temp']::text[]`,
        `pg_catalog.md5(${p}.prosrc) IS DISTINCT FROM ${e}.source_md5`,
        `pg_catalog.has_function_privilege('anon',${p}.oid,'EXECUTE')`,
        `pg_catalog.has_function_privilege('authenticated',${p}.oid,'EXECUTE')`,
        `pg_catalog.has_function_privilege('app_tenant',${p}.oid,'EXECUTE')`,
        `NOT pg_catalog.has_function_privilege('service_role',${p}.oid,'EXECUTE')`,
        `pg_catalog.has_function_privilege('service_role',${p}.oid,'EXECUTE WITH GRANT OPTION')`,
        `(SELECT count(*) FROM pg_catalog.aclexplode(coalesce(${p}.proacl,pg_catalog.acldefault('f',${p}.proowner))))<>2`,
        `EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(${p}.proacl,pg_catalog.acldefault('f',${p}.proowner))) a WHERE NOT (a.grantor=${p}.proowner AND a.privilege_type='EXECUTE' AND ((a.grantee=${p}.proowner AND a.is_grantable IS NOT DISTINCT FROM (SELECT b.is_grantable FROM pg_catalog.aclexplode(pg_catalog.acldefault('f',${p}.proowner)) b WHERE b.grantee=${p}.proowner)) OR (a.grantee='service_role'::regrole::oid AND NOT a.is_grantable))))`
    ];
    if(!equalTerms(guard.branches[0].condition,conditions))return [];
    if(!definitions.some(fn=>fn.identity===target&&JSON.stringify(fn.inputNames)===JSON.stringify(row.target_input_names)))return [];
    return [{identity:target,input_names:row.target_input_names,source_identity:source,level:'typed-absence-family-transition',requires_catalog_lock:true}];
}

function triggerGuard(nodes) {
    if(nodes.length!==3 || !refuses(nodes[0]) || !refuses(nodes[2]) || nodes[1].op!=='select')return [];
    const select=nodes[1],p=select.tokens[3]?.value;
    const signature=select.tokens.find(t=>t.kind==='string')?.value;
    const identity=signature && functionIdentity(signature);if(!identity || !identity.endsWith('()'))return [];
    if(!same(select.tokens,`SELECT * INTO ${p} FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('${signature}')`))return [];
    const conditions=terms(nodes[2].branches[0].condition);
    const fixed=[`${p}.oid IS NULL`,`${p}.prokind<>'f'`,`${p}.prorettype<>'trigger'::regtype`,`${p}.proretset`,`${p}.pronargs<>0`,
        `(SELECT count(*) FROM pg_catalog.pg_proc q WHERE q.pronamespace=${p}.pronamespace AND q.proname=${p}.proname)<>1`].map(norm);
    const extra=conditions.filter(c=>!fixed.includes(c));
    if(conditions.length!==7 || fixed.some(c=>!conditions.includes(c)) || extra.length!==1)return [];
    // The literal relation/name remain bound to this exact function OID and trigger kind.
    if(!/^\( select count \( \* \) from pg_catalog \. pg_trigger where tgrelid = 'public\.[a-z_][a-z0-9_]*' :: regclass and tgname = '[a-z_][a-z0-9_]*' and tgfoid = [a-z_][a-z0-9_]* \. oid and tgtype = 7 and tgenabled = 'O' and not tgisinternal \) <> 1$/.test(extra[0]))return [];
    if(!extra[0].includes(norm(`tgfoid=${p}.oid`)))return [];
    return [{identity,input_names:[],result_type:'trigger',level:'typed-trigger-ABI'}];
}
// Preserve the existing historical input-name/typed-existence contracts without
// pretending they prove the stronger complete ABI. No filename/marker exemption.
function legacyGuard(body, definitions) {
    const {nodes,declarations}=new GuardParser(body).parse();
    const results=[];
    for(const fn of definitions) {
        if(!fn.identity)continue;
        const name=fn.name, signature=fn.identity;
        if(nodes.length===1 && refuses(nodes[0]) && nodes[0].branches.length===1 &&
            same(nodes[0].branches[0].condition,`to_regprocedure('${signature.replaceAll(',', ', ')}') IS NULL`)) {
            results.push({identity:signature,input_names:fn.inputNames,level:'legacy-typed-existence'});continue;
        }
        if(nodes.length!==4 || nodes[0].op!=='select' || nodes[2].op!=='select' || !refuses(nodes[1]) || !refuses(nodes[3]))continue;
        const [count,countGuard,names,namesGuard]=nodes;
        const c=count.tokens[6]?.value, v=names.tokens.findIndex(t=>word(t,'into'));
        const variable=names.tokens[v+1]?.value;
        const countQuery=`SELECT count(*) INTO ${c} FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='${name}'`;
        const oldCountQuery=countQuery.replaceAll('pg_catalog.','');
        if(!same(count.tokens,countQuery) && !same(count.tokens,oldCountQuery))continue;
        const oldNamesQuery=`SELECT p.proargnames[1:p.pronargs] INTO ${variable} FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='${name}'`;
        const newNamesQuery=`SELECT p.proargnames[1:p.pronargs] INTO ${variable} FROM pg_catalog.pg_proc p WHERE p.oid='${signature}'::regprocedure`;
        if(!same(names.tokens,oldNamesQuery) && !same(names.tokens,newNamesQuery))continue;
        const branches=countGuard.branches;
        const oldCount=branches.length===2 && same(branches[0].condition,`${c}=0`) && same(branches[1].condition,`${c}>1`);
        const newCount=branches.length===1 && equalTerms(branches[0].condition,[`${c}<>1`,`to_regprocedure('${signature}') IS NULL`]);
        if(!oldCount && !newCount)continue;
        if(namesGuard.branches.length!==1)continue;
        const expectedArray=`ARRAY[${fn.inputNames.map(n=>"'"+n+"'").join(',')}]`;
        const inline=norm(`${variable} IS DISTINCT FROM ${expectedArray}::text[]`);
        const declared=declarations.find(d=>tokenText(d).startsWith('v_expected text [ ] := '));
        const matchesDeclared=declared && same(declared,`v_expected text[] := ${expectedArray}`) && same(namesGuard.branches[0].condition,`${variable} IS DISTINCT FROM v_expected`);
        if(tokenText(namesGuard.branches[0].condition)===inline || matchesDeclared)results.push({identity:signature,input_names:fn.inputNames,level:'legacy-input-names'});
    }
    return results;
}
function analyzeBlock(body, definitions) {
    const {nodes}=new GuardParser(body).parse();
    const loop=nodes.find(n=>n.op==='for');
    if(loop) {
        const index=nodes.indexOf(loop);
        // Only refusal-only preconditions may precede the bounded loop; no way to bypass it.
        if(nodes.slice(0,index).some(n=>!refuses(n)))return [];
        const transition=familyTransitionLoop(loop,definitions);
        const rows=transition.length?transition:compactLoop(loop).length?compactLoop(loop):standardLoop(loop);
        if(!rows.length)return [];
        if(transition.length && (index!==1 || !refuses(nodes[0]) || nodes[0].branches.length!==1 || !equalTerms(nodes[0].branches[0].condition,[
            "pg_catalog.current_setting('transaction_isolation')<>'read committed'",
            "EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted AND (l.pid IS NULL OR l.pid<>pg_catalog.pg_backend_pid()))",
            "EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts)"
        ])))return [];
        // Optional extra SELECT/IF output-ABI checks can only add refusal, never bypass it.
        const tail=nodes.slice(index+1);
        if(tail.length) {
            if(tail.length!==2 || tail[0].op!=='select' || !refuses(tail[1]) || tail[1].branches.length!==1)return [];
            const live=tail[0].tokens[3]?.value, signature=tail[0].tokens.find(t=>t.kind==='string')?.value;
            if(!rows.some(r=>r.identity===functionIdentity(signature??'')) || !same(tail[0].tokens,`SELECT * INTO ${live} FROM pg_catalog.pg_proc p WHERE p.oid='${signature}'::regprocedure`))return [];
            const comparisons=terms(tail[1].branches[0].condition);
            if(comparisons.length!==3 || !['proargnames','proallargtypes','proargmodes'].every(field=>comparisons.some(c=>c.startsWith(norm(`${live}.${field} IS DISTINCT FROM ARRAY[`)))))return [];
        }
        return rows;
    }
    return triggerGuard(nodes).length ? triggerGuard(nodes) : legacyGuard(body, definitions);
}
export function rollbackSignatureGuards(sql) {
    try {
        const statements=sqlStatements(sql);
        if(!same(statements[0]??[],'BEGIN;') || !same(statements.at(-1)??[],'COMMIT;'))return [];
        if(statements.slice(1,-1).some(s=>['begin','commit','rollback','savepoint'].includes(s[0]?.value)))return [];
        const firstMutation=statements.findIndex(s=>['create','drop','alter','insert','update','delete','truncate','grant','revoke','call'].includes(s[0]?.value) || literalRestorations(s).length);
        if(firstMutation<0)return [];
        const guards=[];
        for(const statement of statements.slice(1,firstMutation)) {
            if(word(statement[0],'do') && statement.length===3 && statement[1].kind==='body') {
                const rows=analyzeBlock(statement[1].value, restoredDefinitions(sql));
                const refusalOnly = node => node.op==='raise' || (node.op==='if' && node.branches.every(b=>b.nodes.every(refusalOnly) && b.condition.every((t,i,tokens)=>!(t.kind==='word' && tokens[i+1]?.value==='(') || ['exists','to_regprocedure','and','or','not','in'].includes(t.value))));
                if(!rows.length && !new GuardParser(statement[1].value).parse().nodes.every(refusalOnly))return [];
                guards.push(...rows.map(row=>({...row,guard_start:statement[0].start})));
            } else if(statement[0]?.value==='select' && !/^select pg_advisory_xact_lock \( hashtextextended \( '[^']+' , 0 \) \) ;$/.test(tokenText(statement)))return [];
            else if(statement[0]?.value!=='select' && !/^lock table public \./.test(tokenText(statement)) && !same(statement,'LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;'))return [];
        }
        if(guards.some(g=>g.requires_catalog_lock)&&!same(statements[1]??[],'LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;'))return [];
        return guards;
    }catch{return [];}
}
function literalRestorations(statement) {
    const found=[];
    if(!word(statement[0],'do') || statement[1]?.kind!=='body')return found;
    const tokens=sqlTokens(statement[1].value);
    for(let i=0;i<tokens.length;i++) {
        // Only a single complete literal command, with no concatenation/interpolation.
        if(word(tokens[i],'execute') && ['body','string'].includes(tokens[i+1]?.kind) && tokens[i+2]?.value===';') {
            found.push(...functionDefinitions(tokens[i+1].value).map(f=>({...f,start:statement[0].start})));
        }
    }
    return found;
}
function restoredDefinitions(sql) {
    return [...functionDefinitions(sql), ...sqlStatements(sql).flatMap(literalRestorations)];
}
export function guardedRestorations(sql) {
    const guards=rollbackSignatureGuards(sql);
    const definitions=restoredDefinitions(sql);
    return [...new Set(definitions.map(fn=>fn.name))].filter(name=>definitions.filter(fn=>fn.name===name)
        .every(fn=>guards.some(g=>g.identity===fn.identity && JSON.stringify(g.input_names)===JSON.stringify(fn.inputNames)&&(!g.requires_catalog_lock||transitionRetirement(sql,g,fn)))));
}
function transitionRetirement(sql,guard,fn) {
    const between=sqlStatements(sql).filter(statement=>statement[0].start>guard.guard_start&&statement[0].start<fn.start);
    return between.length===1&&JSON.stringify(dropIdentities(between[0]))===JSON.stringify([guard.source_identity]);
}
export function droppedRestorations(sql) {
    try {
        // DROP-only evidence is limited to unconditional static SQL. A guard or
        // dynamic block must earn real guard proof rather than borrow a blind DROP.
        const statements=sqlStatements(sql);
        if(statements.some(statement=>word(statement[0],'do')))return [];
        const drops=statements.flatMap(statement=>dropIdentities(statement).map(identity=>({identity,start:statement[0].start})));
        const definitions=restoredDefinitions(sql);
        // A name is covered only when every restored overload has its own exact,
        // earlier typed DROP. Retiring another overload is not evidence for it.
        return [...new Set(definitions.map(fn=>fn.name))].filter(name=>definitions.filter(fn=>fn.name===name)
            .every(fn=>fn.identity && drops.some(drop=>drop.identity===fn.identity && drop.start<fn.start)));
    }catch{return [];}
}

function dropIdentities(statement) {
    if(!word(statement[0],'drop') || !word(statement[1],'function') || statement.at(-1)?.value!==';' || statement.some(t=>['string','body','identifier'].includes(t.kind)))return [];
    let tokens=statement.slice(2,-1);
    if(word(tokens[0],'if')) {if(!word(tokens[1],'exists'))return [];tokens=tokens.slice(2);}
    if(['cascade','restrict'].some(v=>word(tokens.at(-1),v)))tokens=tokens.slice(0,-1);
    if(!tokens.length || tokens.at(-1).value===',')return [];
    const identities=[];
    for(const signature of splitSqlList(tokens)) {
        if(signature[0]?.value!=='public' || signature[1]?.value!=='.' || signature[2]?.kind!=='word' || signature[3]?.value!=='(' || signature.at(-1)?.value!==')')return [];
        const args=signature.slice(4,-1);if(args.at(-1)?.value===',')return [];
        const types=[];
        for(let arg of splitSqlList(args)) {
            if(word(arg[0],'in'))arg=arg.slice(1);
            if(!arg.length || ['out','inout','variadic'].some(v=>word(arg[0],v)))return [];
            const typeIdentity=part=>functionIdentity(`public.${signature[2].value}(${tokenText(part)})`);
            // PostgreSQL ignores optional input argument names in DROP identity.
            // Recognize bare types first, then one unquoted name plus that type.
            const identity=typeIdentity(arg) ?? (arg[0]?.kind==='word' ? typeIdentity(arg.slice(1)) : null);
            if(!identity)return [];
            types.push(identity.slice(identity.indexOf('(')+1,-1));
        }
        const identity=functionIdentity(`public.${signature[2].value}(${types.join(',')})`);
        if(!identity)return [];
        identities.push(identity);
    }
    return identities;
}
