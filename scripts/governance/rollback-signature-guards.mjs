import {createHash} from 'node:crypto';
// Pure, deliberately finite source recognizer. A label/comment is never a guard.
// Unknown PL/pgSQL is rejected; executable catalog behavior is tested separately.
import {sqlTokens, sqlStatements, tokenText, normalizedSql as norm, splitSqlList, functionIdentity, functionDefinitions} from './definer-role-closure.mjs';
const same = (tokens, sql) => tokenText(tokens) === norm(sql);
const word = (t, v) => t?.kind === 'word' && t.value === v;
class GuardParser {
    constructor(source, catalog=false) { this.tokens=sqlTokens(source); this.i=0; this.catalog=catalog; }
    take(value) { const t=this.tokens[this.i++]; if(t?.value!==value || (/[a-z]/.test(value[0]) && t.kind!=='word')) throw Error('Unknown guard syntax'); return t; }
    through(value) {
        const out=[];let cases=0;
        while(this.i<this.tokens.length) {
            const token=this.tokens[this.i];
            if(!cases && (value===';'?token.kind==='symbol':token.kind==='word') && token.value===value)break;
            if(word(token,'case'))cases++;
            if(word(token,'end') && cases)cases--;
            out.push(this.tokens[this.i++]);
        }
        if(cases)throw Error('Unclosed SQL CASE');
        this.take(value);return out;
    }
    sequence(stops=['end']) {
        const nodes=[];
        while(this.i<this.tokens.length && !stops.some(v=>word(this.tokens[this.i],v))) {
            const op=this.tokens[this.i]?.value;
            if(op==='select') { nodes.push({op,tokens:this.through(';')}); }
            else if(op==='raise') {
                const tokens=this.through(';');
                if(!word(tokens[0],'raise') || !word(tokens[1],'exception') || tokens[2]?.kind!=='string'&&!word(tokens[2],'using')) throw Error('Not a literal refusal');
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
                if(!/^[a-z_][a-z0-9_]* (?:record|integer|pg_catalog \. pg_proc(?: % rowtype)?|text \[ \](?: := array \[[\s\S]*\])?)$/.test(text) && !(this.catalog && /^[a-z_][a-z0-9_]* (?:jsonb|pg_proc % rowtype|public \. migration_privilege_journal % rowtype)$/.test(text))) throw Error('Unknown declaration');
                const assignment=declaration.findIndex(t=>t.value===':=');
                if(assignment>=0)literalCell([...declaration.slice(assignment+1),...sqlTokens('::text[]')]);
                if(declarations.some(d=>d[0].value===declaration[0].value))throw Error('Duplicate declaration');
                declarations.push(declaration);
            }
        }
        this.take('begin');const nodes=this.sequence();this.take('end');if(this.tokens[this.i]?.value===';')this.i++;
        if(this.i!==this.tokens.length)throw Error('Trailing guard code');
        const variables=new Set(declarations.map(d=>d[0].value));
        const auditRaises=items=>items.forEach(node=>{
            if(node.op==='raise') {
                auditRaise(node.tokens,declarations,variables);
            }else if(node.op==='if')node.branches.forEach(branch=>auditRaises(branch.nodes));
            else if(node.op==='for')auditRaises(node.nodes);
        });
        auditRaises(nodes);
        return {declarations,nodes};
    }
}
function auditRaise(tokens,declarations,variables) {
    if(word(tokens[2],'using')) {
        const options=splitSqlList(tokens.slice(3));
        if(options.length!==3||!['message','detail','hint'].every((key,i)=>word(options[i][0],key)&&options[i][1]?.value==='='))throw Error('Unknown exception options');
        if(options.slice(1).some(option=>option.length!==3||option[2].kind!=='string'))throw Error('Nonliteral exception detail');
        const format=options[0].slice(2);
        if(!word(format[0],'format')||format[1]?.value!=='('||format.at(-1)?.value!==')')throw Error('Unknown exception formatter');
        const args=splitSqlList(format.slice(2,-1));
        if(args.length!==4||args[0].length!==1||args[0][0].kind!=='string')throw Error('Unknown exception format arguments');
        const names=args[2][2]?.value,expected=args[3][2]?.value;
        for(const variable of [names,expected])if(!declarations.some(d=>d[0].value===variable&&same(d.slice(1,4),'text[]')))throw Error('Unbound formatter array');
        if(!same(args[1],`coalesce(array_length(${names},1),0)`))throw Error('Unknown array size expression');
        for(const [index,variable] of [[2,names],[3,expected]]) {
            const delimiter=args[index][4];
            if(delimiter?.kind!=='string'||!same(args[index],`array_to_string(${variable},${tokenText([delimiter])})`))throw Error('Unknown array formatter');
        }
        return;
    }
    if(tokens[2]?.kind!=='string')throw Error('Nonliteral exception format');
    if(tokens.length===3)return;
    if(tokens[3]?.value!==',')throw Error('Unknown exception expression');
    for(const argument of splitSqlList(tokens.slice(4))) {
        const scalar=argument.length===1&&(argument[0].kind==='string'||argument[0].kind==='word'&&/^(?:true|false|[0-9]+)$/.test(argument[0].value));
        const variable=variables.has(argument[0]?.value)&&(argument.length===1||argument.length===3&&argument[1].value==='.'&&argument[2].kind==='word');
        if(!scalar&&!variable)throw Error('Nonliteral or unbound exception argument');
    }
    if(tokens.at(-1)?.value===',')throw Error('Incomplete exception arguments');
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
function finiteRows(head, cellParser=literalCell) {
    const text=tokenText(head), start=head.findIndex(t=>word(t,'values'));
    if(start<0 || !same(head.slice(1,start),'IN SELECT * FROM ('))throw Error('Unbounded guard loop');
    let depth=1, end=start+1;
    for(;end<head.length;end++){const t=head[end];if(t.kind==='symbol' && t.value==='(')depth++;if(t.kind==='symbol' && t.value===')')depth--;if(depth===0)break;}
    const rows=splitSqlList(head.slice(start+1,end)).map(row=>{
        if(row[0]?.value!=='(' || row.at(-1)?.value!==')')throw Error('Unknown row');
        return splitSqlList(row.slice(1,-1)).map(cellParser);
    });
    const suffix=head.slice(end+1);if(suffix[0]?.value==='as')suffix.shift();
    if(suffix[0]?.kind!=='word' || suffix[1]?.value!=='(' || suffix.at(-1)?.value!==')')throw Error('Unbound row aliases');
    const columns=splitSqlList(suffix.slice(2,-1)).map(row=>{if(row.length!==1 || row[0].kind!=='word')throw Error('Unknown column');return row[0].value;});
    if(new Set(columns).size!==columns.length || !rows.length)throw Error('Empty/duplicate ABI columns');
    const expected=rows.map(row=>{if(row.length!==columns.length)throw Error('Incomplete ABI row');return Object.fromEntries(columns.map((c,i)=>[c,row[i]]));});
    if(head[0]?.kind!=='word')throw Error('Unbound loop variable');
    return {variable:head[0].value,alias:suffix[0].value,columns,rows:expected};
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
// Equivalent ABI proof with a separate missing-function refusal before SELECT.
function separatedLoop(loop) {
    const {variable:e,rows}=expectedRows(loop.head);
    if(loop.nodes.length!==3)return [];
    const [present,select,abi]=loop.nodes,p=liveSelection(select,e);
    if(!p || !refuses(present) || present.branches.length!==1 || !same(present.branches[0].condition,`pg_catalog.to_regprocedure(${e}.signature) IS NULL`)
        || !refuses(abi) || abi.branches.length!==1)return [];
    if(!equalTerms(abi.branches[0].condition,[`${p}.proargnames[1:${p}.pronargs] IS DISTINCT FROM ${e}.input_names`,`${p}.proretset`,
        `${p}.prorettype IS DISTINCT FROM 'jsonb'::regtype`,`${p}.prokind<>'f'`,
        `(SELECT count(*) FROM pg_catalog.pg_proc other WHERE other.pronamespace=${p}.pronamespace AND other.proname=${p}.proname)<>1`]))return [];
    return rows.map(r=>({...r,result_type:'jsonb',returns_set:false,level:'typed-ABI'}));
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
    if(nodes.length!==3 || !refuses(nodes[0]) || !readOnlyRefusal(nodes[0]) || !refuses(nodes[2]) || nodes[2].branches.length!==1 || nodes[1].op!=='select')return [];
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
// Finite refusal predicates around primary proof may read literal-scoped history
// or the fixed catalog quiescence contract. They may not execute arbitrary SQL
// expressions. In particular a bare builtin spelling never authorizes public.f().
const quiescenceTerms=[
    "pg_catalog.current_setting('transaction_isolation')<>'read committed'",
    "EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted AND (l.pid IS NULL OR l.pid<>pg_catalog.pg_backend_pid()))",
    'EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts)'
];
class RefusalCondition {
    constructor(tokens){this.tokens=tokens;this.i=0;}
    at(value){return this.tokens[this.i]?.value===value;}
    take(value){if(!this.at(value))throw Error('Unknown read-only refusal');return this.tokens[this.i++];}
    identifier(){const token=this.tokens[this.i++];if(token?.kind!=='word'||!/^[a-z_][a-z0-9_]*$/.test(token.value))throw Error('Unknown refusal identifier');return token.value;}
    expression(){this.and();while(this.at('or')){this.i++;this.and();}}
    and(){this.atom();while(this.at('and')){this.i++;this.atom();}}
    atom(){
        if(this.at('not')){this.i++;this.atom();return;}
        if(this.at('(')){this.i++;this.expression();this.take(')');return;}
        if(this.at('exists')){
            this.i++;this.take('(');this.take('select');this.take('1');this.take('from');
            const first=this.identifier();let relation=first;
            if(this.at('.')){this.i++;relation=first+'.'+this.identifier();}
            if(!/^public\.[a-z_][a-z0-9_]*$/.test(relation)&&!['pg_proc','pg_attribute','pg_catalog.pg_proc','pg_catalog.pg_attribute'].includes(relation))throw Error('Unknown history relation');
            if(this.at('where')){this.i++;this.expression();}
            this.take(')');return;
        }
        this.value();
        if(this.at('is')){
            this.i++;if(this.at('not'))this.i++;
            if(this.at('null'))this.i++;
            else {this.take('distinct');this.take('from');this.value();}
        }else if(['=','<>','!=','<','>','<=','>=','?','like'].some(op=>this.at(op))){this.i++;this.value();}
        else if(this.at('in')){
            this.i++;this.take('(');this.literal();while(this.at(',')){this.i++;this.literal();}this.take(')');
        }
    }
    literal(){const token=this.tokens[this.i++];if(!token||(token.kind!=='string'&&!(token.kind==='word'&&/^(?:true|false|[0-9]+)$/.test(token.value))))throw Error('Nonliteral refusal value');return token;}
    value(){
        const token=this.tokens[this.i];
        if(token?.kind==='string'||token?.kind==='word'&&/^(?:true|false|[0-9]+)$/.test(token.value)){
            const literal=this.literal();
            if(this.at('::')){
                this.i++;this.take('regclass');
                if(literal.kind!=='string'||!/^public\.[a-z_][a-z0-9_]*$/.test(literal.value))throw Error('Unbound relation cast');
            }
            return;
        }
        const first=this.identifier();let name=first;
        if(this.at('.')){this.i++;name=first+'.'+this.identifier();}
        if(this.at('(')){
            if(!['to_regprocedure','pg_catalog.to_regprocedure'].includes(name))throw Error('Unknown refusal callee');
            this.i++;const signature=this.literal();this.take(')');
            if(signature.kind!=='string'||!functionIdentity(signature.value))throw Error('Nonliteral typed identity');
        }else if(['select','from','where','then','case','when','end','call','perform','execute','insert','update','delete','return','using','operator','into'].includes(first))throw Error('Unknown refusal expression');
        // The only computed history field form is a literal JSON text key.
        if(this.at('-')){this.i++;this.take('>');this.take('>');if(this.literal().kind!=='string')throw Error('Nonliteral JSON key');}
    }
    parse(){this.expression();if(this.i!==this.tokens.length)throw Error('Trailing refusal expression');return true;}
}
function readOnlyCondition(tokens){
    if(equalTerms(tokens,quiescenceTerms))return true;
    // A literal catalog-family absence check only adds a refusal. No dynamic
    // callee, assignment or caller-controlled namespace can hide in this shape.
    if(/^exists \( select 1 from pg_catalog \. pg_proc p join pg_catalog \. pg_namespace n on n \. oid = p \. pronamespace where n \. nspname = 'public' and p \. proname = '[a-z_][a-z0-9_]*' \)$/.test(tokenText(tokens)))return true;
    try{return new RefusalCondition(tokens).parse();}catch{return false;}
}
const readOnlyRefusal=node=>node?.op==='if'&&node.branches.length>0&&node.branches.every(branch=>readOnlyCondition(branch.condition)&&branch.nodes.length>0&&branch.nodes.every(child=>child.op==='raise'||readOnlyRefusal(child)));
function analyzeBlock(body, definitions) {
    const {nodes}=new GuardParser(body).parse();
    const loop=nodes.find(n=>n.op==='for');
    if(loop) {
        const index=nodes.indexOf(loop);
        // Only refusal-only preconditions may precede the bounded loop; no way to bypass it.
        if(nodes.slice(0,index).some(n=>!refuses(n)||!readOnlyRefusal(n)))return [];
        const transition=familyTransitionLoop(loop,definitions);
        const rows=transition.length?transition:compactLoop(loop).length?compactLoop(loop):separatedLoop(loop).length?separatedLoop(loop):standardLoop(loop);
        if(!rows.length)return [];
        if(transition.length && (index!==1 || !refuses(nodes[0]) || nodes[0].branches.length!==1 || !equalTerms(nodes[0].branches[0].condition,[
            "pg_catalog.current_setting('transaction_isolation')<>'read committed'",
            "EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted AND (l.pid IS NULL OR l.pid<>pg_catalog.pg_backend_pid()))",
            "EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts)"
        ])))return [];
        // Optional extra SELECT/IF output-ABI checks can only add refusal, never bypass it.
        const tail=nodes.slice(index+1);
        while(tail.length && readOnlyRefusal(tail[0]))tail.shift();
        if(tail.length) {
            if(tail.length!==2 || tail[0].op!=='select' || !refuses(tail[1]) || tail[1].branches.length!==1)return [];
            const live=tail[0].tokens[3]?.value, signature=tail[0].tokens.find(t=>t.kind==='string')?.value;
            if(!rows.some(r=>r.identity===functionIdentity(signature??'')) || !same(tail[0].tokens,`SELECT * INTO ${live} FROM pg_catalog.pg_proc p WHERE p.oid='${signature}'::regprocedure`))return [];
            const row=rows.find(r=>r.identity===functionIdentity(signature??''));
            const output=outputAbi(tail[1].branches[0].condition,live,row);
            if(!output)return [];
            row.output_abi=output;
        }
        if(nodes.slice(0,index).some(node=>refuses(node)&&node.branches.length===1&&equalTerms(node.branches[0].condition,quiescenceTerms)))for(const row of rows)row.quiescence_guard=true;
        return rows;
    }
    return triggerGuard(nodes).length ? triggerGuard(nodes) : legacyGuard(body, definitions);
}
// OUT checks contain only finite literal arrays. Bind their input prefix to the
// primary row; retaining merely an ARRAY prefix would admit arbitrary callees.
function outputAbi(condition,live,row) {
    if(row.result_type!=='record'||row.returns_set!==true)return null;
    const comparisons=terms(condition).map(sqlTokens), values={};
    if(comparisons.length!==3)return null;
    for(const field of ['proargnames','proallargtypes','proargmodes']) {
        const prefix=sqlTokens(`${live}.${field} IS DISTINCT FROM ARRAY[`);
        const comparison=comparisons.find(c=>tokenText(c.slice(0,prefix.length))===tokenText(prefix));
        if(!comparison)return null;
        const end=comparison.findIndex((t,i)=>i>=prefix.length&&t.kind==='symbol'&&t.value===']');
        const cast=field==='proargnames'?'::text[]':field==='proallargtypes'?'::oid[]':'::"char"[]';
        if(end<0||!same(comparison.slice(end+1),cast))return null;
        const cells=splitSqlList(comparison.slice(prefix.length,end));
        if(!cells.length||cells.some(c=>c[0]?.kind!=='string'||(field==='proallargtypes'?!same(c.slice(1),'::regtype::oid'):c.length!==1)))return null;
        values[field]=cells.map(c=>c[0].value);
    }
    const names=values.proargnames,types=values.proallargtypes,modes=values.proargmodes,n=row.input_names.length;
    if(names.length<=n||names.length!==types.length||names.length!==modes.length||new Set(names).size!==names.length||names.some(v=>!/^[a-z_][a-z0-9_]*$/.test(v)))return null;
    if(JSON.stringify(names.slice(0,n))!==JSON.stringify(row.input_names)||modes.some((m,i)=>m!==(i<n?'i':'t')))return null;
    const identity=functionIdentity(`public.output_probe(${types.join(',')})`);
    if(!identity)return null;
    const normalized=identity.slice(identity.indexOf('(')+1,-1).split(',');
    if(normalized.slice(0,n).join(',')!==row.identity.slice(row.identity.indexOf('(')+1,-1))return null;
    return {names,types:normalized,modes};
}
// A supplemental block may only refuse an already proved, exact primary set.
// It contributes no signature proof of its own. Every query/callee is fixed;
// expected values and the owner relation are finite catalog-only literals.
function fingerprintRefusal(body,guards) {
    const {nodes,declarations}=new GuardParser(body).parse();
    if(declarations.length||nodes.length!==1||!refuses(nodes[0])||nodes[0].branches.length!==1)return false;
    const branch=nodes[0].branches[0],raise=branch.nodes[0].tokens;
    if(raise.length!==3||raise[2].kind!=='string')return false;
    const tokens=branch.condition;
    if(!same(tokens.slice(0,6),'EXISTS(SELECT 1 FROM (')||tokens.at(-1)?.value!==')')return false;
    const join=tokens.findIndex(t=>word(t,'join'));
    if(join<0)return false;
    const {alias,columns,rows}=finiteRows([...sqlTokens('bounded IN SELECT * FROM'),...tokens.slice(5,join)]);
    if(JSON.stringify(columns)!==JSON.stringify(['signature','defaults','definer','search_path','body_md5','argument_names'])||rows.length>32)return false;
    const where=tokens.findIndex(t=>word(t,'where'));
    if(where<0||!same(tokens.slice(join,where),`JOIN pg_catalog.pg_proc p ON p.oid=pg_catalog.to_regprocedure(expected.signature) JOIN pg_catalog.pg_language l ON l.oid=p.prolang`))return false;
    // Require the expected alias, even though finiteRows accepts other loop aliases.
    if(alias!=='expected')return false;
    const predicates=tokens.slice(where+1,-1),relations=predicates.filter(t=>t.kind==='string'&&/^public\.[a-z_][a-z0-9_]*$/.test(t.value));
    if(relations.length!==1)return false;
    const relation=relations[0].value;
    const expected=[
        `p.proowner IS DISTINCT FROM (SELECT c.relowner FROM pg_catalog.pg_class c WHERE c.oid='${relation}'::regclass)`,
        'p.pronargdefaults IS DISTINCT FROM expected.defaults',
        'p.prosecdef IS DISTINCT FROM expected.definer',
        'p.proconfig IS DISTINCT FROM ARRAY[expected.search_path]::text[]',
        "l.lanname<>'plpgsql'",
        'p.proargnames IS DISTINCT FROM expected.argument_names',
        '(NOT expected.definer AND (p.proallargtypes IS NOT NULL OR p.proargmodes IS NOT NULL))',
        'pg_catalog.md5(p.prosrc) IS DISTINCT FROM expected.body_md5'
    ];
    if(!equalTerms(predicates,expected))return false;
    const ids=rows.map(r=>typeof r.signature==='string'&&functionIdentity(r.signature));
    if(ids.some(id=>!id)||new Set(ids).size!==rows.length||ids.length!==guards.length||guards.some(g=>g.level!=='typed-ABI'||!ids.includes(g.identity)||g.body_fingerprint))return false;
    for(const row of rows) {
        const guard=guards.find(g=>g.identity===functionIdentity(row.signature));
        const names=guard.output_abi?.names??guard.input_names;
        if(!Number.isSafeInteger(row.defaults)||row.defaults<0||row.defaults>guard.input_names.length||typeof row.definer!=='boolean'||!/^search_path=(?:pg_catalog, )?public(?:, pg_temp)?$/.test(row.search_path??'')||!/^[0-9a-f]{32}$/.test(row.body_md5??'')||JSON.stringify(row.argument_names)!==JSON.stringify(names))return false;
        if(guard.returns_set===true&&!guard.output_abi)return false;
    }
    for(const row of rows)guards.find(g=>g.identity===functionIdentity(row.signature)).body_fingerprint={md5:row.body_md5,owner_relation:relation};
    return true;
}
// A second finite supplemental shape: two scalar definer profiles with literal
// NULL defaults and a two-state body digest set. It never creates primary proof.
function profileRefusal(body,guards) {
    const {nodes,declarations}=new GuardParser(body).parse();
    if(declarations.length||nodes.length!==1||!refuses(nodes[0])||nodes[0].branches.length!==1)return false;
    const branch=nodes[0].branches[0],raise=branch.nodes[0].tokens,tokens=branch.condition;
    if(raise.length!==3||raise[2].kind!=='string'||!same(tokens.slice(0,6),'EXISTS(SELECT 1 FROM (')||tokens.at(-1)?.value!==')')return false;
    const left=tokens.findIndex(t=>word(t,'left'));if(left<0)return false;
    const {alias,columns,rows}=finiteRows([...sqlTokens('bounded IN SELECT * FROM'),...tokens.slice(5,left)]);
    if(alias!=='expected'||JSON.stringify(columns)!==JSON.stringify(['signature','default_count','default_source','first_md5','second_md5'])||rows.length!==2||guards.length!==2)return false;
    const where=tokens.findIndex(t=>word(t,'where'));
    if(where<0||!same(tokens.slice(left,where),'LEFT JOIN pg_catalog.pg_proc p ON p.oid=pg_catalog.to_regprocedure(expected.signature)'))return false;
    const identities=rows.map(row=>typeof row.signature==='string'&&functionIdentity(row.signature));
    if(identities.some(id=>!id)||new Set(identities).size!==2||guards.some(g=>g.level!=='typed-ABI'||g.result_type!=='jsonb'||g.returns_set!==false||g.overloads!==1||!g.quiescence_guard||!identities.includes(g.identity)||g.profile_fingerprint||g.body_fingerprint))return false;
    const count=guards[0].input_names.length;
    if(count!==6||guards.some(g=>g.input_names.length!==count))return false;
    for(const row of rows) {
        const identity=functionIdentity(row.signature),types=identity.slice(identity.indexOf('(')+1,-1).split(',');
        if(types.length!==count||!Number.isSafeInteger(row.default_count)||row.default_count<1||row.default_count>count||row.default_source!==types.slice(-row.default_count).map(type=>'NULL::'+type).join(', ')||![row.first_md5,row.second_md5].every(hash=>typeof hash==='string'&&/^[0-9a-f]{32}$/.test(hash)))return false;
    }
    const conditions=[
        'p.oid IS NULL',"p.pronamespace IS DISTINCT FROM 'public'::regnamespace",`p.pronargs<>${count}`,'p.provariadic<>0',
        'p.proargmodes IS NOT NULL','p.proallargtypes IS NOT NULL',
        'p.pronargdefaults IS DISTINCT FROM expected.default_count',
        'pg_catalog.pg_get_expr(p.proargdefaults,0) IS DISTINCT FROM expected.default_source',
        'p.proowner IS DISTINCT FROM pg_catalog.to_regrole(current_user)',
        "p.prolang IS DISTINCT FROM (SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')",
        'NOT p.prosecdef',"p.provolatile<>'v'",'p.proisstrict','p.proleakproof',"p.proparallel<>'u'",
        'p.procost IS DISTINCT FROM 100::real','p.prorows IS DISTINCT FROM 0::real',
        'p.prosupport<>0','p.probin IS NOT NULL','p.prosqlbody IS NOT NULL','p.protrftypes IS NOT NULL',
        "p.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp']::text[]",
        'pg_catalog.md5(p.prosrc) NOT IN(expected.first_md5,expected.second_md5)',
        "pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')",
        "pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')",
        "NOT pg_catalog.has_function_privilege('app_tenant',p.oid,'EXECUTE')",
        "NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')",
        "pg_catalog.has_function_privilege('app_tenant',p.oid,'EXECUTE WITH GRANT OPTION')",
        "pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE WITH GRANT OPTION')",
        "(SELECT count(*) FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))))<>3",
        "EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE NOT(a.grantor=p.proowner AND a.privilege_type='EXECUTE' AND ((a.grantee=p.proowner AND a.is_grantable IS NOT DISTINCT FROM (SELECT b.is_grantable FROM pg_catalog.aclexplode(pg_catalog.acldefault('f',p.proowner)) b WHERE b.grantee=p.proowner)) OR (a.grantee IN('app_tenant'::regrole::oid,'service_role'::regrole::oid) AND NOT a.is_grantable))))"
    ];
    if(!equalTerms(tokens.slice(where+1,-1),conditions))return false;
    for(const row of rows)guards.find(g=>g.identity===functionIdentity(row.signature)).profile_fingerprint={default_count:row.default_count,default_source:row.default_source,body_md5s:[row.first_md5,row.second_md5]};
    return true;
}
function baseRollbackSignatureGuards(sql) {
    try {
        const statements=sqlStatements(sql);
        if(!same(statements[0]??[],'BEGIN;') || !same(statements.at(-1)??[],'COMMIT;'))return [];
        if(statements.slice(1,-1).some(s=>['begin','commit','rollback','savepoint'].includes(s[0]?.value)))return [];
        const firstMutation=statements.findIndex(s=>['create','drop','alter','insert','update','delete','truncate','grant','revoke','call'].includes(s[0]?.value) || literalRestorations(s).length);
        if(firstMutation<0)return [];
        const guards=[];
        for(const statement of statements.slice(1,firstMutation)) {
            if(word(statement[0],'do') && statement.length===3 && statement[1].kind==='body') {
                if(profileRefusal(statement[1].value,guards)||fingerprintRefusal(statement[1].value,guards))continue;
                const rows=analyzeBlock(statement[1].value, restoredDefinitions(sql));
                if(!rows.length && !new GuardParser(statement[1].value).parse().nodes.every(node=>node.op==='raise'||readOnlyRefusal(node)))return [];
                guards.push(...rows.map(row=>({...row,guard_start:statement[0].start})));
            } else if(statement[0]?.value==='select' && !/^select pg_advisory_xact_lock \( hashtextextended \( '[^']+' , 0 \) \) ;$/.test(tokenText(statement)))return [];
            else if(statement[0]?.value==='set' && /^set local lock_timeout = '[1-9][0-9]*(?:ms|s)' ;$/.test(tokenText(statement)))continue;
            else if(statement[0]?.value!=='select' && !/^lock table public \./.test(tokenText(statement)) && !same(statement,'LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;'))return [];
        }
        if(guards.some(g=>g.requires_catalog_lock||g.profile_fingerprint)&&!same(statements[1]??[],'LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;'))return [];
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
export function guardedRestorations(sql, {forwardSql} = {}) {
    const guards=[...rollbackSignatureGuards(sql), ...birthBoundSignatureGuards(sql,forwardSql)];
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

// Closed finite templates use bound identities, not filenames or function names.
const RETENTION_SOURCE_TEMPLATE="begin ;\nlock table pg_catalog . pg_proc in share row exclusive mode ;\nset local search_path = pg_catalog , public , pg_temp ;\ndo {declare v_expected record ; v_live pg_catalog . pg_proc % rowtype ; v_count integer ; begin if pg_catalog . current_setting ( 'transaction_isolation' ) <> 'read committed' or exists ( select 1 from pg_catalog . pg_locks l where l . locktype = 'transactionid' and l . mode = 'ExclusiveLock' and l . granted and ( l . pid is null or l . pid <> pg_catalog . pg_backend_pid ( ) ) ) or exists ( select 1 from pg_catalog . pg_prepared_xacts ) then raise exception '__literal_refusal__' ; end if ; for v_expected in select * from ( values __primary_rows__ ) expected ( name , signature , input_names , result_type , returns_set , overloads ) loop select count ( * ) into v_count from pg_catalog . pg_proc p join pg_catalog . pg_namespace n on n . oid = p . pronamespace where n . nspname = 'public' and p . proname = v_expected . name ; if v_count <> v_expected . overloads or pg_catalog . to_regprocedure ( v_expected . signature ) is null then raise exception '__literal_refusal__' ; end if ; select * into v_live from pg_catalog . pg_proc p where p . oid = pg_catalog . to_regprocedure ( v_expected . signature ) ; if coalesce ( v_live . proargnames [ 1 : v_live . pronargs ] , array [ ] :: text [ ] ) is distinct from v_expected . input_names or v_live . prorettype is distinct from v_expected . result_type :: regtype or v_live . proretset is distinct from v_expected . returns_set or v_live . prokind <> 'f' then raise exception '__literal_refusal__' ; end if ; end loop ; end} ;\ndo {begin if pg_catalog . to_regclass ( 'public.__receipt__' ) is null then raise exception '__literal_refusal__' ; end if ; if ( select count ( * ) from pg_catalog . pg_class r join pg_catalog . pg_namespace n on n . oid = r . relnamespace where n . nspname = 'public' and r . relname in ( '__receipt__' , '__child_0__' , '__child_1__' ) and r . relkind = 'r' and r . relpersistence = 'p' and not r . relispartition ) <> 3 then raise exception '__literal_refusal__' ; end if ; end} ;\nlock table pg_catalog . pg_class , pg_catalog . pg_attribute , pg_catalog . pg_attrdef , pg_catalog . pg_constraint , pg_catalog . pg_index , pg_catalog . pg_trigger , pg_catalog . pg_policy , pg_catalog . pg_depend , pg_catalog . pg_description , pg_catalog . pg_seclabel , pg_catalog . pg_inherits , pg_catalog . pg_rewrite , pg_catalog . pg_type , pg_catalog . pg_namespace , pg_catalog . pg_language , pg_catalog . pg_shdepend , pg_catalog . pg_auth_members , pg_catalog . pg_authid , pg_catalog . pg_opclass , pg_catalog . pg_opfamily , pg_catalog . pg_operator , pg_catalog . pg_am , pg_catalog . pg_collation , pg_catalog . pg_tablespace in share row exclusive mode nowait ;\nlock table public . __receipt__ , public . __child_0__ , public . __child_1__ in access exclusive mode nowait ;\ndo {begin if exists ( select 1 from pg_catalog . pg_proc p join pg_catalog . pg_namespace n on n . oid = p . pronamespace where n . nspname = 'public' and p . proname in ( '__fn_apply__' , '__fn_actor__' , '__fn_bump__' , '__fn_immutable__' , '__fn_snapshot__' , '__fn_read__' ) and ( p . proargdefaults is not null or p . pronargdefaults <> 0 or p . proallargtypes is not null or p . proargmodes is not null ) ) then raise exception '__literal_refusal__' ; end if ; if ( select count ( * ) from pg_catalog . pg_attribute t where t . attrelid = 'public.__receipt__' :: regclass and t . attnum > 0 ) <> 9 or exists ( select 1 from pg_catalog . pg_attribute t left join ( values ( 1 , 'idempotency_key' , 'pg_catalog.uuid' :: regtype ) , ( 2 , 'operation' , 'pg_catalog.text' :: regtype ) , ( 3 , 'store_id' , 'pg_catalog.uuid' :: regtype ) , ( 4 , 'product_id' , 'pg_catalog.uuid' :: regtype ) , ( 5 , 'actor_id' , 'pg_catalog.uuid' :: regtype ) , ( 6 , 'expected_version' , 'pg_catalog.int4' :: regtype ) , ( 7 , 'mutation' , 'pg_catalog.jsonb' :: regtype ) , ( 8 , 'response' , 'pg_catalog.jsonb' :: regtype ) , ( 9 , 'created_at' , 'pg_catalog.timestamptz' :: regtype ) ) expected ( num , name , type_oid ) on expected . num = t . attnum where t . attrelid = 'public.__receipt__' :: regclass and t . attnum > 0 and ( expected . num is null or t . attname is distinct from expected . name or t . atttypid is distinct from expected . type_oid or t . atttypmod <> - 1 or t . attisdropped ) ) then raise exception '__literal_refusal__' ; end if ; if ( select count ( * ) from pg_catalog . pg_attrdef d where d . adrelid = 'public.__receipt__' :: regclass ) <> 1 or exists ( select 1 from pg_catalog . pg_attrdef d where d . adrelid = 'public.__receipt__' :: regclass and ( d . adnum <> 9 or pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . regexp_replace ( ( d . adbin ) :: text , ':location -?[0-9]+' , ':location #' , 'g' ) , ':funcid ' || ( 'pg_catalog.now()' :: regprocedure :: oid ) :: text || ' ' , ':funcid @now ' ) , ':funcid ' || ( 'pg_catalog.jsonb_typeof(jsonb)' :: regprocedure :: oid ) :: text || ' ' , ':funcid @jsonb_typeof ' ) , ':opno ' || ( 'pg_catalog.>(integer,integer)' :: regoperator :: oid ) :: text || ' ' , ':opno @int4_gt ' ) , ':opno ' || ( 'pg_catalog.=(text,text)' :: regoperator :: oid ) :: text || ' ' , ':opno @text_eq ' ) , ':opfuncid ' || ( 'pg_catalog.int4gt(integer,integer)' :: regprocedure :: oid ) :: text || ' ' , ':opfuncid @int4gt ' ) , ':opfuncid ' || ( 'pg_catalog.texteq(text,text)' :: regprocedure :: oid ) :: text || ' ' , ':opfuncid @texteq ' ) , ':funcresulttype ' || ( 'pg_catalog.timestamptz' :: regtype :: oid ) :: text || ' ' , ':funcresulttype @timestamp_with_time_zone ' ) , ':opresulttype ' || ( 'pg_catalog.bool' :: regtype :: oid ) :: text || ' ' , ':opresulttype @bool ' ) , ':vartype ' || ( 'pg_catalog.int4' :: regtype :: oid ) :: text || ' ' , ':vartype @integer ' ) , ':consttype ' || ( 'pg_catalog.int4' :: regtype :: oid ) :: text || ' ' , ':consttype @integer ' ) , ':inputcollid ' || ( 'pg_catalog.default' :: regcollation :: oid ) :: text || ' ' , ':inputcollid @default_collation ' ) , ':funcresulttype ' || ( 'pg_catalog.text' :: regtype :: oid ) :: text || ' ' , ':funcresulttype @text ' ) , ':funccollid ' || ( 'pg_catalog.default' :: regcollation :: oid ) :: text || ' ' , ':funccollid @default_collation ' ) , ':vartype ' || ( 'pg_catalog.jsonb' :: regtype :: oid ) :: text || ' ' , ':vartype @jsonb ' ) , ':consttype ' || ( 'pg_catalog.text' :: regtype :: oid ) :: text || ' ' , ':consttype @text ' ) , ':constcollid ' || ( 'pg_catalog.default' :: regcollation :: oid ) :: text || ' ' , ':constcollid @default_collation ' ) , ':vartype ' || ( 'pg_catalog.text' :: regtype :: oid ) :: text || ' ' , ':vartype @text ' ) , ':varcollid ' || ( 'pg_catalog.default' :: regcollation :: oid ) :: text || ' ' , ':varcollid @default_collation ' ) is distinct from '{FUNCEXPR :funcid @now :funcresulttype @timestamp_with_time_zone :funcretset false :funcvariadic false :funcformat 0 :funccollid 0 :inputcollid 0 :args <> :location #}' ) ) then raise exception '__literal_refusal__' ; end if ; if exists ( select 1 from pg_catalog . pg_constraint t left join ( values ( '__check_expected_version__' , '{OPEXPR :opno @int4_gt :opfuncid @int4gt :opresulttype @bool :opretset false :opcollid 0 :inputcollid 0 :args ({VAR :varno 1 :varattno 6 :vartype @integer :vartypmod -1 :varcollid 0 :varnullingrels (b) :varlevelsup 0 :varnosyn 1 :varattnosyn 6 :location #} {CONST :consttype @integer :consttypmod -1 :constcollid 0 :constlen 4 :constbyval true :constisnull false :location # :constvalue 4 [ 0 0 0 0 0 0 0 0 ]}) :location #}' ) , ( '__check_mutation__' , '{OPEXPR :opno @text_eq :opfuncid @texteq :opresulttype @bool :opretset false :opcollid 0 :inputcollid @default_collation :args ({FUNCEXPR :funcid @jsonb_typeof :funcresulttype @text :funcretset false :funcvariadic false :funcformat 0 :funccollid @default_collation :inputcollid 0 :args ({VAR :varno 1 :varattno 7 :vartype @jsonb :vartypmod -1 :varcollid 0 :varnullingrels (b) :varlevelsup 0 :varnosyn 1 :varattnosyn 7 :location #}) :location #} {CONST :consttype @text :consttypmod -1 :constcollid @default_collation :constlen -1 :constbyval false :constisnull false :location # :constvalue 10 [ 40 0 0 0 111 98 106 101 99 116 ]}) :location #}' ) , ( '__check_operation__' , '{OPEXPR :opno @text_eq :opfuncid @texteq :opresulttype @bool :opretset false :opcollid 0 :inputcollid @default_collation :args ({VAR :varno 1 :varattno 2 :vartype @text :vartypmod -1 :varcollid @default_collation :varnullingrels (b) :varlevelsup 0 :varnosyn 1 :varattnosyn 2 :location #} {CONST :consttype @text :consttypmod -1 :constcollid @default_collation :constlen -1 :constbyval false :constisnull false :location # :constvalue 21 [ 84 0 0 0 112 114 111 100 117 99 116 46 117 112 100 97 116 101 46 118 49 ]}) :location #}' ) , ( '__check_response__' , '{OPEXPR :opno @text_eq :opfuncid @texteq :opresulttype @bool :opretset false :opcollid 0 :inputcollid @default_collation :args ({FUNCEXPR :funcid @jsonb_typeof :funcresulttype @text :funcretset false :funcvariadic false :funcformat 0 :funccollid @default_collation :inputcollid 0 :args ({VAR :varno 1 :varattno 8 :vartype @jsonb :vartypmod -1 :varcollid 0 :varnullingrels (b) :varlevelsup 0 :varnosyn 1 :varattnosyn 8 :location #}) :location #} {CONST :consttype @text :consttypmod -1 :constcollid @default_collation :constlen -1 :constbyval false :constisnull false :location # :constvalue 10 [ 40 0 0 0 111 98 106 101 99 116 ]}) :location #}' ) ) expected ( name , node ) on expected . name = t . conname where t . conrelid = 'public.__receipt__' :: regclass and ( ( t . contype = 'c' and ( expected . name is null or pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . replace ( pg_catalog . regexp_replace ( ( t . conbin ) :: text , ':location -?[0-9]+' , ':location #' , 'g' ) , ':funcid ' || ( 'pg_catalog.now()' :: regprocedure :: oid ) :: text || ' ' , ':funcid @now ' ) , ':funcid ' || ( 'pg_catalog.jsonb_typeof(jsonb)' :: regprocedure :: oid ) :: text || ' ' , ':funcid @jsonb_typeof ' ) , ':opno ' || ( 'pg_catalog.>(integer,integer)' :: regoperator :: oid ) :: text || ' ' , ':opno @int4_gt ' ) , ':opno ' || ( 'pg_catalog.=(text,text)' :: regoperator :: oid ) :: text || ' ' , ':opno @text_eq ' ) , ':opfuncid ' || ( 'pg_catalog.int4gt(integer,integer)' :: regprocedure :: oid ) :: text || ' ' , ':opfuncid @int4gt ' ) , ':opfuncid ' || ( 'pg_catalog.texteq(text,text)' :: regprocedure :: oid ) :: text || ' ' , ':opfuncid @texteq ' ) , ':funcresulttype ' || ( 'pg_catalog.timestamptz' :: regtype :: oid ) :: text || ' ' , ':funcresulttype @timestamp_with_time_zone ' ) , ':opresulttype ' || ( 'pg_catalog.bool' :: regtype :: oid ) :: text || ' ' , ':opresulttype @bool ' ) , ':vartype ' || ( 'pg_catalog.int4' :: regtype :: oid ) :: text || ' ' , ':vartype @integer ' ) , ':consttype ' || ( 'pg_catalog.int4' :: regtype :: oid ) :: text || ' ' , ':consttype @integer ' ) , ':inputcollid ' || ( 'pg_catalog.default' :: regcollation :: oid ) :: text || ' ' , ':inputcollid @default_collation ' ) , ':funcresulttype ' || ( 'pg_catalog.text' :: regtype :: oid ) :: text || ' ' , ':funcresulttype @text ' ) , ':funccollid ' || ( 'pg_catalog.default' :: regcollation :: oid ) :: text || ' ' , ':funccollid @default_collation ' ) , ':vartype ' || ( 'pg_catalog.jsonb' :: regtype :: oid ) :: text || ' ' , ':vartype @jsonb ' ) , ':consttype ' || ( 'pg_catalog.text' :: regtype :: oid ) :: text || ' ' , ':consttype @text ' ) , ':constcollid ' || ( 'pg_catalog.default' :: regcollation :: oid ) :: text || ' ' , ':constcollid @default_collation ' ) , ':vartype ' || ( 'pg_catalog.text' :: regtype :: oid ) :: text || ' ' , ':vartype @text ' ) , ':varcollid ' || ( 'pg_catalog.default' :: regcollation :: oid ) :: text || ' ' , ':varcollid @default_collation ' ) is distinct from expected . node ) ) or ( t . contype <> 'c' and ( t . contype <> 'p' or t . conname <> '__receipt_pkey__' or t . conbin is not null ) ) ) ) then raise exception '__literal_refusal__' ; end if ; if exists ( select 1 from pg_catalog . pg_index i where i . indrelid = 'public.__receipt__' :: regclass and ( i . indexprs is not null or i . indpred is not null ) ) then raise exception '__literal_refusal__' ; end if ; if exists ( select 1 from pg_catalog . pg_trigger t where ( t . tgrelid = 'public.__receipt__' :: regclass or ( t . tgrelid = 'public.__child_1__' :: regclass and t . tgname = '__child_1_trigger__' ) or ( t . tgrelid = 'public.__child_0__' :: regclass and t . tgname = '__child_0_trigger__' ) ) and t . tgqual is not null ) then raise exception '__literal_refusal__' ; end if ; end} ;\ndo {begin if pg_catalog . current_setting ( 'transaction_isolation' ) <> 'read committed' or exists ( select 1 from pg_catalog . pg_locks l where l . locktype = 'transactionid' and l . mode = 'ExclusiveLock' and l . granted and ( l . pid is null or l . pid <> pg_catalog . pg_backend_pid ( ) ) ) or exists ( select 1 from pg_catalog . pg_prepared_xacts ) then raise exception '__literal_refusal__' ; end if ; if pg_catalog . current_setting ( 'server_version_num' ) :: integer / 10000 <> 16 then raise exception '__literal_refusal__' ; end if ; if ( with recursive functions as ( select p . * from pg_catalog . pg_proc p join pg_catalog . pg_namespace n on n . oid = p . pronamespace where n . nspname = 'public' and p . proname in ( '__fn_immutable__' , '__fn_bump__' , '__fn_actor__' , '__fn_snapshot__' , '__fn_read__' , '__fn_apply__' ) ) , receipt as ( select 'public.__receipt__' :: regclass :: oid as oid ) , triggers as ( select t . * from pg_catalog . pg_trigger t where t . tgrelid = ( select oid from receipt ) or ( t . tgrelid = 'public.__child_1__' :: regclass and t . tgname = '__child_1_trigger__' ) or ( t . tgrelid = 'public.__child_0__' :: regclass and t . tgname = '__child_0_trigger__' ) ) , objects as ( select 'pg_catalog.pg_proc' :: regclass :: oid as classid , oid as objid from functions union select 'pg_catalog.pg_class' :: regclass :: oid , oid from receipt union select 'pg_catalog.pg_class' :: regclass :: oid , indexrelid from pg_catalog . pg_index where indrelid = ( select oid from receipt ) union select 'pg_catalog.pg_trigger' :: regclass :: oid , oid from triggers union select 'pg_catalog.pg_constraint' :: regclass :: oid , oid from pg_catalog . pg_constraint where conrelid = ( select oid from receipt ) union select 'pg_catalog.pg_policy' :: regclass :: oid , oid from pg_catalog . pg_policy where polrelid = ( select oid from receipt ) union select 'pg_catalog.pg_attrdef' :: regclass :: oid , oid from pg_catalog . pg_attrdef where adrelid = ( select oid from receipt ) union select 'pg_catalog.pg_rewrite' :: regclass :: oid , oid from pg_catalog . pg_rewrite where ev_class = ( select oid from receipt ) ) , internal_footprint as ( select classid , objid from objects union select d . classid , d . objid from pg_catalog . pg_depend d join internal_footprint o on d . refclassid = o . classid and d . refobjid = o . objid where d . deptype = 'i' ) , full_footprint as ( select classid , objid from internal_footprint union select 'pg_catalog.pg_class' :: regclass :: oid , i . indexrelid from pg_catalog . pg_index i where i . indrelid = ( select reltoastrelid from pg_catalog . pg_class where oid = ( select oid from receipt ) ) ) select pg_catalog . jsonb_build_object ( 'functions' , ( select pg_catalog . jsonb_object_agg ( p . proname , ( pg_catalog . to_jsonb ( p ) - array [ 'oid' , 'proowner' , 'pronamespace' , 'prolang' , 'proargtypes' , 'prorettype' , 'proacl' ] :: text [ ] ) || pg_catalog . jsonb_build_object ( 'namespace' , 'public' , 'owner_valid' , p . proowner = pg_catalog . to_regrole ( current_user ) , 'language' , l . lanname , 'input_types' , ( select coalesce ( pg_catalog . jsonb_agg ( pg_catalog . format_type ( t . oid , null ) order by t . n ) , '[]' ) from pg_catalog . unnest ( p . proargtypes :: oid [ ] ) with ordinality t ( oid , n ) ) , 'result_type' , pg_catalog . format_type ( p . prorettype , null ) , 'default_source' , pg_catalog . pg_get_expr ( p . proargdefaults , 0 ) , 'body_md5' , pg_catalog . md5 ( p . prosrc ) , 'acl' , ( select coalesce ( pg_catalog . jsonb_object_agg ( pg_catalog . jsonb_build_array ( case when z . grantee = 0 then 'PUBLIC' when z . grantee = pg_catalog . to_regrole ( current_user ) then '$owner' else pg_catalog . pg_get_userbyid ( z . grantee ) end , case when z . grantor = pg_catalog . to_regrole ( current_user ) then '$owner' else pg_catalog . pg_get_userbyid ( z . grantor ) end , z . privilege_type , z . is_grantable ) :: text , pg_catalog . jsonb_build_object ( 'grantee' , case when z . grantee = 0 then 'PUBLIC' when z . grantee = pg_catalog . to_regrole ( current_user ) then '$owner' else pg_catalog . pg_get_userbyid ( z . grantee ) end , 'grantor' , case when z . grantor = pg_catalog . to_regrole ( current_user ) then '$owner' else pg_catalog . pg_get_userbyid ( z . grantor ) end , 'privilege' , z . privilege_type , 'grantable' , z . is_grantable ) ) , '{}' :: jsonb ) from pg_catalog . aclexplode ( case when pg_catalog . cardinality ( coalesce ( p . proacl , pg_catalog . acldefault ( 'f' , p . proowner ) ) ) = 0 then null :: pg_catalog . aclitem [ ] else coalesce ( p . proacl , pg_catalog . acldefault ( 'f' , p . proowner ) ) end ) z ) ) ) from functions p join pg_catalog . pg_language l on l . oid = p . prolang ) , 'receipt' , ( select ( ( pg_catalog . to_jsonb ( r ) - array [ 'oid' , 'relowner' , 'relnamespace' , 'reltype' , 'relam' , 'reltablespace' , 'reltoastrelid' , 'relrewrite' , 'relfilenode' , 'relpages' , 'reltuples' , 'relallvisible' , 'relfrozenxid' , 'relminmxid' , 'relacl' , 'reloftype' ] :: text [ ] ) || pg_catalog . jsonb_build_object ( 'namespace' , ( select n . nspname from pg_catalog . pg_namespace n where n . oid = r . relnamespace ) , 'owner_valid' , r . relowner = pg_catalog . to_regrole ( current_user ) , 'access_method' , ( select m . amname from pg_catalog . pg_am m where m . oid = r . relam ) , 'tablespace' , case when r . reltablespace = 0 then null else ( select s . spcname from pg_catalog . pg_tablespace s where s . oid = r . reltablespace ) end , 'typed_table' , case when r . reloftype = 0 then null else pg_catalog . format_type ( r . reloftype , null ) end , 'acl' , ( select coalesce ( pg_catalog . jsonb_object_agg ( pg_catalog . jsonb_build_array ( case when z . grantee = 0 then 'PUBLIC' when z . grantee = pg_catalog . to_regrole ( current_user ) then '$owner' else pg_catalog . pg_get_userbyid ( z . grantee ) end , case when z . grantor = pg_catalog . to_regrole ( current_user ) then '$owner' else pg_catalog . pg_get_userbyid ( z . grantor ) end , z . privilege_type , z . is_grantable ) :: text , pg_catalog . jsonb_build_object ( 'grantee' , case when z . grantee = 0 then 'PUBLIC' when z . grantee = pg_catalog . to_regrole ( current_user ) then '$owner' else pg_catalog . pg_get_userbyid ( z . grantee ) end , 'grantor' , case when z . grantor = pg_catalog . to_regrole ( current_user ) then '$owner' else pg_catalog . pg_get_userbyid ( z . grantor ) end , 'privilege' , z . privilege_type , 'grantable' , z . is_grantable ) ) , '{}' :: jsonb ) from pg_catalog . aclexplode ( case when pg_catalog . cardinality ( coalesce ( r . relacl , case when r . relkind = 'r' then pg_catalog . acldefault ( 'r' , r . relowner ) else '{}' :: pg_catalog . aclitem [ ] end ) ) = 0 then null :: pg_catalog . aclitem [ ] else coalesce ( r . relacl , case when r . relkind = 'r' then pg_catalog . acldefault ( 'r' , r . relowner ) else '{}' :: pg_catalog . aclitem [ ] end ) end ) z ) , 'rowtype_link_valid' , case when r . relkind = 'r' then exists ( select 1 from pg_catalog . pg_type y where y . oid = r . reltype and y . typrelid = r . oid and y . typname = r . relname and y . typnamespace = r . relnamespace and y . typowner = r . relowner and y . typtype = 'c' ) else r . reltype = 0 end , 'toast_present' , r . reltoastrelid <> 0 , 'toast_link_valid' , ( r . reltoastrelid = 0 or exists ( select 1 from pg_catalog . pg_class t where t . oid = r . reltoastrelid and t . relkind = 't' and t . relnamespace = 'pg_toast' :: regnamespace and t . relowner = r . relowner and ( select count ( * ) from pg_catalog . pg_index i where i . indrelid = t . oid ) = 1 ) ) , 'rewrite_absent' , r . relrewrite = 0 ) ) from pg_catalog . pg_class r where r . oid = ( select oid from receipt ) ) , 'attributes' , ( select pg_catalog . jsonb_object_agg ( t . attnum :: text , ( pg_catalog . to_jsonb ( t ) - array [ 'attrelid' , 'atttypid' , 'attcollation' , 'attcacheoff' , 'attacl' ] :: text [ ] ) || pg_catalog . jsonb_build_object ( 'type' , pg_catalog . format_type ( t . atttypid , t . atttypmod ) , 'collation_absent' , t . attcollation = 0 , 'collation_default' , t . attcollation = 'pg_catalog.default' :: regcollation , 'acl' , ( select coalesce ( pg_catalog . jsonb_object_agg ( pg_catalog . jsonb_build_array ( case when z . grantee = 0 then 'PUBLIC' when z . grantee = pg_catalog . to_regrole ( current_user ) then '$owner' else pg_catalog . pg_get_userbyid ( z . grantee ) end , case when z . grantor = pg_catalog . to_regrole ( current_user ) then '$owner' else pg_catalog . pg_get_userbyid ( z . grantor ) end , z . privilege_type , z . is_grantable ) :: text , pg_catalog . jsonb_build_object ( 'grantee' , case when z . grantee = 0 then 'PUBLIC' when z . grantee = pg_catalog . to_regrole ( current_user ) then '$owner' else pg_catalog . pg_get_userbyid ( z . grantee ) end , 'grantor' , case when z . grantor = pg_catalog . to_regrole ( current_user ) then '$owner' else pg_catalog . pg_get_userbyid ( z . grantor ) end , 'privilege' , z . privilege_type , 'grantable' , z . is_grantable ) ) , '{}' :: jsonb ) from pg_catalog . aclexplode ( case when pg_catalog . cardinality ( coalesce ( t . attacl , '{}' :: pg_catalog . aclitem [ ] ) ) = 0 then null :: pg_catalog . aclitem [ ] else coalesce ( t . attacl , '{}' :: pg_catalog . aclitem [ ] ) end ) z ) ) ) from pg_catalog . pg_attribute t where t . attrelid = ( select oid from receipt ) and t . attnum > 0 ) , 'defaults' , ( select coalesce ( pg_catalog . jsonb_object_agg ( t . adnum :: text , pg_catalog . pg_get_expr ( t . adbin , t . adrelid ) ) , '{}' ) from pg_catalog . pg_attrdef t where t . adrelid = ( select oid from receipt ) ) , 'constraints' , ( select coalesce ( pg_catalog . jsonb_object_agg ( t . conname , ( pg_catalog . to_jsonb ( t ) - array [ 'oid' , 'connamespace' , 'conrelid' , 'contypid' , 'conindid' , 'conparentid' , 'confrelid' , 'conbin' ] :: text [ ] ) || pg_catalog . jsonb_build_object ( 'namespace' , 'public' , 'typed_constraint_absent' , t . contypid = 0 , 'index' , case when t . conindid = 0 then null else ( select n . nspname || '.' || r . relname from pg_catalog . pg_class r join pg_catalog . pg_namespace n on n . oid = r . relnamespace where r . oid = t . conindid ) end , 'parent_absent' , t . conparentid = 0 , 'foreign_relation_absent' , t . confrelid = 0 , 'definition' , pg_catalog . pg_get_constraintdef ( t . oid , true ) ) ) , '{}' ) from pg_catalog . pg_constraint t where t . conrelid = ( select oid from receipt ) ) , 'indexes' , ( select coalesce ( pg_catalog . jsonb_object_agg ( r . relname , ( pg_catalog . to_jsonb ( t ) - array [ 'indexrelid' , 'indrelid' , 'indclass' , 'indcollation' ] :: text [ ] ) || pg_catalog . jsonb_build_object ( 'definition' , pg_catalog . pg_get_indexdef ( t . indexrelid ) , 'class_profile' , ( ( pg_catalog . to_jsonb ( r ) - array [ 'oid' , 'relowner' , 'relnamespace' , 'reltype' , 'relam' , 'reltablespace' , 'reltoastrelid' , 'relrewrite' , 'relfilenode' , 'relpages' , 'reltuples' , 'relallvisible' , 'relfrozenxid' , 'relminmxid' , 'relacl' , 'reloftype' ] :: text [ ] ) || pg_catalog . jsonb_build_object ( 'namespace' , ( select n . nspname from pg_catalog . pg_namespace n where n . oid = r . relnamespace ) , 'owner_valid' , r . relowner = pg_catalog . to_regrole ( current_user ) , 'access_method' , ( select m . amname from pg_catalog . pg_am m where m . oid = r . relam ) , 'tablespace' , case when r . reltablespace = 0 then null else ( select s . spcname from pg_catalog . pg_tablespace s where s . oid = r . reltablespace ) end , 'typed_table' , case when r . reloftype = 0 then null else pg_catalog . format_type ( r . reloftype , null ) end , 'acl' , ( select coalesce ( pg_catalog . jsonb_object_agg ( pg_catalog . jsonb_build_array ( case when z . grantee = 0 then 'PUBLIC' when z . grantee = pg_catalog . to_regrole ( current_user ) then '$owner' else pg_catalog . pg_get_userbyid ( z . grantee ) end , case when z . grantor = pg_catalog . to_regrole ( current_user ) then '$owner' else pg_catalog . pg_get_userbyid ( z . grantor ) end , z . privilege_type , z . is_grantable ) :: text , pg_catalog . jsonb_build_object ( 'grantee' , case when z . grantee = 0 then 'PUBLIC' when z . grantee = pg_catalog . to_regrole ( current_user ) then '$owner' else pg_catalog . pg_get_userbyid ( z . grantee ) end , 'grantor' , case when z . grantor = pg_catalog . to_regrole ( current_user ) then '$owner' else pg_catalog . pg_get_userbyid ( z . grantor ) end , 'privilege' , z . privilege_type , 'grantable' , z . is_grantable ) ) , '{}' :: jsonb ) from pg_catalog . aclexplode ( case when pg_catalog . cardinality ( coalesce ( r . relacl , case when r . relkind = 'r' then pg_catalog . acldefault ( 'r' , r . relowner ) else '{}' :: pg_catalog . aclitem [ ] end ) ) = 0 then null :: pg_catalog . aclitem [ ] else coalesce ( r . relacl , case when r . relkind = 'r' then pg_catalog . acldefault ( 'r' , r . relowner ) else '{}' :: pg_catalog . aclitem [ ] end ) end ) z ) , 'rowtype_link_valid' , case when r . relkind = 'r' then exists ( select 1 from pg_catalog . pg_type y where y . oid = r . reltype and y . typrelid = r . oid and y . typname = r . relname and y . typnamespace = r . relnamespace and y . typowner = r . relowner and y . typtype = 'c' ) else r . reltype = 0 end , 'toast_present' , r . reltoastrelid <> 0 , 'toast_link_valid' , ( r . reltoastrelid = 0 or exists ( select 1 from pg_catalog . pg_class t where t . oid = r . reltoastrelid and t . relkind = 't' and t . relnamespace = 'pg_toast' :: regnamespace and t . relowner = r . relowner and ( select count ( * ) from pg_catalog . pg_index i where i . indrelid = t . oid ) = 1 ) ) , 'rewrite_absent' , r . relrewrite = 0 ) ) , 'opclasses_default' , not exists ( select 1 from pg_catalog . unnest ( t . indclass :: oid [ ] ) with ordinality z ( oid , n ) left join pg_catalog . pg_opclass o on o . oid = z . oid left join pg_catalog . pg_attribute at on at . attrelid = t . indrelid and at . attnum = t . indkey [ ( z . n - 1 ) :: integer ] where o . oid is null or not o . opcdefault or o . opcnamespace <> 'pg_catalog' :: regnamespace or o . opcmethod <> r . relam or o . opcintype is distinct from at . atttypid ) , 'collations_absent' , not exists ( select 1 from pg_catalog . unnest ( t . indcollation :: oid [ ] ) z where z <> 0 ) ) ) , '{}' ) from pg_catalog . pg_index t join pg_catalog . pg_class r on r . oid = t . indexrelid where t . indrelid = ( select oid from receipt ) ) , 'triggers' , ( select coalesce ( pg_catalog . jsonb_object_agg ( n . nspname || '.' || r . relname || '.' || t . tgname , ( pg_catalog . to_jsonb ( t ) - array [ 'oid' , 'tgrelid' , 'tgfoid' , 'tgconstrrelid' , 'tgconstrindid' , 'tgconstraint' , 'tgparentid' ] :: text [ ] ) || pg_catalog . jsonb_build_object ( 'relation' , n . nspname || '.' || r . relname , 'function' , ( select fn . nspname || '.' || p . proname || '()' from pg_catalog . pg_proc p join pg_catalog . pg_namespace fn on fn . oid = p . pronamespace where p . oid = t . tgfoid ) , 'constraint_links_absent' , t . tgconstrrelid = 0 and t . tgconstrindid = 0 and t . tgconstraint = 0 and t . tgparentid = 0 , 'definition' , pg_catalog . pg_get_triggerdef ( t . oid , true ) ) ) , '{}' ) from triggers t join pg_catalog . pg_class r on r . oid = t . tgrelid join pg_catalog . pg_namespace n on n . oid = r . relnamespace ) , 'policies' , ( select coalesce ( pg_catalog . jsonb_agg ( pg_catalog . to_jsonb ( t ) ) , '[]' ) from pg_catalog . pg_policy t where t . polrelid = ( select oid from receipt ) ) , 'rules' , ( select coalesce ( pg_catalog . jsonb_agg ( pg_catalog . to_jsonb ( t ) ) , '[]' ) from pg_catalog . pg_rewrite t where t . ev_class = ( select oid from receipt ) ) , 'comments' , ( select coalesce ( pg_catalog . jsonb_agg ( pg_catalog . to_jsonb ( t ) ) , '[]' ) from pg_catalog . pg_description t where ( t . classoid , t . objoid ) in ( select * from objects ) ) , 'security_labels' , ( select coalesce ( pg_catalog . jsonb_agg ( pg_catalog . to_jsonb ( t ) ) , '[]' ) from pg_catalog . pg_seclabel t where ( t . classoid , t . objoid ) in ( select * from objects ) ) , 'inheritance' , ( select coalesce ( pg_catalog . jsonb_agg ( pg_catalog . to_jsonb ( t ) ) , '[]' ) from pg_catalog . pg_inherits t where t . inhrelid = ( select oid from receipt ) or t . inhparent = ( select oid from receipt ) ) , 'dependencies' , ( select coalesce ( pg_catalog . jsonb_object_agg ( pg_catalog . jsonb_build_array ( ( case when t . classid = 'pg_catalog.pg_class' :: regclass and t . objid = ( select reltoastrelid from pg_catalog . pg_class where oid = ( select oid from receipt ) ) then pg_catalog . jsonb_build_object ( 'name' , '$receipt_toast' , 'type' , 'toast table' , 'schema' , 'pg_toast' , 'identity' , 'pg_toast.$receipt_toast' ) else pg_catalog . to_jsonb ( pg_catalog . pg_identify_object ( t . classid , t . objid , t . objsubid ) ) end ) - > > 'type' , ( case when t . classid = 'pg_catalog.pg_class' :: regclass and t . objid = ( select reltoastrelid from pg_catalog . pg_class where oid = ( select oid from receipt ) ) then pg_catalog . jsonb_build_object ( 'name' , '$receipt_toast' , 'type' , 'toast table' , 'schema' , 'pg_toast' , 'identity' , 'pg_toast.$receipt_toast' ) else pg_catalog . to_jsonb ( pg_catalog . pg_identify_object ( t . classid , t . objid , t . objsubid ) ) end ) - > > 'schema' , ( case when t . classid = 'pg_catalog.pg_class' :: regclass and t . objid = ( select reltoastrelid from pg_catalog . pg_class where oid = ( select oid from receipt ) ) then pg_catalog . jsonb_build_object ( 'name' , '$receipt_toast' , 'type' , 'toast table' , 'schema' , 'pg_toast' , 'identity' , 'pg_toast.$receipt_toast' ) else pg_catalog . to_jsonb ( pg_catalog . pg_identify_object ( t . classid , t . objid , t . objsubid ) ) end ) - > > 'identity' , t . objsubid , ( case when t . refclassid = 'pg_catalog.pg_class' :: regclass and t . refobjid = ( select reltoastrelid from pg_catalog . pg_class where oid = ( select oid from receipt ) ) then pg_catalog . jsonb_build_object ( 'name' , '$receipt_toast' , 'type' , 'toast table' , 'schema' , 'pg_toast' , 'identity' , 'pg_toast.$receipt_toast' ) else pg_catalog . to_jsonb ( pg_catalog . pg_identify_object ( t . refclassid , t . refobjid , t . refobjsubid ) ) end ) - > > 'type' , ( case when t . refclassid = 'pg_catalog.pg_class' :: regclass and t . refobjid = ( select reltoastrelid from pg_catalog . pg_class where oid = ( select oid from receipt ) ) then pg_catalog . jsonb_build_object ( 'name' , '$receipt_toast' , 'type' , 'toast table' , 'schema' , 'pg_toast' , 'identity' , 'pg_toast.$receipt_toast' ) else pg_catalog . to_jsonb ( pg_catalog . pg_identify_object ( t . refclassid , t . refobjid , t . refobjsubid ) ) end ) - > > 'schema' , ( case when t . refclassid = 'pg_catalog.pg_class' :: regclass and t . refobjid = ( select reltoastrelid from pg_catalog . pg_class where oid = ( select oid from receipt ) ) then pg_catalog . jsonb_build_object ( 'name' , '$receipt_toast' , 'type' , 'toast table' , 'schema' , 'pg_toast' , 'identity' , 'pg_toast.$receipt_toast' ) else pg_catalog . to_jsonb ( pg_catalog . pg_identify_object ( t . refclassid , t . refobjid , t . refobjsubid ) ) end ) - > > 'identity' , t . refobjsubid , t . deptype ) :: text , pg_catalog . jsonb_build_object ( 'object' , case when t . classid = 'pg_catalog.pg_class' :: regclass and t . objid = ( select reltoastrelid from pg_catalog . pg_class where oid = ( select oid from receipt ) ) then pg_catalog . jsonb_build_object ( 'name' , '$receipt_toast' , 'type' , 'toast table' , 'schema' , 'pg_toast' , 'identity' , 'pg_toast.$receipt_toast' ) else pg_catalog . to_jsonb ( pg_catalog . pg_identify_object ( t . classid , t . objid , t . objsubid ) ) end , 'reference' , case when t . refclassid = 'pg_catalog.pg_class' :: regclass and t . refobjid = ( select reltoastrelid from pg_catalog . pg_class where oid = ( select oid from receipt ) ) then pg_catalog . jsonb_build_object ( 'name' , '$receipt_toast' , 'type' , 'toast table' , 'schema' , 'pg_toast' , 'identity' , 'pg_toast.$receipt_toast' ) else pg_catalog . to_jsonb ( pg_catalog . pg_identify_object ( t . refclassid , t . refobjid , t . refobjsubid ) ) end , 'subid' , t . objsubid , 'refsubid' , t . refobjsubid , 'deptype' , t . deptype ) ) , '{}' ) from pg_catalog . pg_depend t where ( t . classid , t . objid ) in ( select * from objects ) or ( t . refclassid , t . refobjid ) in ( select * from objects ) ) , 'shared_dependencies' , ( select coalesce ( pg_catalog . jsonb_object_agg ( pg_catalog . jsonb_build_array ( ( case when t . classid = 'pg_catalog.pg_class' :: regclass and t . objid = ( select reltoastrelid from pg_catalog . pg_class where oid = ( select oid from receipt ) ) then pg_catalog . jsonb_build_object ( 'name' , '$receipt_toast' , 'type' , 'toast table' , 'schema' , 'pg_toast' , 'identity' , 'pg_toast.$receipt_toast' ) else pg_catalog . to_jsonb ( pg_catalog . pg_identify_object ( t . classid , t . objid , t . objsubid ) ) end ) - > > 'type' , ( case when t . classid = 'pg_catalog.pg_class' :: regclass and t . objid = ( select reltoastrelid from pg_catalog . pg_class where oid = ( select oid from receipt ) ) then pg_catalog . jsonb_build_object ( 'name' , '$receipt_toast' , 'type' , 'toast table' , 'schema' , 'pg_toast' , 'identity' , 'pg_toast.$receipt_toast' ) else pg_catalog . to_jsonb ( pg_catalog . pg_identify_object ( t . classid , t . objid , t . objsubid ) ) end ) - > > 'schema' , ( case when t . classid = 'pg_catalog.pg_class' :: regclass and t . objid = ( select reltoastrelid from pg_catalog . pg_class where oid = ( select oid from receipt ) ) then pg_catalog . jsonb_build_object ( 'name' , '$receipt_toast' , 'type' , 'toast table' , 'schema' , 'pg_toast' , 'identity' , 'pg_toast.$receipt_toast' ) else pg_catalog . to_jsonb ( pg_catalog . pg_identify_object ( t . classid , t . objid , t . objsubid ) ) end ) - > > 'identity' , t . objsubid , ( pg_catalog . to_jsonb ( pg_catalog . pg_identify_object ( t . refclassid , t . refobjid , 0 ) ) ) - > > 'type' , ( pg_catalog . to_jsonb ( pg_catalog . pg_identify_object ( t . refclassid , t . refobjid , 0 ) ) ) - > > 'schema' , ( pg_catalog . to_jsonb ( pg_catalog . pg_identify_object ( t . refclassid , t . refobjid , 0 ) ) ) - > > 'identity' , 0 , t . deptype ) :: text , pg_catalog . jsonb_build_object ( 'object' , case when t . classid = 'pg_catalog.pg_class' :: regclass and t . objid = ( select reltoastrelid from pg_catalog . pg_class where oid = ( select oid from receipt ) ) then pg_catalog . jsonb_build_object ( 'name' , '$receipt_toast' , 'type' , 'toast table' , 'schema' , 'pg_toast' , 'identity' , 'pg_toast.$receipt_toast' ) else pg_catalog . to_jsonb ( pg_catalog . pg_identify_object ( t . classid , t . objid , t . objsubid ) ) end , 'reference' , pg_catalog . to_jsonb ( pg_catalog . pg_identify_object ( t . refclassid , t . refobjid , 0 ) ) , 'subid' , t . objsubid , 'refsubid' , 0 , 'deptype' , t . deptype ) ) , '{}' ) from pg_catalog . pg_shdepend t where t . dbid = ( select oid from pg_catalog . pg_database where datname = current_database ( ) ) and ( t . classid , t . objid ) in ( select * from objects ) ) , 'roles' , ( select pg_catalog . jsonb_object_agg ( case when r . rolname = current_user then '$owner' else r . rolname end , pg_catalog . jsonb_build_object ( 'login' , r . rolcanlogin , 'super' , r . rolsuper , 'inherit' , r . rolinherit , 'create_db' , r . rolcreatedb , 'bypass_rls' , r . rolbypassrls , 'create_role' , r . rolcreaterole , 'replication' , r . rolreplication ) ) from pg_catalog . pg_roles r where r . rolname in ( current_user , 'app_tenant' , 'anon' , 'authenticated' , 'service_role' ) ) , 'api_role_memberships' , ( select coalesce ( pg_catalog . jsonb_object_agg ( pg_catalog . jsonb_build_array ( case when pg_catalog . pg_get_userbyid ( m . roleid ) = current_user then '$owner' else pg_catalog . pg_get_userbyid ( m . roleid ) end , case when pg_catalog . pg_get_userbyid ( m . member ) = current_user then '$owner' else pg_catalog . pg_get_userbyid ( m . member ) end , case when pg_catalog . pg_get_userbyid ( m . grantor ) = current_user then '$owner' else pg_catalog . pg_get_userbyid ( m . grantor ) end ) :: text , pg_catalog . jsonb_build_object ( 'role' , case when pg_catalog . pg_get_userbyid ( m . roleid ) = current_user then '$owner' else pg_catalog . pg_get_userbyid ( m . roleid ) end , 'member' , case when pg_catalog . pg_get_userbyid ( m . member ) = current_user then '$owner' else pg_catalog . pg_get_userbyid ( m . member ) end , 'grantor' , case when pg_catalog . pg_get_userbyid ( m . grantor ) = current_user then '$owner' else pg_catalog . pg_get_userbyid ( m . grantor ) end , 'admin_option' , m . admin_option , 'inherit_option' , m . inherit_option , 'set_option' , m . set_option ) ) , '{}' ) from pg_catalog . pg_auth_members m where m . member in ( select oid from pg_catalog . pg_roles where rolname in ( current_user , 'app_tenant' , 'anon' , 'authenticated' , 'service_role' ) ) ) ) ) is distinct from __literal_profile__ :: jsonb then raise exception '__literal_refusal__' ; end if ; if ( with recursive functions as ( select p . * from pg_catalog . pg_proc p join pg_catalog . pg_namespace n on n . oid = p . pronamespace where n . nspname = 'public' and p . proname in ( '__fn_immutable__' , '__fn_bump__' , '__fn_actor__' , '__fn_snapshot__' , '__fn_read__' , '__fn_apply__' ) ) , receipt as ( select 'public.__receipt__' :: regclass :: oid as oid ) , triggers as ( select t . * from pg_catalog . pg_trigger t where t . tgrelid = ( select oid from receipt ) or ( t . tgrelid = 'public.__child_1__' :: regclass and t . tgname = '__child_1_trigger__' ) or ( t . tgrelid = 'public.__child_0__' :: regclass and t . tgname = '__child_0_trigger__' ) ) , objects as ( select 'pg_catalog.pg_proc' :: regclass :: oid as classid , oid as objid from functions union select 'pg_catalog.pg_class' :: regclass :: oid , oid from receipt union select 'pg_catalog.pg_class' :: regclass :: oid , indexrelid from pg_catalog . pg_index where indrelid = ( select oid from receipt ) union select 'pg_catalog.pg_trigger' :: regclass :: oid , oid from triggers union select 'pg_catalog.pg_constraint' :: regclass :: oid , oid from pg_catalog . pg_constraint where conrelid = ( select oid from receipt ) union select 'pg_catalog.pg_policy' :: regclass :: oid , oid from pg_catalog . pg_policy where polrelid = ( select oid from receipt ) union select 'pg_catalog.pg_attrdef' :: regclass :: oid , oid from pg_catalog . pg_attrdef where adrelid = ( select oid from receipt ) union select 'pg_catalog.pg_rewrite' :: regclass :: oid , oid from pg_catalog . pg_rewrite where ev_class = ( select oid from receipt ) ) , internal_footprint as ( select classid , objid from objects union select d . classid , d . objid from pg_catalog . pg_depend d join internal_footprint o on d . refclassid = o . classid and d . refobjid = o . objid where d . deptype = 'i' ) , full_footprint as ( select classid , objid from internal_footprint union select 'pg_catalog.pg_class' :: regclass :: oid , i . indexrelid from pg_catalog . pg_index i where i . indrelid = ( select reltoastrelid from pg_catalog . pg_class where oid = ( select oid from receipt ) ) ) select exists ( select 1 from pg_catalog . pg_depend d where ( d . refclassid , d . refobjid ) in ( select * from full_footprint ) and ( d . classid , d . objid ) not in ( select * from full_footprint ) ) or exists ( select 1 from pg_catalog . pg_depend d where ( d . classid , d . objid ) in ( select * from full_footprint ) and ( d . classid , d . objid ) not in ( select * from objects ) and not ( ( d . deptype = 'i' and ( d . refclassid , d . refobjid ) in ( select * from full_footprint ) ) or ( d . deptype = 'a' and d . classid = 'pg_catalog.pg_class' :: regclass and d . objid in ( select indexrelid from pg_catalog . pg_index where indrelid = ( select reltoastrelid from pg_catalog . pg_class where oid = ( select oid from receipt ) ) ) and d . refclassid = 'pg_catalog.pg_class' :: regclass and d . refobjid = ( select reltoastrelid from pg_catalog . pg_class where oid = ( select oid from receipt ) ) ) ) ) or exists ( select 1 from pg_catalog . pg_description d where ( d . classoid , d . objoid ) in ( select * from full_footprint ) and ( d . classoid , d . objoid ) not in ( select * from objects ) ) or exists ( select 1 from pg_catalog . pg_seclabel d where ( d . classoid , d . objoid ) in ( select * from full_footprint ) and ( d . classoid , d . objoid ) not in ( select * from objects ) ) or exists ( select 1 from pg_catalog . pg_shdepend d where d . dbid = ( select oid from pg_catalog . pg_database where datname = current_database ( ) ) and ( d . classid , d . objid ) in ( select * from full_footprint ) and ( d . classid , d . objid ) not in ( select * from objects ) and not ( d . deptype = 'o' and d . refclassid = 'pg_catalog.pg_authid' :: regclass and d . refobjid = pg_catalog . to_regrole ( current_user ) ) ) or exists ( select 1 from pg_catalog . pg_type t where ( 'pg_catalog.pg_type' :: regclass :: oid , t . oid ) in ( select * from full_footprint ) and ( t . typowner is distinct from pg_catalog . to_regrole ( current_user ) or t . typnamespace is distinct from 'public' :: regnamespace or t . typacl is not null or not t . typisdefined or t . typnotnull or t . typbasetype <> 0 or t . typdefault is not null or t . typdefaultbin is not null or not ( ( t . oid = ( select reltype from pg_catalog . pg_class where oid = ( select oid from receipt ) ) and t . typtype = 'c' and t . typrelid = ( select oid from receipt ) and t . typelem = 0 ) or ( t . oid = ( select typarray from pg_catalog . pg_type where oid = ( select reltype from pg_catalog . pg_class where oid = ( select oid from receipt ) ) ) and t . typtype = 'b' and t . typrelid = 0 and t . typelem = ( select reltype from pg_catalog . pg_class where oid = ( select oid from receipt ) ) ) ) ) ) ) then raise exception '__literal_refusal__' ; end if ; if exists ( select 1 from public . __receipt__ ) then raise exception '__literal_refusal__' ; end if ; end} ;\ndrop function public . __fn_apply__ ( uuid , uuid , uuid , integer , uuid , jsonb ) ;\ndrop function public . __fn_read__ ( uuid , uuid , uuid ) ;\ndrop function public . __fn_snapshot__ ( uuid ) ;\ndrop function public . __fn_actor__ ( uuid , uuid , text ) ;\ndrop trigger __child_1_trigger__ on public . __child_1__ ;\ndrop trigger __child_0_trigger__ on public . __child_0__ ;\ndrop function public . __fn_bump__ ( ) ;\ndrop table public . __receipt__ ;\ndrop function public . __fn_immutable__ ( ) ;\ncommit ;";
const RETENTION_LITERAL_TEMPLATE={
  "api_role_memberships": {
    "[\"app_tenant\", \"$owner\", \"$owner\"]": {
      "admin_option": false,
      "grantor": "$owner",
      "inherit_option": true,
      "member": "$owner",
      "role": "app_tenant",
      "set_option": true
    },
    "[\"app_tenant\", \"service_role\", \"$owner\"]": {
      "admin_option": false,
      "grantor": "$owner",
      "inherit_option": true,
      "member": "service_role",
      "role": "app_tenant",
      "set_option": true
    }
  },
  "attributes": {
    "1": {
      "acl": {},
      "attalign": "c",
      "attbyval": false,
      "attcompression": "",
      "attfdwoptions": null,
      "attgenerated": "",
      "atthasdef": false,
      "atthasmissing": false,
      "attidentity": "",
      "attinhcount": 0,
      "attisdropped": false,
      "attislocal": true,
      "attlen": 16,
      "attmissingval": null,
      "attname": "idempotency_key",
      "attndims": 0,
      "attnotnull": true,
      "attnum": 1,
      "attoptions": null,
      "attstattarget": -1,
      "attstorage": "p",
      "atttypmod": -1,
      "collation_absent": true,
      "collation_default": false,
      "type": "uuid"
    },
    "2": {
      "acl": {},
      "attalign": "i",
      "attbyval": false,
      "attcompression": "",
      "attfdwoptions": null,
      "attgenerated": "",
      "atthasdef": false,
      "atthasmissing": false,
      "attidentity": "",
      "attinhcount": 0,
      "attisdropped": false,
      "attislocal": true,
      "attlen": -1,
      "attmissingval": null,
      "attname": "operation",
      "attndims": 0,
      "attnotnull": true,
      "attnum": 2,
      "attoptions": null,
      "attstattarget": -1,
      "attstorage": "x",
      "atttypmod": -1,
      "collation_absent": false,
      "collation_default": true,
      "type": "text"
    },
    "3": {
      "acl": {},
      "attalign": "c",
      "attbyval": false,
      "attcompression": "",
      "attfdwoptions": null,
      "attgenerated": "",
      "atthasdef": false,
      "atthasmissing": false,
      "attidentity": "",
      "attinhcount": 0,
      "attisdropped": false,
      "attislocal": true,
      "attlen": 16,
      "attmissingval": null,
      "attname": "store_id",
      "attndims": 0,
      "attnotnull": true,
      "attnum": 3,
      "attoptions": null,
      "attstattarget": -1,
      "attstorage": "p",
      "atttypmod": -1,
      "collation_absent": true,
      "collation_default": false,
      "type": "uuid"
    },
    "4": {
      "acl": {},
      "attalign": "c",
      "attbyval": false,
      "attcompression": "",
      "attfdwoptions": null,
      "attgenerated": "",
      "atthasdef": false,
      "atthasmissing": false,
      "attidentity": "",
      "attinhcount": 0,
      "attisdropped": false,
      "attislocal": true,
      "attlen": 16,
      "attmissingval": null,
      "attname": "product_id",
      "attndims": 0,
      "attnotnull": true,
      "attnum": 4,
      "attoptions": null,
      "attstattarget": -1,
      "attstorage": "p",
      "atttypmod": -1,
      "collation_absent": true,
      "collation_default": false,
      "type": "uuid"
    },
    "5": {
      "acl": {},
      "attalign": "c",
      "attbyval": false,
      "attcompression": "",
      "attfdwoptions": null,
      "attgenerated": "",
      "atthasdef": false,
      "atthasmissing": false,
      "attidentity": "",
      "attinhcount": 0,
      "attisdropped": false,
      "attislocal": true,
      "attlen": 16,
      "attmissingval": null,
      "attname": "actor_id",
      "attndims": 0,
      "attnotnull": true,
      "attnum": 5,
      "attoptions": null,
      "attstattarget": -1,
      "attstorage": "p",
      "atttypmod": -1,
      "collation_absent": true,
      "collation_default": false,
      "type": "uuid"
    },
    "6": {
      "acl": {},
      "attalign": "i",
      "attbyval": true,
      "attcompression": "",
      "attfdwoptions": null,
      "attgenerated": "",
      "atthasdef": false,
      "atthasmissing": false,
      "attidentity": "",
      "attinhcount": 0,
      "attisdropped": false,
      "attislocal": true,
      "attlen": 4,
      "attmissingval": null,
      "attname": "expected_version",
      "attndims": 0,
      "attnotnull": true,
      "attnum": 6,
      "attoptions": null,
      "attstattarget": -1,
      "attstorage": "p",
      "atttypmod": -1,
      "collation_absent": true,
      "collation_default": false,
      "type": "integer"
    },
    "7": {
      "acl": {},
      "attalign": "i",
      "attbyval": false,
      "attcompression": "",
      "attfdwoptions": null,
      "attgenerated": "",
      "atthasdef": false,
      "atthasmissing": false,
      "attidentity": "",
      "attinhcount": 0,
      "attisdropped": false,
      "attislocal": true,
      "attlen": -1,
      "attmissingval": null,
      "attname": "mutation",
      "attndims": 0,
      "attnotnull": true,
      "attnum": 7,
      "attoptions": null,
      "attstattarget": -1,
      "attstorage": "x",
      "atttypmod": -1,
      "collation_absent": true,
      "collation_default": false,
      "type": "jsonb"
    },
    "8": {
      "acl": {},
      "attalign": "i",
      "attbyval": false,
      "attcompression": "",
      "attfdwoptions": null,
      "attgenerated": "",
      "atthasdef": false,
      "atthasmissing": false,
      "attidentity": "",
      "attinhcount": 0,
      "attisdropped": false,
      "attislocal": true,
      "attlen": -1,
      "attmissingval": null,
      "attname": "response",
      "attndims": 0,
      "attnotnull": true,
      "attnum": 8,
      "attoptions": null,
      "attstattarget": -1,
      "attstorage": "x",
      "atttypmod": -1,
      "collation_absent": true,
      "collation_default": false,
      "type": "jsonb"
    },
    "9": {
      "acl": {},
      "attalign": "d",
      "attbyval": true,
      "attcompression": "",
      "attfdwoptions": null,
      "attgenerated": "",
      "atthasdef": true,
      "atthasmissing": false,
      "attidentity": "",
      "attinhcount": 0,
      "attisdropped": false,
      "attislocal": true,
      "attlen": 8,
      "attmissingval": null,
      "attname": "created_at",
      "attndims": 0,
      "attnotnull": true,
      "attnum": 9,
      "attoptions": null,
      "attstattarget": -1,
      "attstorage": "p",
      "atttypmod": -1,
      "collation_absent": true,
      "collation_default": false,
      "type": "timestamp with time zone"
    }
  },
  "comments": [],
  "constraints": {
    "__check_expected_version__": {
      "condeferrable": false,
      "condeferred": false,
      "conexclop": null,
      "confdelsetcols": null,
      "confdeltype": " ",
      "conffeqop": null,
      "confkey": null,
      "confmatchtype": " ",
      "confupdtype": " ",
      "coninhcount": 0,
      "conislocal": true,
      "conkey": [
        6
      ],
      "conname": "__check_expected_version__",
      "connoinherit": false,
      "conpfeqop": null,
      "conppeqop": null,
      "contype": "c",
      "convalidated": true,
      "definition": "CHECK (expected_version > 0)",
      "foreign_relation_absent": true,
      "index": null,
      "namespace": "public",
      "parent_absent": true,
      "typed_constraint_absent": true
    },
    "__check_mutation__": {
      "condeferrable": false,
      "condeferred": false,
      "conexclop": null,
      "confdelsetcols": null,
      "confdeltype": " ",
      "conffeqop": null,
      "confkey": null,
      "confmatchtype": " ",
      "confupdtype": " ",
      "coninhcount": 0,
      "conislocal": true,
      "conkey": [
        7
      ],
      "conname": "__check_mutation__",
      "connoinherit": false,
      "conpfeqop": null,
      "conppeqop": null,
      "contype": "c",
      "convalidated": true,
      "definition": "CHECK (jsonb_typeof(mutation) = 'object'::text)",
      "foreign_relation_absent": true,
      "index": null,
      "namespace": "public",
      "parent_absent": true,
      "typed_constraint_absent": true
    },
    "__check_operation__": {
      "condeferrable": false,
      "condeferred": false,
      "conexclop": null,
      "confdelsetcols": null,
      "confdeltype": " ",
      "conffeqop": null,
      "confkey": null,
      "confmatchtype": " ",
      "confupdtype": " ",
      "coninhcount": 0,
      "conislocal": true,
      "conkey": [
        2
      ],
      "conname": "__check_operation__",
      "connoinherit": false,
      "conpfeqop": null,
      "conppeqop": null,
      "contype": "c",
      "convalidated": true,
      "definition": "CHECK (operation = 'product.update.v1'::text)",
      "foreign_relation_absent": true,
      "index": null,
      "namespace": "public",
      "parent_absent": true,
      "typed_constraint_absent": true
    },
    "__check_response__": {
      "condeferrable": false,
      "condeferred": false,
      "conexclop": null,
      "confdelsetcols": null,
      "confdeltype": " ",
      "conffeqop": null,
      "confkey": null,
      "confmatchtype": " ",
      "confupdtype": " ",
      "coninhcount": 0,
      "conislocal": true,
      "conkey": [
        8
      ],
      "conname": "__check_response__",
      "connoinherit": false,
      "conpfeqop": null,
      "conppeqop": null,
      "contype": "c",
      "convalidated": true,
      "definition": "CHECK (jsonb_typeof(response) = 'object'::text)",
      "foreign_relation_absent": true,
      "index": null,
      "namespace": "public",
      "parent_absent": true,
      "typed_constraint_absent": true
    },
    "__receipt_pkey__": {
      "condeferrable": false,
      "condeferred": false,
      "conexclop": null,
      "confdelsetcols": null,
      "confdeltype": " ",
      "conffeqop": null,
      "confkey": null,
      "confmatchtype": " ",
      "confupdtype": " ",
      "coninhcount": 0,
      "conislocal": true,
      "conkey": [
        1
      ],
      "conname": "__receipt_pkey__",
      "connoinherit": true,
      "conpfeqop": null,
      "conppeqop": null,
      "contype": "p",
      "convalidated": true,
      "definition": "PRIMARY KEY (idempotency_key)",
      "foreign_relation_absent": true,
      "index": "public.__receipt_pkey__",
      "namespace": "public",
      "parent_absent": true,
      "typed_constraint_absent": true
    }
  },
  "defaults": {
    "9": "now()"
  },
  "dependencies": {
    "[\"default value\", null, \"for public.__receipt__.created_at\", 0, \"table column\", \"public\", \"public.__receipt__.created_at\", 9, \"a\"]": {
      "deptype": "a",
      "object": {
        "identity": "for public.__receipt__.created_at",
        "name": null,
        "schema": null,
        "type": "default value"
      },
      "reference": {
        "identity": "public.__receipt__.created_at",
        "name": "__receipt__",
        "schema": "public",
        "type": "table column"
      },
      "refsubid": 9,
      "subid": 0
    },
    "[\"function\", \"public\", \"public.__fn_actor__(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.text)\", 0, \"language\", null, \"plpgsql\", 0, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "public.__fn_actor__(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.text)",
        "name": null,
        "schema": "public",
        "type": "function"
      },
      "reference": {
        "identity": "plpgsql",
        "name": "plpgsql",
        "schema": null,
        "type": "language"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"function\", \"public\", \"public.__fn_actor__(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.text)\", 0, \"schema\", null, \"public\", 0, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "public.__fn_actor__(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.text)",
        "name": null,
        "schema": "public",
        "type": "function"
      },
      "reference": {
        "identity": "public",
        "name": "public",
        "schema": null,
        "type": "schema"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"function\", \"public\", \"public.__fn_apply__(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.uuid,integer,pg_catalog.uuid,pg_catalog.jsonb)\", 0, \"language\", null, \"plpgsql\", 0, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "public.__fn_apply__(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.uuid,integer,pg_catalog.uuid,pg_catalog.jsonb)",
        "name": null,
        "schema": "public",
        "type": "function"
      },
      "reference": {
        "identity": "plpgsql",
        "name": "plpgsql",
        "schema": null,
        "type": "language"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"function\", \"public\", \"public.__fn_apply__(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.uuid,integer,pg_catalog.uuid,pg_catalog.jsonb)\", 0, \"schema\", null, \"public\", 0, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "public.__fn_apply__(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.uuid,integer,pg_catalog.uuid,pg_catalog.jsonb)",
        "name": null,
        "schema": "public",
        "type": "function"
      },
      "reference": {
        "identity": "public",
        "name": "public",
        "schema": null,
        "type": "schema"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"function\", \"public\", \"public.__fn_bump__()\", 0, \"language\", null, \"plpgsql\", 0, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "public.__fn_bump__()",
        "name": null,
        "schema": "public",
        "type": "function"
      },
      "reference": {
        "identity": "plpgsql",
        "name": "plpgsql",
        "schema": null,
        "type": "language"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"function\", \"public\", \"public.__fn_bump__()\", 0, \"schema\", null, \"public\", 0, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "public.__fn_bump__()",
        "name": null,
        "schema": "public",
        "type": "function"
      },
      "reference": {
        "identity": "public",
        "name": "public",
        "schema": null,
        "type": "schema"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"function\", \"public\", \"public.__fn_immutable__()\", 0, \"language\", null, \"plpgsql\", 0, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "public.__fn_immutable__()",
        "name": null,
        "schema": "public",
        "type": "function"
      },
      "reference": {
        "identity": "plpgsql",
        "name": "plpgsql",
        "schema": null,
        "type": "language"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"function\", \"public\", \"public.__fn_immutable__()\", 0, \"schema\", null, \"public\", 0, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "public.__fn_immutable__()",
        "name": null,
        "schema": "public",
        "type": "function"
      },
      "reference": {
        "identity": "public",
        "name": "public",
        "schema": null,
        "type": "schema"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"function\", \"public\", \"public.__fn_read__(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.uuid)\", 0, \"language\", null, \"plpgsql\", 0, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "public.__fn_read__(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.uuid)",
        "name": null,
        "schema": "public",
        "type": "function"
      },
      "reference": {
        "identity": "plpgsql",
        "name": "plpgsql",
        "schema": null,
        "type": "language"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"function\", \"public\", \"public.__fn_read__(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.uuid)\", 0, \"schema\", null, \"public\", 0, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "public.__fn_read__(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.uuid)",
        "name": null,
        "schema": "public",
        "type": "function"
      },
      "reference": {
        "identity": "public",
        "name": "public",
        "schema": null,
        "type": "schema"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"function\", \"public\", \"public.__fn_snapshot__(pg_catalog.uuid)\", 0, \"schema\", null, \"public\", 0, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "public.__fn_snapshot__(pg_catalog.uuid)",
        "name": null,
        "schema": "public",
        "type": "function"
      },
      "reference": {
        "identity": "public",
        "name": "public",
        "schema": null,
        "type": "schema"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"index\", \"public\", \"public.__receipt_pkey__\", 0, \"table constraint\", \"public\", \"__receipt_pkey__ on public.__receipt__\", 0, \"i\"]": {
      "deptype": "i",
      "object": {
        "identity": "public.__receipt_pkey__",
        "name": "__receipt_pkey__",
        "schema": "public",
        "type": "index"
      },
      "reference": {
        "identity": "__receipt_pkey__ on public.__receipt__",
        "name": null,
        "schema": "public",
        "type": "table constraint"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"index\", \"public\", \"public.__receipt_product_index__\", 0, \"table column\", \"public\", \"public.__receipt__.created_at\", 9, \"a\"]": {
      "deptype": "a",
      "object": {
        "identity": "public.__receipt_product_index__",
        "name": "__receipt_product_index__",
        "schema": "public",
        "type": "index"
      },
      "reference": {
        "identity": "public.__receipt__.created_at",
        "name": "__receipt__",
        "schema": "public",
        "type": "table column"
      },
      "refsubid": 9,
      "subid": 0
    },
    "[\"index\", \"public\", \"public.__receipt_product_index__\", 0, \"table column\", \"public\", \"public.__receipt__.product_id\", 4, \"a\"]": {
      "deptype": "a",
      "object": {
        "identity": "public.__receipt_product_index__",
        "name": "__receipt_product_index__",
        "schema": "public",
        "type": "index"
      },
      "reference": {
        "identity": "public.__receipt__.product_id",
        "name": "__receipt__",
        "schema": "public",
        "type": "table column"
      },
      "refsubid": 4,
      "subid": 0
    },
    "[\"index\", \"public\", \"public.__receipt_product_index__\", 0, \"table column\", \"public\", \"public.__receipt__.store_id\", 3, \"a\"]": {
      "deptype": "a",
      "object": {
        "identity": "public.__receipt_product_index__",
        "name": "__receipt_product_index__",
        "schema": "public",
        "type": "index"
      },
      "reference": {
        "identity": "public.__receipt__.store_id",
        "name": "__receipt__",
        "schema": "public",
        "type": "table column"
      },
      "refsubid": 3,
      "subid": 0
    },
    "[\"table constraint\", \"public\", \"__check_expected_version__ on public.__receipt__\", 0, \"table column\", \"public\", \"public.__receipt__.expected_version\", 6, \"a\"]": {
      "deptype": "a",
      "object": {
        "identity": "__check_expected_version__ on public.__receipt__",
        "name": null,
        "schema": "public",
        "type": "table constraint"
      },
      "reference": {
        "identity": "public.__receipt__.expected_version",
        "name": "__receipt__",
        "schema": "public",
        "type": "table column"
      },
      "refsubid": 6,
      "subid": 0
    },
    "[\"table constraint\", \"public\", \"__check_expected_version__ on public.__receipt__\", 0, \"table column\", \"public\", \"public.__receipt__.expected_version\", 6, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "__check_expected_version__ on public.__receipt__",
        "name": null,
        "schema": "public",
        "type": "table constraint"
      },
      "reference": {
        "identity": "public.__receipt__.expected_version",
        "name": "__receipt__",
        "schema": "public",
        "type": "table column"
      },
      "refsubid": 6,
      "subid": 0
    },
    "[\"table constraint\", \"public\", \"__check_mutation__ on public.__receipt__\", 0, \"table column\", \"public\", \"public.__receipt__.mutation\", 7, \"a\"]": {
      "deptype": "a",
      "object": {
        "identity": "__check_mutation__ on public.__receipt__",
        "name": null,
        "schema": "public",
        "type": "table constraint"
      },
      "reference": {
        "identity": "public.__receipt__.mutation",
        "name": "__receipt__",
        "schema": "public",
        "type": "table column"
      },
      "refsubid": 7,
      "subid": 0
    },
    "[\"table constraint\", \"public\", \"__check_mutation__ on public.__receipt__\", 0, \"table column\", \"public\", \"public.__receipt__.mutation\", 7, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "__check_mutation__ on public.__receipt__",
        "name": null,
        "schema": "public",
        "type": "table constraint"
      },
      "reference": {
        "identity": "public.__receipt__.mutation",
        "name": "__receipt__",
        "schema": "public",
        "type": "table column"
      },
      "refsubid": 7,
      "subid": 0
    },
    "[\"table constraint\", \"public\", \"__check_operation__ on public.__receipt__\", 0, \"table column\", \"public\", \"public.__receipt__.operation\", 2, \"a\"]": {
      "deptype": "a",
      "object": {
        "identity": "__check_operation__ on public.__receipt__",
        "name": null,
        "schema": "public",
        "type": "table constraint"
      },
      "reference": {
        "identity": "public.__receipt__.operation",
        "name": "__receipt__",
        "schema": "public",
        "type": "table column"
      },
      "refsubid": 2,
      "subid": 0
    },
    "[\"table constraint\", \"public\", \"__check_operation__ on public.__receipt__\", 0, \"table column\", \"public\", \"public.__receipt__.operation\", 2, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "__check_operation__ on public.__receipt__",
        "name": null,
        "schema": "public",
        "type": "table constraint"
      },
      "reference": {
        "identity": "public.__receipt__.operation",
        "name": "__receipt__",
        "schema": "public",
        "type": "table column"
      },
      "refsubid": 2,
      "subid": 0
    },
    "[\"table constraint\", \"public\", \"__check_response__ on public.__receipt__\", 0, \"table column\", \"public\", \"public.__receipt__.response\", 8, \"a\"]": {
      "deptype": "a",
      "object": {
        "identity": "__check_response__ on public.__receipt__",
        "name": null,
        "schema": "public",
        "type": "table constraint"
      },
      "reference": {
        "identity": "public.__receipt__.response",
        "name": "__receipt__",
        "schema": "public",
        "type": "table column"
      },
      "refsubid": 8,
      "subid": 0
    },
    "[\"table constraint\", \"public\", \"__check_response__ on public.__receipt__\", 0, \"table column\", \"public\", \"public.__receipt__.response\", 8, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "__check_response__ on public.__receipt__",
        "name": null,
        "schema": "public",
        "type": "table constraint"
      },
      "reference": {
        "identity": "public.__receipt__.response",
        "name": "__receipt__",
        "schema": "public",
        "type": "table column"
      },
      "refsubid": 8,
      "subid": 0
    },
    "[\"table constraint\", \"public\", \"__receipt_pkey__ on public.__receipt__\", 0, \"table column\", \"public\", \"public.__receipt__.idempotency_key\", 1, \"a\"]": {
      "deptype": "a",
      "object": {
        "identity": "__receipt_pkey__ on public.__receipt__",
        "name": null,
        "schema": "public",
        "type": "table constraint"
      },
      "reference": {
        "identity": "public.__receipt__.idempotency_key",
        "name": "__receipt__",
        "schema": "public",
        "type": "table column"
      },
      "refsubid": 1,
      "subid": 0
    },
    "[\"table\", \"public\", \"public.__receipt__\", 0, \"schema\", null, \"public\", 0, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "public.__receipt__",
        "name": "__receipt__",
        "schema": "public",
        "type": "table"
      },
      "reference": {
        "identity": "public",
        "name": "public",
        "schema": null,
        "type": "schema"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"toast table\", \"pg_toast\", \"pg_toast.$receipt_toast\", 0, \"table\", \"public\", \"public.__receipt__\", 0, \"i\"]": {
      "deptype": "i",
      "object": {
        "identity": "pg_toast.$receipt_toast",
        "name": "$receipt_toast",
        "schema": "pg_toast",
        "type": "toast table"
      },
      "reference": {
        "identity": "public.__receipt__",
        "name": "__receipt__",
        "schema": "public",
        "type": "table"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"trigger\", null, \"__child_0_trigger__ on public.__child_0__\", 0, \"function\", \"public\", \"public.__fn_bump__()\", 0, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "__child_0_trigger__ on public.__child_0__",
        "name": null,
        "schema": null,
        "type": "trigger"
      },
      "reference": {
        "identity": "public.__fn_bump__()",
        "name": null,
        "schema": "public",
        "type": "function"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"trigger\", null, \"__child_0_trigger__ on public.__child_0__\", 0, \"table\", \"public\", \"public.__child_0__\", 0, \"a\"]": {
      "deptype": "a",
      "object": {
        "identity": "__child_0_trigger__ on public.__child_0__",
        "name": null,
        "schema": null,
        "type": "trigger"
      },
      "reference": {
        "identity": "public.__child_0__",
        "name": "__child_0__",
        "schema": "public",
        "type": "table"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"trigger\", null, \"__child_1_trigger__ on public.__child_1__\", 0, \"function\", \"public\", \"public.__fn_bump__()\", 0, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "__child_1_trigger__ on public.__child_1__",
        "name": null,
        "schema": null,
        "type": "trigger"
      },
      "reference": {
        "identity": "public.__fn_bump__()",
        "name": null,
        "schema": "public",
        "type": "function"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"trigger\", null, \"__child_1_trigger__ on public.__child_1__\", 0, \"table\", \"public\", \"public.__child_1__\", 0, \"a\"]": {
      "deptype": "a",
      "object": {
        "identity": "__child_1_trigger__ on public.__child_1__",
        "name": null,
        "schema": null,
        "type": "trigger"
      },
      "reference": {
        "identity": "public.__child_1__",
        "name": "__child_1__",
        "schema": "public",
        "type": "table"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"trigger\", null, \"__receipt_trigger__ on public.__receipt__\", 0, \"function\", \"public\", \"public.__fn_immutable__()\", 0, \"n\"]": {
      "deptype": "n",
      "object": {
        "identity": "__receipt_trigger__ on public.__receipt__",
        "name": null,
        "schema": null,
        "type": "trigger"
      },
      "reference": {
        "identity": "public.__fn_immutable__()",
        "name": null,
        "schema": "public",
        "type": "function"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"trigger\", null, \"__receipt_trigger__ on public.__receipt__\", 0, \"table\", \"public\", \"public.__receipt__\", 0, \"a\"]": {
      "deptype": "a",
      "object": {
        "identity": "__receipt_trigger__ on public.__receipt__",
        "name": null,
        "schema": null,
        "type": "trigger"
      },
      "reference": {
        "identity": "public.__receipt__",
        "name": "__receipt__",
        "schema": "public",
        "type": "table"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"type\", \"public\", \"public.__receipt__\", 0, \"table\", \"public\", \"public.__receipt__\", 0, \"i\"]": {
      "deptype": "i",
      "object": {
        "identity": "public.__receipt__",
        "name": "__receipt__",
        "schema": "public",
        "type": "type"
      },
      "reference": {
        "identity": "public.__receipt__",
        "name": "__receipt__",
        "schema": "public",
        "type": "table"
      },
      "refsubid": 0,
      "subid": 0
    }
  },
  "functions": {
    "__fn_actor__": {
      "acl": {
        "[\"$owner\", \"$owner\", \"EXECUTE\", false]": {
          "grantable": false,
          "grantee": "$owner",
          "grantor": "$owner",
          "privilege": "EXECUTE"
        }
      },
      "body_md5": "__literal_body_md5__",
      "default_source": null,
      "input_types": [
        "uuid",
        "uuid",
        "text"
      ],
      "language": "plpgsql",
      "namespace": "public",
      "owner_valid": true,
      "proallargtypes": null,
      "proargdefaults": null,
      "proargmodes": null,
      "proargnames": [
        "__input_0__",
        "__input_1__",
        "__input_2__"
      ],
      "probin": null,
      "proconfig": [
        "search_path=pg_catalog, public, pg_temp"
      ],
      "procost": 100,
      "proisstrict": false,
      "prokind": "f",
      "proleakproof": false,
      "proname": "__fn_actor__",
      "pronargdefaults": 0,
      "pronargs": 3,
      "proparallel": "u",
      "proretset": false,
      "prorows": 0,
      "prosecdef": true,
      "prosqlbody": null,
      "prosrc": "__literal_body__",
      "prosupport": "-",
      "protrftypes": null,
      "provariadic": "0",
      "provolatile": "v",
      "result_type": "void"
    },
    "__fn_apply__": {
      "acl": {
        "[\"$owner\", \"$owner\", \"EXECUTE\", false]": {
          "grantable": false,
          "grantee": "$owner",
          "grantor": "$owner",
          "privilege": "EXECUTE"
        },
        "[\"app_tenant\", \"$owner\", \"EXECUTE\", false]": {
          "grantable": false,
          "grantee": "app_tenant",
          "grantor": "$owner",
          "privilege": "EXECUTE"
        }
      },
      "body_md5": "__literal_body_md5__",
      "default_source": null,
      "input_types": [
        "uuid",
        "uuid",
        "uuid",
        "integer",
        "uuid",
        "jsonb"
      ],
      "language": "plpgsql",
      "namespace": "public",
      "owner_valid": true,
      "proallargtypes": null,
      "proargdefaults": null,
      "proargmodes": null,
      "proargnames": [
        "__input_0__",
        "__input_1__",
        "__input_2__",
        "__input_3__",
        "__input_4__",
        "__input_5__"
      ],
      "probin": null,
      "proconfig": [
        "search_path=pg_catalog, public, pg_temp"
      ],
      "procost": 100,
      "proisstrict": false,
      "prokind": "f",
      "proleakproof": false,
      "proname": "__fn_apply__",
      "pronargdefaults": 0,
      "pronargs": 6,
      "proparallel": "u",
      "proretset": false,
      "prorows": 0,
      "prosecdef": true,
      "prosqlbody": null,
      "prosrc": "__literal_body__",
      "prosupport": "-",
      "protrftypes": null,
      "provariadic": "0",
      "provolatile": "v",
      "result_type": "jsonb"
    },
    "__fn_bump__": {
      "acl": {
        "[\"$owner\", \"$owner\", \"EXECUTE\", false]": {
          "grantable": false,
          "grantee": "$owner",
          "grantor": "$owner",
          "privilege": "EXECUTE"
        }
      },
      "body_md5": "__literal_body_md5__",
      "default_source": null,
      "input_types": [],
      "language": "plpgsql",
      "namespace": "public",
      "owner_valid": true,
      "proallargtypes": null,
      "proargdefaults": null,
      "proargmodes": null,
      "proargnames": null,
      "probin": null,
      "proconfig": [
        "search_path=pg_catalog, public, pg_temp"
      ],
      "procost": 100,
      "proisstrict": false,
      "prokind": "f",
      "proleakproof": false,
      "proname": "__fn_bump__",
      "pronargdefaults": 0,
      "pronargs": 0,
      "proparallel": "u",
      "proretset": false,
      "prorows": 0,
      "prosecdef": true,
      "prosqlbody": null,
      "prosrc": "__literal_body__",
      "prosupport": "-",
      "protrftypes": null,
      "provariadic": "0",
      "provolatile": "v",
      "result_type": "trigger"
    },
    "__fn_immutable__": {
      "acl": {
        "[\"$owner\", \"$owner\", \"EXECUTE\", false]": {
          "grantable": false,
          "grantee": "$owner",
          "grantor": "$owner",
          "privilege": "EXECUTE"
        }
      },
      "body_md5": "__literal_body_md5__",
      "default_source": null,
      "input_types": [],
      "language": "plpgsql",
      "namespace": "public",
      "owner_valid": true,
      "proallargtypes": null,
      "proargdefaults": null,
      "proargmodes": null,
      "proargnames": null,
      "probin": null,
      "proconfig": [
        "search_path=pg_catalog, public, pg_temp"
      ],
      "procost": 100,
      "proisstrict": false,
      "prokind": "f",
      "proleakproof": false,
      "proname": "__fn_immutable__",
      "pronargdefaults": 0,
      "pronargs": 0,
      "proparallel": "u",
      "proretset": false,
      "prorows": 0,
      "prosecdef": false,
      "prosqlbody": null,
      "prosrc": "__literal_body__",
      "prosupport": "-",
      "protrftypes": null,
      "provariadic": "0",
      "provolatile": "v",
      "result_type": "trigger"
    },
    "__fn_read__": {
      "acl": {
        "[\"$owner\", \"$owner\", \"EXECUTE\", false]": {
          "grantable": false,
          "grantee": "$owner",
          "grantor": "$owner",
          "privilege": "EXECUTE"
        },
        "[\"app_tenant\", \"$owner\", \"EXECUTE\", false]": {
          "grantable": false,
          "grantee": "app_tenant",
          "grantor": "$owner",
          "privilege": "EXECUTE"
        }
      },
      "body_md5": "__literal_body_md5__",
      "default_source": null,
      "input_types": [
        "uuid",
        "uuid",
        "uuid"
      ],
      "language": "plpgsql",
      "namespace": "public",
      "owner_valid": true,
      "proallargtypes": null,
      "proargdefaults": null,
      "proargmodes": null,
      "proargnames": [
        "__input_0__",
        "__input_1__",
        "__input_2__"
      ],
      "probin": null,
      "proconfig": [
        "search_path=pg_catalog, public, pg_temp"
      ],
      "procost": 100,
      "proisstrict": false,
      "prokind": "f",
      "proleakproof": false,
      "proname": "__fn_read__",
      "pronargdefaults": 0,
      "pronargs": 3,
      "proparallel": "u",
      "proretset": false,
      "prorows": 0,
      "prosecdef": true,
      "prosqlbody": null,
      "prosrc": "__literal_body__",
      "prosupport": "-",
      "protrftypes": null,
      "provariadic": "0",
      "provolatile": "v",
      "result_type": "jsonb"
    },
    "__fn_snapshot__": {
      "acl": {
        "[\"$owner\", \"$owner\", \"EXECUTE\", false]": {
          "grantable": false,
          "grantee": "$owner",
          "grantor": "$owner",
          "privilege": "EXECUTE"
        }
      },
      "body_md5": "__literal_body_md5__",
      "default_source": null,
      "input_types": [
        "uuid"
      ],
      "language": "sql",
      "namespace": "public",
      "owner_valid": true,
      "proallargtypes": null,
      "proargdefaults": null,
      "proargmodes": null,
      "proargnames": [
        "__input_0__"
      ],
      "probin": null,
      "proconfig": [
        "search_path=pg_catalog, public, pg_temp"
      ],
      "procost": 100,
      "proisstrict": false,
      "prokind": "f",
      "proleakproof": false,
      "proname": "__fn_snapshot__",
      "pronargdefaults": 0,
      "pronargs": 1,
      "proparallel": "u",
      "proretset": false,
      "prorows": 0,
      "prosecdef": false,
      "prosqlbody": null,
      "prosrc": "__literal_body__",
      "prosupport": "-",
      "protrftypes": null,
      "provariadic": "0",
      "provolatile": "s",
      "result_type": "jsonb"
    }
  },
  "indexes": {
    "__receipt_pkey__": {
      "class_profile": {
        "access_method": "btree",
        "acl": {},
        "namespace": "public",
        "owner_valid": true,
        "relchecks": 0,
        "relforcerowsecurity": false,
        "relhasindex": false,
        "relhasrules": false,
        "relhassubclass": false,
        "relhastriggers": false,
        "relispartition": false,
        "relispopulated": true,
        "relisshared": false,
        "relkind": "i",
        "relname": "__receipt_pkey__",
        "relnatts": 1,
        "reloptions": null,
        "relpartbound": null,
        "relpersistence": "p",
        "relreplident": "n",
        "relrowsecurity": false,
        "rewrite_absent": true,
        "rowtype_link_valid": true,
        "tablespace": null,
        "toast_link_valid": true,
        "toast_present": false,
        "typed_table": null
      },
      "collations_absent": true,
      "definition": "CREATE UNIQUE INDEX __receipt_pkey__ ON public.__receipt__ USING btree (idempotency_key)",
      "indcheckxmin": false,
      "indexprs": null,
      "indimmediate": true,
      "indisclustered": false,
      "indisexclusion": false,
      "indislive": true,
      "indisprimary": true,
      "indisready": true,
      "indisreplident": false,
      "indisunique": true,
      "indisvalid": true,
      "indkey": [
        1
      ],
      "indnatts": 1,
      "indnkeyatts": 1,
      "indnullsnotdistinct": false,
      "indoption": [
        0
      ],
      "indpred": null,
      "opclasses_default": true
    },
    "__receipt_product_index__": {
      "class_profile": {
        "access_method": "btree",
        "acl": {},
        "namespace": "public",
        "owner_valid": true,
        "relchecks": 0,
        "relforcerowsecurity": false,
        "relhasindex": false,
        "relhasrules": false,
        "relhassubclass": false,
        "relhastriggers": false,
        "relispartition": false,
        "relispopulated": true,
        "relisshared": false,
        "relkind": "i",
        "relname": "__receipt_product_index__",
        "relnatts": 3,
        "reloptions": null,
        "relpartbound": null,
        "relpersistence": "p",
        "relreplident": "n",
        "relrowsecurity": false,
        "rewrite_absent": true,
        "rowtype_link_valid": true,
        "tablespace": null,
        "toast_link_valid": true,
        "toast_present": false,
        "typed_table": null
      },
      "collations_absent": true,
      "definition": "CREATE INDEX __receipt_product_index__ ON public.__receipt__ USING btree (store_id, product_id, created_at)",
      "indcheckxmin": false,
      "indexprs": null,
      "indimmediate": true,
      "indisclustered": false,
      "indisexclusion": false,
      "indislive": true,
      "indisprimary": false,
      "indisready": true,
      "indisreplident": false,
      "indisunique": false,
      "indisvalid": true,
      "indkey": [
        3,
        4,
        9
      ],
      "indnatts": 3,
      "indnkeyatts": 3,
      "indnullsnotdistinct": false,
      "indoption": [
        0,
        0,
        0
      ],
      "indpred": null,
      "opclasses_default": true
    }
  },
  "inheritance": [],
  "policies": [],
  "receipt": {
    "access_method": "heap",
    "acl": {
      "[\"$owner\", \"$owner\", \"DELETE\", false]": {
        "grantable": false,
        "grantee": "$owner",
        "grantor": "$owner",
        "privilege": "DELETE"
      },
      "[\"$owner\", \"$owner\", \"INSERT\", false]": {
        "grantable": false,
        "grantee": "$owner",
        "grantor": "$owner",
        "privilege": "INSERT"
      },
      "[\"$owner\", \"$owner\", \"REFERENCES\", false]": {
        "grantable": false,
        "grantee": "$owner",
        "grantor": "$owner",
        "privilege": "REFERENCES"
      },
      "[\"$owner\", \"$owner\", \"SELECT\", false]": {
        "grantable": false,
        "grantee": "$owner",
        "grantor": "$owner",
        "privilege": "SELECT"
      },
      "[\"$owner\", \"$owner\", \"TRIGGER\", false]": {
        "grantable": false,
        "grantee": "$owner",
        "grantor": "$owner",
        "privilege": "TRIGGER"
      },
      "[\"$owner\", \"$owner\", \"TRUNCATE\", false]": {
        "grantable": false,
        "grantee": "$owner",
        "grantor": "$owner",
        "privilege": "TRUNCATE"
      },
      "[\"$owner\", \"$owner\", \"UPDATE\", false]": {
        "grantable": false,
        "grantee": "$owner",
        "grantor": "$owner",
        "privilege": "UPDATE"
      }
    },
    "namespace": "public",
    "owner_valid": true,
    "relchecks": 4,
    "relforcerowsecurity": true,
    "relhasindex": true,
    "relhasrules": false,
    "relhassubclass": false,
    "relhastriggers": true,
    "relispartition": false,
    "relispopulated": true,
    "relisshared": false,
    "relkind": "r",
    "relname": "__receipt__",
    "relnatts": 9,
    "reloptions": null,
    "relpartbound": null,
    "relpersistence": "p",
    "relreplident": "d",
    "relrowsecurity": true,
    "rewrite_absent": true,
    "rowtype_link_valid": true,
    "tablespace": null,
    "toast_link_valid": true,
    "toast_present": true,
    "typed_table": null
  },
  "roles": {
    "$owner": {
      "bypass_rls": true,
      "create_db": true,
      "create_role": true,
      "inherit": true,
      "login": true,
      "replication": true,
      "super": true
    },
    "anon": {
      "bypass_rls": false,
      "create_db": false,
      "create_role": false,
      "inherit": true,
      "login": false,
      "replication": false,
      "super": false
    },
    "app_tenant": {
      "bypass_rls": false,
      "create_db": false,
      "create_role": false,
      "inherit": true,
      "login": false,
      "replication": false,
      "super": false
    },
    "authenticated": {
      "bypass_rls": false,
      "create_db": false,
      "create_role": false,
      "inherit": true,
      "login": false,
      "replication": false,
      "super": false
    },
    "service_role": {
      "bypass_rls": true,
      "create_db": false,
      "create_role": false,
      "inherit": true,
      "login": false,
      "replication": false,
      "super": false
    }
  },
  "rules": [],
  "security_labels": [],
  "shared_dependencies": {
    "[\"function\", \"public\", \"public.__fn_apply__(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.uuid,integer,pg_catalog.uuid,pg_catalog.jsonb)\", 0, \"role\", null, \"app_tenant\", 0, \"a\"]": {
      "deptype": "a",
      "object": {
        "identity": "public.__fn_apply__(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.uuid,integer,pg_catalog.uuid,pg_catalog.jsonb)",
        "name": null,
        "schema": "public",
        "type": "function"
      },
      "reference": {
        "identity": "app_tenant",
        "name": "app_tenant",
        "schema": null,
        "type": "role"
      },
      "refsubid": 0,
      "subid": 0
    },
    "[\"function\", \"public\", \"public.__fn_read__(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.uuid)\", 0, \"role\", null, \"app_tenant\", 0, \"a\"]": {
      "deptype": "a",
      "object": {
        "identity": "public.__fn_read__(pg_catalog.uuid,pg_catalog.uuid,pg_catalog.uuid)",
        "name": null,
        "schema": "public",
        "type": "function"
      },
      "reference": {
        "identity": "app_tenant",
        "name": "app_tenant",
        "schema": null,
        "type": "role"
      },
      "refsubid": 0,
      "subid": 0
    }
  },
  "triggers": {
    "public.__child_0__.__child_0_trigger__": {
      "constraint_links_absent": true,
      "definition": "CREATE TRIGGER __child_0_trigger__ AFTER INSERT OR DELETE OR UPDATE ON __child_0__ FOR EACH ROW EXECUTE FUNCTION __fn_bump__()",
      "function": "public.__fn_bump__()",
      "relation": "public.__child_0__",
      "tgargs": "\\x",
      "tgattr": [],
      "tgdeferrable": false,
      "tgenabled": "O",
      "tginitdeferred": false,
      "tgisinternal": false,
      "tgname": "__child_0_trigger__",
      "tgnargs": 0,
      "tgnewtable": null,
      "tgoldtable": null,
      "tgqual": null,
      "tgtype": 29
    },
    "public.__child_1__.__child_1_trigger__": {
      "constraint_links_absent": true,
      "definition": "CREATE TRIGGER __child_1_trigger__ AFTER INSERT OR DELETE OR UPDATE ON __child_1__ FOR EACH ROW EXECUTE FUNCTION __fn_bump__()",
      "function": "public.__fn_bump__()",
      "relation": "public.__child_1__",
      "tgargs": "\\x",
      "tgattr": [],
      "tgdeferrable": false,
      "tgenabled": "O",
      "tginitdeferred": false,
      "tgisinternal": false,
      "tgname": "__child_1_trigger__",
      "tgnargs": 0,
      "tgnewtable": null,
      "tgoldtable": null,
      "tgqual": null,
      "tgtype": 29
    },
    "public.__receipt__.__receipt_trigger__": {
      "constraint_links_absent": true,
      "definition": "CREATE TRIGGER __receipt_trigger__ BEFORE DELETE OR UPDATE ON __receipt__ FOR EACH ROW EXECUTE FUNCTION __fn_immutable__()",
      "function": "public.__fn_immutable__()",
      "relation": "public.__receipt__",
      "tgargs": "\\x",
      "tgattr": [],
      "tgdeferrable": false,
      "tgenabled": "O",
      "tginitdeferred": false,
      "tgisinternal": false,
      "tgname": "__receipt_trigger__",
      "tgnargs": 0,
      "tgnewtable": null,
      "tgoldtable": null,
      "tgqual": null,
      "tgtype": 27
    }
  }
};
// Closed source grammar for an empty receipt retirement, composed with the
// existing primary ABI proof. No SQL is run and no file/target-name is allowed.
// The inspectable templates below bind identities and literal profile data;
// they are not source hashes, and never approve values read from the live target.
function retentionStable(value) {
    if(Array.isArray(value))return value.map(retentionStable);
    if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,retentionStable(value[key])]));
    return value;
}
const retentionEqual=(a,b)=>JSON.stringify(retentionStable(a))===JSON.stringify(retentionStable(b));
function retentionModel(sql,baseProof) {
    const statements=sqlStatements(sql),primary=[];let literal;
    for(let index=0;index<statements.length;index++) {
        const statement=statements[index];
        if(!word(statement[0],'do')||statement.length!==3||statement[1]?.kind!=='body')continue;
        const body=statement[1].value,tokens=sqlTokens(body);
        const identity=tokens.filter(t=>t.kind==='string').map(t=>functionIdentity(t.value)).find(Boolean);
        if(identity) {
            const rows=baseProof('BEGIN; LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE; DO $primary$'+body+'$primary$; DROP FUNCTION '+identity+'; COMMIT;');
            if(rows.length)primary.push({index,body,rows});
        }
        for(const token of tokens.filter(t=>t.kind==='body')) {
            let data;try{data=JSON.parse(token.value);}catch{continue;}
            if(!data||typeof data!=='object'||!data.functions||!data.receipt)continue;
            if(literal)throw Error('Multiple literal profiles');literal={index,token,data};
        }
    }
    if(primary.length!==1||primary[0].rows.length!==6||!literal)throw Error('Unbound retirement profile');
    const proof=primary[0];if(proof.rows.some(g=>g.level!=='typed-ABI'||!g.quiescence_guard||g.returns_set!==false||g.overloads!==1))throw Error('Missing primary lifetime proof');
    const profile=literal.data,functions=profile.functions;
    if(Object.keys(functions).length!==6)throw Error('Unknown function set');
    const roleFunctions={},bindings=new Map();
    const identifier=value=>typeof value==='string'&&/^[a-z_][a-z0-9_]{0,62}$/.test(value);
    const bind=(value,marker)=>{if(!identifier(value)||bindings.has(value)&&bindings.get(value)!==marker)throw Error('Unbound identity');bindings.set(value,marker);};
    for(const guard of proof.rows) {
        const [,name,args]=guard.identity.match(/^public\.([^()]+)\(([^()]*)\)$/)??[];
        const data=functions[name],inputs=args?.split(',').filter(Boolean);
        if(!data||data.proname!==name||data.owner_valid!==true||data.namespace!=='public'||!retentionEqual(data.input_types,inputs)||data.result_type!==guard.result_type||!retentionEqual(data.proargnames,inputs.length?guard.input_names:null))throw Error('Literal ABI not bound');
        if(typeof data.prosrc!=='string'||!data.prosrc.length||data.prosrc.includes('\0')||typeof data.body_md5!=='string'||createHash('md5').update(data.prosrc).digest('hex')!==data.body_md5)throw Error('Nonliteral body fingerprint');
        const shape=guard.result_type+':'+args;let role;
        if(shape==='jsonb:uuid,uuid,uuid,integer,uuid,jsonb')role='apply';
        else if(shape==='jsonb:uuid,uuid,uuid')role='read';
        else if(shape==='void:uuid,uuid,text')role='actor';
        else if(shape==='jsonb:uuid')role='snapshot';
        else if(shape==='trigger:'&&typeof data.prosecdef==='boolean')role=data.prosecdef?'bump':'immutable';
        if(!role||roleFunctions[role])throw Error('Unknown receipt ABI family');
        roleFunctions[role]=name;bind(name,'__fn_'+role+'__');
    }
    if(Object.keys(roleFunctions).length!==6)throw Error('Missing receipt ABI family');
    const receipt=profile.receipt?.relname;
    if(!identifier(receipt)||receipt.length>35)throw Error('Unknown receipt identity');bind(receipt,'__receipt__');
    bind(receipt+'_pkey','__receipt_pkey__');bind(receipt+'_product_idx','__receipt_product_index__');
    for(const column of ['operation','expected_version','mutation','response'])bind(receipt+'_'+column+'_check','__check_'+column+'__');
    const triggers=Object.values(profile.triggers??{});
    if(triggers.length!==3)throw Error('Unknown trigger footprint');
    const immutable=triggers.filter(t=>t.relation==='public.'+receipt);
    if(immutable.length!==1||immutable[0].tgname!==receipt+'_immutable'||immutable[0].function!=='public.'+roleFunctions.immutable+'()')throw Error('Unbound immutable trigger');
    bind(immutable[0].tgname,'__receipt_trigger__');
    const children=triggers.filter(t=>t.relation!=='public.'+receipt).sort((a,b)=>a.relation.localeCompare(b.relation,'en'));
    if(children.length!==2||children[0].relation===children[1].relation)throw Error('Unknown child footprint');
    children.forEach((trigger,index)=>{
        const child=trigger.relation?.match(/^public\.([a-z_][a-z0-9_]*)$/)?.[1];
        if(!identifier(child)||trigger.tgname!==child+'_edit_revision'||trigger.function!=='public.'+roleFunctions.bump+'()')throw Error('Unbound revision trigger');
        bind(child,'__child_'+index+'__');bind(trigger.tgname,'__child_'+index+'_trigger__');
    });
    const names=[...bindings].sort((a,b)=>b[0].length-a[0].length);
    const replace=value=>names.reduce((text,[name,marker])=>text.replace(new RegExp('(?<![a-z0-9_])'+name+'(?![a-z0-9_])','g'),marker),value);
    const dataCopy=JSON.parse(JSON.stringify(profile));
    for(const [name,data] of Object.entries(dataCopy.functions)) {
        data.prosrc='__literal_body__';data.body_md5='__literal_body_md5__';
        if(data.proargnames)data.proargnames=data.proargnames.map((_,index)=>'__input_'+index+'__');
    }
    const mapData=value=>Array.isArray(value)?value.map(mapData):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[replace(key),mapData(v)])):typeof value==='string'?replace(value):value;
    const literalModel=retentionStable(mapData(dataCopy));
    const normalizeTokens=(tokens,{primaryBody=false,profileBody=false}={})=>{
        if(primaryBody) {
            const start=tokens.findIndex(t=>word(t,'values'));if(start<0)throw Error('Missing finite rows');
            let depth=1,end=start+1;
            for(;end<tokens.length;end++){if(tokens[end].kind==='symbol'&&tokens[end].value==='(')depth++;if(tokens[end].kind==='symbol'&&tokens[end].value===')')depth--;if(depth===0)break;}
            if(depth!==0)throw Error('Unbounded rows');tokens=[...tokens.slice(0,start+1),{kind:'word',value:'__primary_rows__'},...tokens.slice(end)];
        }
        return tokens.map((token,index)=>{
            if(token.kind==='body') {
                if(!profileBody||token.start!==literal.token.start||token.end!==literal.token.end)throw Error('Unknown executable/literal body');
                return '__literal_profile__';
            }
            const refusal=token.kind==='string'&&word(tokens[index-2],'raise')&&word(tokens[index-1],'exception');
            const value=refusal?'__literal_refusal__':replace(token.value);
            return token.kind==='string'?"'"+value.replaceAll("'","''")+"'":value;
        }).join(' ');
    };
    const sourceModel=statements.map((statement,index)=>word(statement[0],'do')?
        'do {'+normalizeTokens(sqlTokens(statement[1].value),{primaryBody:index===proof.index,profileBody:index===literal.index})+'} ;':normalizeTokens(statement)).join('\n');
    return {source:sourceModel,literal:literalModel,proof,profile,receipt,roleFunctions};
}
function retentionCatalogCertificate(sql,baseProof) {
    try {
        const model=retentionModel(sql,baseProof);
        if(model.source!==RETENTION_SOURCE_TEMPLATE||!retentionEqual(model.literal,RETENTION_LITERAL_TEMPLATE))return [];
        return model.proof.rows.map(row=>({...row,guard_start:sqlStatements(sql)[model.proof.index][0].start,requires_catalog_lock:true,body_fingerprint:{md5:model.profile.functions[row.name].body_md5,owner_relation:'public.'+model.receipt},catalog_retention_profile:{kind:'closed-literal-receipt-profile',relation:'public.'+model.receipt,retained_rows_refused:true,foreign_dependencies_refused:true}}));
    }catch{return [];}
}

// Complete finite grammar for a two-family traversal retirement. The model
// binds declared identities and literal metadata across the entire transaction,
// including pre-lock prepared refusal, final recheck and exact retirements.
// Unknown effects, tokens, bodies, profiles and ordering earn no certificate.
const TRAVERSAL_SOURCE_TEMPLATE = [[["word","begin"],["symbol",";"]],[["word","set"],["word","local"],["word","search_path"],["symbol","="],["word","pg_catalog"],["symbol",","],["word","public"],["symbol",";"]],[["word","set"],["word","local"],["word","lock_timeout"],["symbol","="],["string","2s"],["symbol",";"]],[["word","set"],["word","local"],["word","statement_timeout"],["symbol","="],["string","15s"],["symbol",";"]],["do",[["word","begin"],["word","if"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_prepared_xacts"],["symbol",")"],["word","then"],["word","raise"],["word","exception"],["string","__literal_refusal__"],["symbol",";"],["word","end"],["word","if"],["symbol",";"],["word","end"]]],[["word","lock"],["word","table"],["word","pg_catalog"],["symbol","."],["word","pg_proc"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_class"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_attribute"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_attrdef"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_constraint"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_trigger"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_policy"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_index"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_namespace"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_type"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_depend"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_rewrite"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_authid"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_auth_members"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_database"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_inherits"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_description"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_seclabel"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_extension"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_default_acl"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_init_privs"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_statistic_ext"],["symbol",","],["word","pg_catalog"],["symbol","."],["word","pg_shdepend"],["word","in"],["word","share"],["word","row"],["word","exclusive"],["word","mode"],["word","nowait"],["symbol",";"]],[["word","lock"],["word","table"],["word","public"],["symbol","."],["word","sites"],["word","in"],["word","share"],["word","mode"],["word","nowait"],["symbol",";"]],[["word","lock"],["word","table"],["word","public"],["symbol","."],["word","__batches__"],["symbol",","],["word","public"],["symbol","."],["word","__traversal__"],["word","in"],["word","access"],["word","exclusive"],["word","mode"],["word","nowait"],["symbol",";"]],["do",[["word","declare"],["word","actual_profile"],["word","jsonb"],["symbol",";"],["word","family"],["word","text"],["symbol","["],["symbol","]"],["symbol",";"],["word","tables"],["word","oid"],["symbol","["],["symbol","]"],["symbol",":="],["word","array"],["symbol","["],["string","public.__batches__"],["symbol","::"],["word","regclass"],["symbol",","],["string","public.__traversal__"],["symbol","::"],["word","regclass"],["symbol","]"],["symbol",";"],["word","indexes"],["word","oid"],["symbol","["],["symbol","]"],["symbol",";"],["word","relations"],["word","oid"],["symbol","["],["symbol","]"],["symbol",";"],["word","types"],["word","oid"],["symbol","["],["symbol","]"],["symbol",";"],["word","rpc"],["word","oid"],["symbol",":="],["string","public.__rpc__(text,integer)"],["symbol","::"],["word","regprocedure"],["symbol",";"],["word","unexpected_journal"],["word","boolean"],["symbol",";"],["word","expected_profile"],["word","constant"],["word","jsonb"],["symbol",":="],["literal-profile","__literal_profile__"],["symbol","::"],["word","jsonb"],["symbol",";"],["word","begin"],["word","if"],["word","current_user"],["symbol","<>"],["string","postgres"],["word","or"],["word","session_user"],["symbol","<>"],["word","current_user"],["word","or"],["word","not"],["symbol","("],["word","select"],["word","rolsuper"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_roles"],["word","where"],["word","rolname"],["symbol","="],["word","current_user"],["symbol",")"],["word","or"],["symbol","("],["word","select"],["word","pg_get_userbyid"],["symbol","("],["word","datdba"],["symbol",")"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_database"],["word","where"],["word","datname"],["symbol","="],["word","current_database"],["symbol","("],["symbol",")"],["symbol",")"],["symbol","<>"],["string","postgres"],["word","or"],["word","current_setting"],["symbol","("],["string","transaction_isolation"],["symbol",")"],["symbol","<>"],["string","read committed"],["word","or"],["word","current_setting"],["symbol","("],["string","session_replication_role"],["symbol",")"],["symbol","<>"],["string","origin"],["word","or"],["word","nullif"],["symbol","("],["word","current_setting"],["symbol","("],["string","app.site_id"],["symbol",","],["word","true"],["symbol",")"],["symbol",","],["string",""],["symbol",")"],["word","is"],["word","not"],["word","null"],["word","or"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_locks"],["word","where"],["word","locktype"],["symbol","="],["string","transactionid"],["word","and"],["word","mode"],["symbol","="],["string","ExclusiveLock"],["word","and"],["word","granted"],["word","and"],["symbol","("],["word","pid"],["word","is"],["word","null"],["word","or"],["word","pid"],["symbol","<>"],["word","pg_backend_pid"],["symbol","("],["symbol",")"],["symbol",")"],["symbol",")"],["word","or"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_prepared_xacts"],["symbol",")"],["word","then"],["word","raise"],["word","exception"],["string","__literal_refusal__"],["symbol",";"],["word","end"],["word","if"],["symbol",";"],["word","if"],["word","to_regclass"],["symbol","("],["string","public.migration_privilege_journal"],["symbol",")"],["word","is"],["word","not"],["word","null"],["word","then"],["word","execute"],["string","LOCK TABLE public.migration_privilege_journal IN SHARE MODE NOWAIT"],["symbol",";"],["word","execute"],["string","SELECT EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='349')"],["word","into"],["word","unexpected_journal"],["symbol",";"],["word","if"],["word","unexpected_journal"],["word","then"],["word","raise"],["word","exception"],["string","__literal_refusal__"],["symbol",";"],["word","end"],["word","if"],["symbol",";"],["word","end"],["word","if"],["symbol",";"],["word","select"],["word","coalesce"],["symbol","("],["word","array_agg"],["symbol","("],["word","n"],["symbol","."],["word","nspname"],["symbol","||"],["string","."],["symbol","||"],["word","p"],["symbol","."],["word","proname"],["word","order"],["word","by"],["word","n"],["symbol","."],["word","nspname"],["symbol",","],["word","p"],["symbol","."],["word","proname"],["symbol",")"],["symbol",","],["string","{}"],["symbol","::"],["word","text"],["symbol","["],["symbol","]"],["symbol",")"],["word","into"],["word","family"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_proc"],["word","p"],["word","join"],["word","pg_catalog"],["symbol","."],["word","pg_namespace"],["word","n"],["word","on"],["word","n"],["symbol","."],["word","oid"],["symbol","="],["word","p"],["symbol","."],["word","pronamespace"],["word","where"],["word","p"],["symbol","."],["word","proname"],["word","like"],["string","__rpc_family__%"],["symbol",";"],["word","if"],["word","family"],["word","is"],["word","distinct"],["word","from"],["word","array"],["symbol","["],["string","public.__rpc__"],["symbol","]"],["symbol","::"],["word","text"],["symbol","["],["symbol","]"],["word","then"],["word","raise"],["word","exception"],["string","__literal_refusal__"],["symbol",";"],["word","end"],["word","if"],["symbol",";"],["word","select"],["word","coalesce"],["symbol","("],["word","array_agg"],["symbol","("],["word","n"],["symbol","."],["word","nspname"],["symbol","||"],["string","."],["symbol","||"],["word","c"],["symbol","."],["word","relname"],["word","order"],["word","by"],["word","n"],["symbol","."],["word","nspname"],["symbol",","],["word","c"],["symbol","."],["word","relname"],["symbol",")"],["symbol",","],["string","{}"],["symbol","::"],["word","text"],["symbol","["],["symbol","]"],["symbol",")"],["word","into"],["word","family"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_class"],["word","c"],["word","join"],["word","pg_catalog"],["symbol","."],["word","pg_namespace"],["word","n"],["word","on"],["word","n"],["symbol","."],["word","oid"],["symbol","="],["word","c"],["symbol","."],["word","relnamespace"],["word","where"],["word","c"],["symbol","."],["word","relname"],["word","like"],["string","__family__%"],["symbol",";"],["word","if"],["word","family"],["word","is"],["word","distinct"],["word","from"],["word","array"],["symbol","["],["string","public.__batches__"],["symbol",","],["string","public.__batches_pass_idx__"],["symbol",","],["string","public.__batches_pkey__"],["symbol",","],["string","public.__batches_request_key_key__"],["symbol",","],["string","public.__sites_order_index__"],["symbol",","],["string","public.__traversal__"],["symbol",","],["string","public.__traversal_pkey__"],["symbol","]"],["symbol","::"],["word","text"],["symbol","["],["symbol","]"],["word","or"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_namespace"],["word","where"],["word","nspname"],["word","like"],["string","__family__%"],["symbol",")"],["word","then"],["word","raise"],["word","exception"],["string","__literal_refusal__"],["symbol",";"],["word","end"],["word","if"],["symbol",";"],["word","select"],["word","array_agg"],["symbol","("],["word","indexrelid"],["word","order"],["word","by"],["word","indexrelid"],["symbol",")"],["word","into"],["word","indexes"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_index"],["word","where"],["word","indrelid"],["symbol","="],["word","any"],["symbol","("],["word","tables"],["symbol",")"],["word","or"],["word","indexrelid"],["symbol","="],["string","public.__sites_order_index__"],["symbol","::"],["word","regclass"],["symbol",";"],["word","if"],["word","cardinality"],["symbol","("],["word","indexes"],["symbol",")"],["symbol","<>"],["word","5"],["word","or"],["word","pg_get_indexdef"],["symbol","("],["string","public.__sites_order_index__"],["symbol","::"],["word","regclass"],["symbol",")"],["symbol","<>"],["string","CREATE INDEX __sites_order_index__ ON public.sites USING btree (COALESCE(created_at, '-infinity'::timestamp with time zone), id) WHERE (deleted_at IS NULL)"],["word","then"],["word","raise"],["word","exception"],["string","__literal_refusal__"],["symbol",";"],["word","end"],["word","if"],["symbol",";"],["word","select"],["word","array_agg"],["symbol","("],["word","t"],["symbol","."],["word","oid"],["word","order"],["word","by"],["word","t"],["symbol","."],["word","oid"],["symbol",")"],["word","into"],["word","types"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_type"],["word","t"],["word","where"],["word","t"],["symbol","."],["word","typrelid"],["symbol","="],["word","any"],["symbol","("],["word","tables"],["symbol",")"],["word","or"],["word","t"],["symbol","."],["word","typelem"],["word","in"],["symbol","("],["word","select"],["word","reltype"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_class"],["word","where"],["word","oid"],["symbol","="],["word","any"],["symbol","("],["word","tables"],["symbol",")"],["symbol",")"],["symbol",";"],["word","if"],["word","cardinality"],["symbol","("],["word","types"],["symbol",")"],["symbol","<>"],["word","4"],["word","or"],["symbol","("],["word","select"],["word","count"],["symbol","("],["symbol","*"],["symbol",")"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_type"],["word","where"],["word","typname"],["word","like"],["string","%__family__%"],["symbol",")"],["symbol","<>"],["word","4"],["word","or"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_type"],["word","t"],["word","where"],["word","t"],["symbol","."],["word","oid"],["symbol","="],["word","any"],["symbol","("],["word","types"],["symbol",")"],["word","and"],["symbol","("],["word","t"],["symbol","."],["word","typnamespace"],["symbol","<>"],["string","public"],["symbol","::"],["word","regnamespace"],["word","or"],["word","t"],["symbol","."],["word","typowner"],["symbol","<>"],["string","postgres"],["symbol","::"],["word","regrole"],["word","or"],["word","t"],["symbol","."],["word","typacl"],["word","is"],["word","not"],["word","null"],["word","or"],["word","t"],["symbol","."],["word","typdefault"],["word","is"],["word","not"],["word","null"],["word","or"],["word","t"],["symbol","."],["word","typdefaultbin"],["word","is"],["word","not"],["word","null"],["word","or"],["word","t"],["symbol","."],["word","typnotnull"],["word","or"],["word","t"],["symbol","."],["word","typbasetype"],["symbol","<>"],["word","0"],["word","or"],["word","t"],["symbol","."],["word","typcollation"],["symbol","<>"],["word","0"],["word","or"],["word","not"],["symbol","("],["symbol","("],["word","t"],["symbol","."],["word","typtype"],["symbol","="],["string","c"],["word","and"],["word","t"],["symbol","."],["word","typrelid"],["symbol","="],["word","any"],["symbol","("],["word","tables"],["symbol",")"],["word","and"],["word","t"],["symbol","."],["word","typname"],["symbol","="],["symbol","("],["word","select"],["word","relname"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_class"],["word","where"],["word","oid"],["symbol","="],["word","t"],["symbol","."],["word","typrelid"],["symbol",")"],["symbol",")"],["word","or"],["symbol","("],["word","t"],["symbol","."],["word","typtype"],["symbol","="],["string","b"],["word","and"],["word","t"],["symbol","."],["word","typcategory"],["symbol","="],["string","A"],["word","and"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_class"],["word","c"],["word","where"],["word","c"],["symbol","."],["word","oid"],["symbol","="],["word","any"],["symbol","("],["word","tables"],["symbol",")"],["word","and"],["word","c"],["symbol","."],["word","reltype"],["symbol","="],["word","t"],["symbol","."],["word","typelem"],["word","and"],["word","t"],["symbol","."],["word","typname"],["symbol","="],["string","_"],["symbol","||"],["word","c"],["symbol","."],["word","relname"],["symbol",")"],["symbol",")"],["symbol",")"],["symbol",")"],["symbol",")"],["word","then"],["word","raise"],["word","exception"],["string","__literal_refusal__"],["symbol",";"],["word","end"],["word","if"],["symbol",";"],["word","select"],["word","array_agg"],["symbol","("],["word","oid"],["word","order"],["word","by"],["word","oid"],["symbol",")"],["word","into"],["word","relations"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_class"],["word","where"],["word","oid"],["symbol","="],["word","any"],["symbol","("],["word","tables"],["symbol","||"],["word","indexes"],["symbol",")"],["word","or"],["word","oid"],["word","in"],["symbol","("],["word","select"],["word","reltoastrelid"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_class"],["word","where"],["word","oid"],["symbol","="],["word","any"],["symbol","("],["word","tables"],["symbol",")"],["symbol",")"],["word","or"],["word","oid"],["word","in"],["symbol","("],["word","select"],["word","indexrelid"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_index"],["word","where"],["word","indrelid"],["word","in"],["symbol","("],["word","select"],["word","reltoastrelid"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_class"],["word","where"],["word","oid"],["symbol","="],["word","any"],["symbol","("],["word","tables"],["symbol",")"],["symbol",")"],["symbol",")"],["symbol",";"],["word","if"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_class"],["word","c"],["word","where"],["word","c"],["symbol","."],["word","oid"],["symbol","="],["word","any"],["symbol","("],["word","relations"],["symbol",")"],["word","and"],["symbol","("],["word","c"],["symbol","."],["word","relowner"],["symbol","<>"],["string","postgres"],["symbol","::"],["word","regrole"],["word","or"],["word","c"],["symbol","."],["word","relpersistence"],["symbol","<>"],["string","p"],["word","or"],["word","c"],["symbol","."],["word","reloptions"],["word","is"],["word","not"],["word","null"],["word","or"],["word","c"],["symbol","."],["word","reltablespace"],["symbol","<>"],["word","0"],["word","or"],["word","c"],["symbol","."],["word","relrewrite"],["symbol","<>"],["word","0"],["word","or"],["word","c"],["symbol","."],["word","relhasrules"],["word","or"],["word","c"],["symbol","."],["word","relhassubclass"],["word","or"],["word","c"],["symbol","."],["word","relispartition"],["word","or"],["word","c"],["symbol","."],["word","reloftype"],["symbol","<>"],["word","0"],["word","or"],["word","not"],["word","c"],["symbol","."],["word","relispopulated"],["symbol",")"],["symbol",")"],["word","or"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_class"],["word","where"],["word","oid"],["symbol","="],["word","any"],["symbol","("],["word","tables"],["symbol",")"],["word","and"],["symbol","("],["word","relkind"],["symbol","<>"],["string","r"],["word","or"],["word","relreplident"],["symbol","<>"],["string","d"],["word","or"],["word","relam"],["symbol","<>"],["symbol","("],["word","select"],["word","oid"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_am"],["word","where"],["word","amname"],["symbol","="],["string","heap"],["word","and"],["word","amtype"],["symbol","="],["string","t"],["symbol",")"],["symbol",")"],["symbol",")"],["word","or"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_class"],["word","where"],["word","oid"],["symbol","="],["word","any"],["symbol","("],["word","indexes"],["symbol",")"],["word","and"],["symbol","("],["word","relkind"],["symbol","<>"],["string","i"],["word","or"],["word","relacl"],["word","is"],["word","not"],["word","null"],["word","or"],["word","relam"],["symbol","<>"],["symbol","("],["word","select"],["word","oid"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_am"],["word","where"],["word","amname"],["symbol","="],["string","btree"],["word","and"],["word","amtype"],["symbol","="],["string","i"],["symbol",")"],["symbol",")"],["symbol",")"],["word","or"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_inherits"],["word","where"],["word","inhrelid"],["symbol","="],["word","any"],["symbol","("],["word","relations"],["symbol",")"],["word","or"],["word","inhparent"],["symbol","="],["word","any"],["symbol","("],["word","relations"],["symbol",")"],["symbol",")"],["word","or"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_attribute"],["word","a"],["word","join"],["word","pg_catalog"],["symbol","."],["word","pg_type"],["word","t"],["word","on"],["word","t"],["symbol","."],["word","oid"],["symbol","="],["word","a"],["symbol","."],["word","atttypid"],["word","where"],["word","a"],["symbol","."],["word","attrelid"],["symbol","="],["word","any"],["symbol","("],["word","relations"],["symbol",")"],["word","and"],["word","a"],["symbol","."],["word","attnum"],["symbol",">"],["word","0"],["word","and"],["symbol","("],["word","a"],["symbol","."],["word","attisdropped"],["word","or"],["word","a"],["symbol","."],["word","attacl"],["word","is"],["word","not"],["word","null"],["word","or"],["word","a"],["symbol","."],["word","attoptions"],["word","is"],["word","not"],["word","null"],["word","or"],["word","a"],["symbol","."],["word","attfdwoptions"],["word","is"],["word","not"],["word","null"],["word","or"],["word","a"],["symbol","."],["word","atthasmissing"],["word","or"],["word","a"],["symbol","."],["word","attstattarget"],["symbol","<>"],["symbol","-"],["word","1"],["word","or"],["word","a"],["symbol","."],["word","attcompression"],["symbol","<>"],["string",""],["word","or"],["word","a"],["symbol","."],["word","attstorage"],["symbol","<>"],["word","case"],["word","when"],["word","a"],["symbol","."],["word","attrelid"],["word","in"],["symbol","("],["word","select"],["word","reltoastrelid"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_class"],["word","where"],["word","oid"],["symbol","="],["word","any"],["symbol","("],["word","tables"],["symbol",")"],["symbol",")"],["word","then"],["string","p"],["symbol","::"],["identifier","char"],["word","else"],["word","t"],["symbol","."],["word","typstorage"],["word","end"],["symbol",")"],["symbol",")"],["word","or"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_index"],["word","where"],["word","indexrelid"],["symbol","="],["word","any"],["symbol","("],["word","indexes"],["symbol",")"],["word","and"],["symbol","("],["word","not"],["word","indisvalid"],["word","or"],["word","not"],["word","indisready"],["word","or"],["word","not"],["word","indislive"],["word","or"],["word","indisclustered"],["word","or"],["word","indisreplident"],["word","or"],["word","indisexclusion"],["word","or"],["word","not"],["word","indimmediate"],["word","or"],["word","indnullsnotdistinct"],["symbol",")"],["symbol",")"],["word","or"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_constraint"],["word","where"],["word","conrelid"],["symbol","="],["word","any"],["symbol","("],["word","tables"],["symbol",")"],["word","and"],["symbol","("],["word","contype"],["word","not"],["word","in"],["symbol","("],["string","c"],["symbol",","],["string","p"],["symbol",","],["string","u"],["symbol",")"],["word","or"],["word","not"],["word","convalidated"],["word","or"],["word","condeferrable"],["word","or"],["word","condeferred"],["word","or"],["word","connoinherit"],["word","is"],["word","distinct"],["word","from"],["symbol","("],["word","contype"],["word","in"],["symbol","("],["string","p"],["symbol",","],["string","u"],["symbol",")"],["symbol",")"],["word","or"],["word","coninhcount"],["symbol","<>"],["word","0"],["word","or"],["word","not"],["word","conislocal"],["word","or"],["word","conparentid"],["symbol","<>"],["word","0"],["symbol",")"],["symbol",")"],["word","or"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_trigger"],["word","where"],["word","tgrelid"],["symbol","="],["word","any"],["symbol","("],["word","tables"],["symbol",")"],["word","and"],["symbol","("],["word","tgfoid"],["symbol","<>"],["string","public.update_updated_at()"],["symbol","::"],["word","regprocedure"],["word","or"],["word","tgtype"],["symbol","<>"],["word","19"],["word","or"],["word","tgenabled"],["symbol","<>"],["string","O"],["word","or"],["word","tgisinternal"],["word","or"],["word","tgdeferrable"],["word","or"],["word","tginitdeferred"],["word","or"],["word","tgconstraint"],["symbol","<>"],["word","0"],["word","or"],["word","tgnargs"],["symbol","<>"],["word","0"],["word","or"],["word","tgqual"],["word","is"],["word","not"],["word","null"],["word","or"],["word","tgoldtable"],["word","is"],["word","not"],["word","null"],["word","or"],["word","tgnewtable"],["word","is"],["word","not"],["word","null"],["symbol",")"],["symbol",")"],["word","then"],["word","raise"],["word","exception"],["string","__literal_refusal__"],["symbol",";"],["word","end"],["word","if"],["symbol",";"],["word","if"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_proc"],["word","p"],["word","where"],["word","p"],["symbol","."],["word","oid"],["symbol","="],["word","rpc"],["word","and"],["symbol","("],["word","p"],["symbol","."],["word","proowner"],["symbol","<>"],["string","postgres"],["symbol","::"],["word","regrole"],["word","or"],["word","p"],["symbol","."],["word","prolang"],["symbol","<>"],["symbol","("],["word","select"],["word","oid"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_language"],["word","where"],["word","lanname"],["symbol","="],["string","plpgsql"],["symbol",")"],["word","or"],["word","p"],["symbol","."],["word","prokind"],["symbol","<>"],["string","f"],["word","or"],["word","p"],["symbol","."],["word","prorettype"],["symbol","<>"],["string","jsonb"],["symbol","::"],["word","regtype"],["word","or"],["word","p"],["symbol","."],["word","proretset"],["word","or"],["word","p"],["symbol","."],["word","proisstrict"],["word","or"],["word","p"],["symbol","."],["word","proleakproof"],["word","or"],["word","p"],["symbol","."],["word","provolatile"],["symbol","<>"],["string","v"],["word","or"],["word","p"],["symbol","."],["word","proparallel"],["symbol","<>"],["string","u"],["word","or"],["word","p"],["symbol","."],["word","provariadic"],["symbol","<>"],["word","0"],["word","or"],["word","p"],["symbol","."],["word","prosupport"],["symbol","<>"],["word","0"],["word","or"],["word","p"],["symbol","."],["word","pronargs"],["symbol","<>"],["word","2"],["word","or"],["word","p"],["symbol","."],["word","pronargdefaults"],["symbol","<>"],["word","1"],["word","or"],["word","p"],["symbol","."],["word","proargmodes"],["word","is"],["word","not"],["word","null"],["word","or"],["word","p"],["symbol","."],["word","proallargtypes"],["word","is"],["word","not"],["word","null"],["word","or"],["word","p"],["symbol","."],["word","proargnames"],["word","is"],["word","distinct"],["word","from"],["word","array"],["symbol","["],["string","p_request_key"],["symbol",","],["string","p_limit"],["symbol","]"],["symbol","::"],["word","text"],["symbol","["],["symbol","]"],["word","or"],["word","pg_get_expr"],["symbol","("],["word","p"],["symbol","."],["word","proargdefaults"],["symbol",","],["word","0"],["symbol",")"],["symbol","<>"],["string","100"],["word","or"],["word","p"],["symbol","."],["word","procost"],["symbol","<>"],["word","100"],["word","or"],["word","p"],["symbol","."],["word","prorows"],["symbol","<>"],["word","0"],["symbol",")"],["symbol",")"],["word","then"],["word","raise"],["word","exception"],["string","__literal_refusal__"],["symbol",";"],["word","end"],["word","if"],["symbol",";"],["word","if"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","unnest"],["symbol","("],["word","array"],["symbol","["],["string","anon"],["symbol",","],["string","authenticated"],["symbol",","],["string","app_tenant"],["symbol",","],["string","service_role"],["symbol","]"],["symbol",")"],["word","r"],["symbol","("],["word","name"],["symbol",")"],["word","cross"],["word","join"],["word","unnest"],["symbol","("],["word","tables"],["symbol",")"],["word","t"],["symbol","("],["word","oid"],["symbol",")"],["word","cross"],["word","join"],["word","unnest"],["symbol","("],["word","array"],["symbol","["],["string","SELECT"],["symbol",","],["string","INSERT"],["symbol",","],["string","UPDATE"],["symbol",","],["string","DELETE"],["symbol",","],["string","TRUNCATE"],["symbol",","],["string","REFERENCES"],["symbol",","],["string","TRIGGER"],["symbol","]"],["symbol",")"],["word","v"],["symbol","("],["word","name"],["symbol",")"],["word","where"],["word","has_table_privilege"],["symbol","("],["word","r"],["symbol","."],["word","name"],["symbol",","],["word","t"],["symbol","."],["word","oid"],["symbol",","],["word","v"],["symbol","."],["word","name"],["symbol",")"],["word","is"],["word","distinct"],["word","from"],["symbol","("],["word","r"],["symbol","."],["word","name"],["symbol","="],["string","service_role"],["word","and"],["word","v"],["symbol","."],["word","name"],["symbol","="],["string","SELECT"],["symbol",")"],["symbol",")"],["word","or"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","unnest"],["symbol","("],["word","array"],["symbol","["],["string","anon"],["symbol",","],["string","authenticated"],["symbol",","],["string","app_tenant"],["symbol",","],["string","service_role"],["symbol","]"],["symbol",")"],["word","r"],["symbol","("],["word","name"],["symbol",")"],["word","where"],["word","has_function_privilege"],["symbol","("],["word","r"],["symbol","."],["word","name"],["symbol",","],["word","rpc"],["symbol",","],["string","EXECUTE"],["symbol",")"],["word","is"],["word","distinct"],["word","from"],["symbol","("],["word","r"],["symbol","."],["word","name"],["symbol","="],["string","service_role"],["symbol",")"],["word","or"],["word","has_function_privilege"],["symbol","("],["word","r"],["symbol","."],["word","name"],["symbol",","],["word","rpc"],["symbol",","],["string","EXECUTE WITH GRANT OPTION"],["symbol",")"],["symbol",")"],["word","then"],["word","raise"],["word","exception"],["string","__literal_refusal__"],["symbol",";"],["word","end"],["word","if"],["symbol",";"],["word","if"],["word","exists"],["symbol","("],["word","with"],["word","addresses"],["symbol","("],["word","classid"],["symbol",","],["word","objid"],["symbol",")"],["word","as"],["symbol","("],["word","select"],["string","pg_catalog.pg_class"],["symbol","::"],["word","regclass"],["symbol",","],["word","unnest"],["symbol","("],["word","relations"],["symbol",")"],["word","union"],["word","all"],["word","select"],["string","pg_catalog.pg_type"],["symbol","::"],["word","regclass"],["symbol",","],["word","unnest"],["symbol","("],["word","types"],["symbol",")"],["word","union"],["word","all"],["word","select"],["string","pg_catalog.pg_proc"],["symbol","::"],["word","regclass"],["symbol",","],["word","rpc"],["word","union"],["word","all"],["word","select"],["string","pg_catalog.pg_constraint"],["symbol","::"],["word","regclass"],["symbol",","],["word","oid"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_constraint"],["word","where"],["word","conrelid"],["symbol","="],["word","any"],["symbol","("],["word","tables"],["symbol",")"],["word","union"],["word","all"],["word","select"],["string","pg_catalog.pg_attrdef"],["symbol","::"],["word","regclass"],["symbol",","],["word","oid"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_attrdef"],["word","where"],["word","adrelid"],["symbol","="],["word","any"],["symbol","("],["word","tables"],["symbol",")"],["word","union"],["word","all"],["word","select"],["string","pg_catalog.pg_trigger"],["symbol","::"],["word","regclass"],["symbol",","],["word","oid"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_trigger"],["word","where"],["word","tgrelid"],["symbol","="],["word","any"],["symbol","("],["word","tables"],["symbol",")"],["word","union"],["word","all"],["word","select"],["string","pg_catalog.pg_policy"],["symbol","::"],["word","regclass"],["symbol",","],["word","oid"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_policy"],["word","where"],["word","polrelid"],["symbol","="],["word","any"],["symbol","("],["word","tables"],["symbol",")"],["symbol",")"],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_depend"],["word","d"],["word","join"],["word","addresses"],["word","a"],["word","on"],["word","a"],["symbol","."],["word","classid"],["symbol","="],["word","d"],["symbol","."],["word","refclassid"],["word","and"],["word","a"],["symbol","."],["word","objid"],["symbol","="],["word","d"],["symbol","."],["word","refobjid"],["word","where"],["word","not"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","addresses"],["word","b"],["word","where"],["word","b"],["symbol","."],["word","classid"],["symbol","="],["word","d"],["symbol","."],["word","classid"],["word","and"],["word","b"],["symbol","."],["word","objid"],["symbol","="],["word","d"],["symbol","."],["word","objid"],["symbol",")"],["word","union"],["word","all"],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_depend"],["word","d"],["word","join"],["word","addresses"],["word","a"],["word","on"],["word","a"],["symbol","."],["word","classid"],["symbol","="],["word","d"],["symbol","."],["word","classid"],["word","and"],["word","a"],["symbol","."],["word","objid"],["symbol","="],["word","d"],["symbol","."],["word","objid"],["word","where"],["word","d"],["symbol","."],["word","deptype"],["word","in"],["symbol","("],["string","e"],["symbol",","],["string","x"],["symbol",")"],["word","union"],["word","all"],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_description"],["word","d"],["word","join"],["word","addresses"],["word","a"],["word","on"],["word","a"],["symbol","."],["word","classid"],["symbol","="],["word","d"],["symbol","."],["word","classoid"],["word","and"],["word","a"],["symbol","."],["word","objid"],["symbol","="],["word","d"],["symbol","."],["word","objoid"],["word","where"],["word","not"],["symbol","("],["word","d"],["symbol","."],["word","classoid"],["symbol","="],["string","pg_catalog.pg_proc"],["symbol","::"],["word","regclass"],["word","and"],["word","d"],["symbol","."],["word","objoid"],["symbol","="],["word","rpc"],["word","and"],["word","d"],["symbol","."],["word","objsubid"],["symbol","="],["word","0"],["symbol",")"],["word","union"],["word","all"],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_seclabel"],["word","d"],["word","join"],["word","addresses"],["word","a"],["word","on"],["word","a"],["symbol","."],["word","classid"],["symbol","="],["word","d"],["symbol","."],["word","classoid"],["word","and"],["word","a"],["symbol","."],["word","objid"],["symbol","="],["word","d"],["symbol","."],["word","objoid"],["word","union"],["word","all"],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_init_privs"],["word","d"],["word","join"],["word","addresses"],["word","a"],["word","on"],["word","a"],["symbol","."],["word","classid"],["symbol","="],["word","d"],["symbol","."],["word","classoid"],["word","and"],["word","a"],["symbol","."],["word","objid"],["symbol","="],["word","d"],["symbol","."],["word","objoid"],["symbol",")"],["word","then"],["word","raise"],["word","exception"],["string","__literal_refusal__"],["symbol",";"],["word","end"],["word","if"],["symbol",";"],["word","select"],["word","jsonb_build_object"],["symbol","("],["string","namespace"],["symbol",","],["symbol","("],["word","select"],["word","jsonb_build_object"],["symbol","("],["string","owner"],["symbol",","],["word","pg_get_userbyid"],["symbol","("],["word","nspowner"],["symbol",")"],["symbol",","],["string","acl"],["symbol",","],["word","nspacl"],["symbol",")"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_namespace"],["word","where"],["word","nspname"],["symbol","="],["string","public"],["symbol",")"],["symbol",","],["string","function"],["symbol",","],["symbol","("],["word","select"],["word","jsonb_build_object"],["symbol","("],["string","owner"],["symbol",","],["word","pg_get_userbyid"],["symbol","("],["word","proowner"],["symbol",")"],["symbol",","],["string","acl"],["symbol",","],["word","proacl"],["symbol",","],["string","security_definer"],["symbol",","],["word","prosecdef"],["symbol",","],["string","config"],["symbol",","],["word","proconfig"],["symbol",","],["string","comment"],["symbol",","],["word","obj_description"],["symbol","("],["word","oid"],["symbol",","],["string","pg_proc"],["symbol",")"],["symbol",","],["string","definition_sha256"],["symbol",","],["word","encode"],["symbol","("],["word","sha256"],["symbol","("],["word","convert_to"],["symbol","("],["word","pg_get_functiondef"],["symbol","("],["word","oid"],["symbol",")"],["symbol",","],["string","UTF8"],["symbol",")"],["symbol",")"],["symbol",","],["string","hex"],["symbol",")"],["symbol",")"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_proc"],["word","where"],["word","oid"],["symbol","="],["word","rpc"],["symbol",")"],["symbol",","],["string","tables"],["symbol",","],["symbol","("],["word","select"],["word","jsonb_agg"],["symbol","("],["word","jsonb_build_object"],["symbol","("],["string","name"],["symbol",","],["word","c"],["symbol","."],["word","relname"],["symbol",","],["string","owner"],["symbol",","],["word","pg_get_userbyid"],["symbol","("],["word","c"],["symbol","."],["word","relowner"],["symbol",")"],["symbol",","],["string","kind"],["symbol",","],["word","c"],["symbol","."],["word","relkind"],["symbol",","],["string","persistence"],["symbol",","],["word","c"],["symbol","."],["word","relpersistence"],["symbol",","],["string","acl"],["symbol",","],["word","c"],["symbol","."],["word","relacl"],["symbol",","],["string","rls"],["symbol",","],["word","c"],["symbol","."],["word","relrowsecurity"],["symbol",","],["string","force_rls"],["symbol",","],["word","c"],["symbol","."],["word","relforcerowsecurity"],["symbol",","],["string","columns"],["symbol",","],["symbol","("],["word","select"],["word","jsonb_agg"],["symbol","("],["word","jsonb_build_object"],["symbol","("],["string","ordinal"],["symbol",","],["word","a"],["symbol","."],["word","attnum"],["symbol",","],["string","name"],["symbol",","],["word","a"],["symbol","."],["word","attname"],["symbol",","],["string","type"],["symbol",","],["word","format_type"],["symbol","("],["word","a"],["symbol","."],["word","atttypid"],["symbol",","],["word","a"],["symbol","."],["word","atttypmod"],["symbol",")"],["symbol",","],["string","not_null"],["symbol",","],["word","a"],["symbol","."],["word","attnotnull"],["symbol",","],["string","dropped"],["symbol",","],["word","a"],["symbol","."],["word","attisdropped"],["symbol",","],["string","identity"],["symbol",","],["word","a"],["symbol","."],["word","attidentity"],["symbol",","],["string","generated"],["symbol",","],["word","a"],["symbol","."],["word","attgenerated"],["symbol",","],["string","collation"],["symbol",","],["word","a"],["symbol","."],["word","attcollation"],["symbol","::"],["word","regcollation"],["symbol","::"],["word","text"],["symbol",","],["string","default"],["symbol",","],["word","pg_get_expr"],["symbol","("],["word","d"],["symbol","."],["word","adbin"],["symbol",","],["word","d"],["symbol","."],["word","adrelid"],["symbol",")"],["symbol",")"],["word","order"],["word","by"],["word","a"],["symbol","."],["word","attnum"],["symbol",")"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_attribute"],["word","a"],["word","left"],["word","join"],["word","pg_catalog"],["symbol","."],["word","pg_attrdef"],["word","d"],["word","on"],["word","d"],["symbol","."],["word","adrelid"],["symbol","="],["word","a"],["symbol","."],["word","attrelid"],["word","and"],["word","d"],["symbol","."],["word","adnum"],["symbol","="],["word","a"],["symbol","."],["word","attnum"],["word","where"],["word","a"],["symbol","."],["word","attrelid"],["symbol","="],["word","c"],["symbol","."],["word","oid"],["word","and"],["word","a"],["symbol","."],["word","attnum"],["symbol",">"],["word","0"],["symbol",")"],["symbol",","],["string","constraints"],["symbol",","],["symbol","("],["word","select"],["word","jsonb_agg"],["symbol","("],["word","jsonb_build_object"],["symbol","("],["string","name"],["symbol",","],["word","conname"],["symbol",","],["string","definition"],["symbol",","],["word","pg_get_constraintdef"],["symbol","("],["word","oid"],["symbol",")"],["symbol",")"],["word","order"],["word","by"],["word","conname"],["symbol",")"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_constraint"],["word","where"],["word","conrelid"],["symbol","="],["word","c"],["symbol","."],["word","oid"],["symbol",")"],["symbol",","],["string","indexes"],["symbol",","],["symbol","("],["word","select"],["word","jsonb_agg"],["symbol","("],["word","jsonb_build_object"],["symbol","("],["string","definition"],["symbol",","],["word","pg_get_indexdef"],["symbol","("],["word","indexrelid"],["symbol",")"],["symbol",")"],["word","order"],["word","by"],["word","pg_get_indexdef"],["symbol","("],["word","indexrelid"],["symbol",")"],["symbol",")"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_index"],["word","where"],["word","indrelid"],["symbol","="],["word","c"],["symbol","."],["word","oid"],["symbol",")"],["symbol",","],["string","triggers"],["symbol",","],["symbol","("],["word","select"],["word","jsonb_agg"],["symbol","("],["word","jsonb_build_object"],["symbol","("],["string","name"],["symbol",","],["word","tgname"],["symbol",","],["string","definition"],["symbol",","],["word","pg_get_triggerdef"],["symbol","("],["word","oid"],["symbol",")"],["symbol",","],["string","enabled"],["symbol",","],["word","tgenabled"],["symbol",")"],["word","order"],["word","by"],["word","tgname"],["symbol",")"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_trigger"],["word","where"],["word","tgrelid"],["symbol","="],["word","c"],["symbol","."],["word","oid"],["symbol",")"],["symbol",","],["string","policies"],["symbol",","],["symbol","("],["word","select"],["word","jsonb_agg"],["symbol","("],["word","jsonb_build_object"],["symbol","("],["string","name"],["symbol",","],["word","polname"],["symbol",","],["string","command"],["symbol",","],["word","polcmd"],["symbol",","],["string","permissive"],["symbol",","],["word","polpermissive"],["symbol",","],["string","roles"],["symbol",","],["symbol","("],["word","select"],["word","jsonb_agg"],["symbol","("],["word","case"],["word","when"],["word","r"],["symbol","="],["word","0"],["word","then"],["string","PUBLIC"],["word","else"],["word","pg_get_userbyid"],["symbol","("],["word","r"],["symbol",")"],["word","end"],["word","order"],["word","by"],["word","r"],["symbol",")"],["word","from"],["word","unnest"],["symbol","("],["word","polroles"],["symbol",")"],["word","r"],["symbol",")"],["symbol",","],["string","using"],["symbol",","],["word","pg_get_expr"],["symbol","("],["word","polqual"],["symbol",","],["word","polrelid"],["symbol",")"],["symbol",","],["string","check"],["symbol",","],["word","pg_get_expr"],["symbol","("],["word","polwithcheck"],["symbol",","],["word","polrelid"],["symbol",")"],["symbol",")"],["word","order"],["word","by"],["word","polname"],["symbol",")"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_policy"],["word","where"],["word","polrelid"],["symbol","="],["word","c"],["symbol","."],["word","oid"],["symbol",")"],["symbol",")"],["word","order"],["word","by"],["word","c"],["symbol","."],["word","relname"],["symbol",")"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_class"],["word","c"],["word","where"],["word","c"],["symbol","."],["word","oid"],["symbol","="],["word","any"],["symbol","("],["word","tables"],["symbol",")"],["symbol",")"],["symbol",")"],["word","into"],["word","actual_profile"],["symbol",";"],["word","if"],["word","actual_profile"],["word","is"],["word","distinct"],["word","from"],["word","expected_profile"],["word","then"],["word","raise"],["word","exception"],["string","__literal_refusal__"],["symbol",";"],["word","end"],["word","if"],["symbol",";"],["word","if"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","public"],["symbol","."],["word","__batches__"],["symbol",")"],["word","or"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","public"],["symbol","."],["word","__traversal__"],["symbol",")"],["word","then"],["word","raise"],["word","exception"],["string","__literal_refusal__"],["symbol",";"],["word","end"],["word","if"],["symbol",";"],["word","end"]]],["do",[["word","begin"],["word","if"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_prepared_xacts"],["symbol",")"],["word","then"],["word","raise"],["word","exception"],["string","__literal_refusal__"],["symbol",";"],["word","end"],["word","if"],["symbol",";"],["word","if"],["word","exists"],["symbol","("],["word","select"],["word","1"],["word","from"],["word","pg_catalog"],["symbol","."],["word","pg_locks"],["word","where"],["word","locktype"],["symbol","="],["string","transactionid"],["word","and"],["word","mode"],["symbol","="],["string","ExclusiveLock"],["word","and"],["word","granted"],["word","and"],["symbol","("],["word","pid"],["word","is"],["word","null"],["word","or"],["word","pid"],["symbol","<>"],["word","pg_backend_pid"],["symbol","("],["symbol",")"],["symbol",")"],["symbol",")"],["word","then"],["word","raise"],["word","exception"],["string","__literal_refusal__"],["symbol",";"],["word","end"],["word","if"],["symbol",";"],["word","end"]]],[["word","drop"],["word","function"],["word","public"],["symbol","."],["word","__rpc__"],["symbol","("],["word","text"],["symbol",","],["word","integer"],["symbol",")"],["word","restrict"],["symbol",";"]],[["word","drop"],["word","table"],["word","public"],["symbol","."],["word","__batches__"],["word","restrict"],["symbol",";"]],[["word","drop"],["word","table"],["word","public"],["symbol","."],["word","__traversal__"],["word","restrict"],["symbol",";"]],[["word","drop"],["word","index"],["word","public"],["symbol","."],["word","__sites_order_index__"],["word","restrict"],["symbol",";"]],[["word","commit"],["symbol",";"]]];
const TRAVERSAL_LITERAL_TEMPLATE = {
  "function": {
    "acl": [
      "postgres=X/postgres",
      "service_role=X/postgres"
    ],
    "comment": "Service-only bounded serialized traversal using canonical refresh; atomic cursor/outcome/request receipt, no financial posting or plug.",
    "config": [
      "search_path=pg_catalog, public"
    ],
    "definition_sha256": "__literal_definition_sha256__",
    "owner": "postgres",
    "security_definer": true
  },
  "namespace": {
    "acl": [
      "pg_database_owner=UC/pg_database_owner",
      "=U/pg_database_owner",
      "postgres=UC/pg_database_owner",
      "app_tenant=U/pg_database_owner"
    ],
    "owner": "pg_database_owner"
  },
  "tables": [
    {
      "acl": [
        "postgres=arwdDxt/postgres",
        "service_role=r/postgres"
      ],
      "columns": [
        {
          "collation": "-",
          "default": "gen_random_uuid()",
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "id",
          "not_null": true,
          "ordinal": 1,
          "type": "uuid"
        },
        {
          "collation": "\"default\"",
          "default": null,
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "request_key",
          "not_null": true,
          "ordinal": 2,
          "type": "text"
        },
        {
          "collation": "-",
          "default": null,
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "batch_limit",
          "not_null": true,
          "ordinal": 3,
          "type": "integer"
        },
        {
          "collation": "-",
          "default": null,
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "pass_id",
          "not_null": true,
          "ordinal": 4,
          "type": "uuid"
        },
        {
          "collation": "-",
          "default": null,
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "result",
          "not_null": true,
          "ordinal": 5,
          "type": "jsonb"
        },
        {
          "collation": "-",
          "default": "now()",
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "created_at",
          "not_null": true,
          "ordinal": 6,
          "type": "timestamp with time zone"
        },
        {
          "collation": "-",
          "default": "now()",
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "updated_at",
          "not_null": true,
          "ordinal": 7,
          "type": "timestamp with time zone"
        },
        {
          "collation": "-",
          "default": null,
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "deleted_at",
          "not_null": false,
          "ordinal": 8,
          "type": "timestamp with time zone"
        },
        {
          "collation": "-",
          "default": null,
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "created_by",
          "not_null": false,
          "ordinal": 9,
          "type": "uuid"
        },
        {
          "collation": "-",
          "default": null,
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "updated_by",
          "not_null": false,
          "ordinal": 10,
          "type": "uuid"
        }
      ],
      "constraints": [
        {
          "definition": "CHECK (((batch_limit >= 1) AND (batch_limit <= 500)))",
          "name": "__batches_batch_limit_check__"
        },
        {
          "definition": "PRIMARY KEY (id)",
          "name": "__batches_pkey__"
        },
        {
          "definition": "CHECK (((length(request_key) >= 1) AND (length(request_key) <= 200)))",
          "name": "__batches_request_key_check__"
        },
        {
          "definition": "UNIQUE (request_key)",
          "name": "__batches_request_key_key__"
        },
        {
          "definition": "CHECK ((jsonb_typeof(result) = 'object'::text))",
          "name": "__batches_result_check__"
        }
      ],
      "force_rls": true,
      "indexes": [
        {
          "definition": "CREATE INDEX __batches_pass_idx__ ON public.__batches__ USING btree (pass_id, created_at, id)"
        },
        {
          "definition": "CREATE UNIQUE INDEX __batches_pkey__ ON public.__batches__ USING btree (id)"
        },
        {
          "definition": "CREATE UNIQUE INDEX __batches_request_key_key__ ON public.__batches__ USING btree (request_key)"
        }
      ],
      "kind": "r",
      "name": "__batches__",
      "owner": "postgres",
      "persistence": "p",
      "policies": [
        {
          "check": null,
          "command": "r",
          "name": "__batches_service_read__",
          "permissive": true,
          "roles": [
            "service_role"
          ],
          "using": "true"
        }
      ],
      "rls": true,
      "triggers": [
        {
          "definition": "CREATE TRIGGER __batches_updated__ BEFORE UPDATE ON public.__batches__ FOR EACH ROW EXECUTE FUNCTION update_updated_at()",
          "enabled": "O",
          "name": "__batches_updated__"
        }
      ]
    },
    {
      "acl": [
        "postgres=arwdDxt/postgres",
        "service_role=r/postgres"
      ],
      "columns": [
        {
          "collation": "-",
          "default": "'00000000-0000-4000-8000-000000000349'::uuid",
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "id",
          "not_null": true,
          "ordinal": 1,
          "type": "uuid"
        },
        {
          "collation": "-",
          "default": null,
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "pass_id",
          "not_null": false,
          "ordinal": 2,
          "type": "uuid"
        },
        {
          "collation": "-",
          "default": null,
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "pass_started_at",
          "not_null": false,
          "ordinal": 3,
          "type": "timestamp with time zone"
        },
        {
          "collation": "-",
          "default": null,
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "pass_completed_at",
          "not_null": false,
          "ordinal": 4,
          "type": "timestamp with time zone"
        },
        {
          "collation": "-",
          "default": null,
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "watermark_created_at",
          "not_null": false,
          "ordinal": 5,
          "type": "timestamp with time zone"
        },
        {
          "collation": "-",
          "default": null,
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "watermark_site_id",
          "not_null": false,
          "ordinal": 6,
          "type": "uuid"
        },
        {
          "collation": "-",
          "default": null,
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "cursor_created_at",
          "not_null": false,
          "ordinal": 7,
          "type": "timestamp with time zone"
        },
        {
          "collation": "-",
          "default": null,
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "cursor_site_id",
          "not_null": false,
          "ordinal": 8,
          "type": "uuid"
        },
        {
          "collation": "-",
          "default": "0",
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "checked",
          "not_null": true,
          "ordinal": 9,
          "type": "integer"
        },
        {
          "collation": "-",
          "default": "0",
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "verified",
          "not_null": true,
          "ordinal": 10,
          "type": "integer"
        },
        {
          "collation": "-",
          "default": "0",
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "mismatches",
          "not_null": true,
          "ordinal": 11,
          "type": "integer"
        },
        {
          "collation": "-",
          "default": "0",
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "failed",
          "not_null": true,
          "ordinal": 12,
          "type": "integer"
        },
        {
          "collation": "-",
          "default": "0",
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "revision",
          "not_null": true,
          "ordinal": 13,
          "type": "bigint"
        },
        {
          "collation": "-",
          "default": "now()",
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "created_at",
          "not_null": true,
          "ordinal": 14,
          "type": "timestamp with time zone"
        },
        {
          "collation": "-",
          "default": "now()",
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "updated_at",
          "not_null": true,
          "ordinal": 15,
          "type": "timestamp with time zone"
        },
        {
          "collation": "-",
          "default": null,
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "deleted_at",
          "not_null": false,
          "ordinal": 16,
          "type": "timestamp with time zone"
        },
        {
          "collation": "-",
          "default": null,
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "created_by",
          "not_null": false,
          "ordinal": 17,
          "type": "uuid"
        },
        {
          "collation": "-",
          "default": null,
          "dropped": false,
          "generated": "",
          "identity": "",
          "name": "updated_by",
          "not_null": false,
          "ordinal": 18,
          "type": "uuid"
        }
      ],
      "constraints": [
        {
          "definition": "CHECK ((checked = ((verified + mismatches) + failed)))",
          "name": "__traversal_check__"
        },
        {
          "definition": "CHECK (((watermark_created_at IS NULL) = (watermark_site_id IS NULL)))",
          "name": "__traversal_check1__"
        },
        {
          "definition": "CHECK (((cursor_created_at IS NULL) = (cursor_site_id IS NULL)))",
          "name": "__traversal_check2__"
        },
        {
          "definition": "CHECK ((checked >= 0))",
          "name": "__traversal_checked_check__"
        },
        {
          "definition": "CHECK ((failed >= 0))",
          "name": "__traversal_failed_check__"
        },
        {
          "definition": "CHECK ((id = '00000000-0000-4000-8000-000000000349'::uuid))",
          "name": "__traversal_id_check__"
        },
        {
          "definition": "CHECK ((mismatches >= 0))",
          "name": "__traversal_mismatches_check__"
        },
        {
          "definition": "PRIMARY KEY (id)",
          "name": "__traversal_pkey__"
        },
        {
          "definition": "CHECK ((revision >= 0))",
          "name": "__traversal_revision_check__"
        },
        {
          "definition": "CHECK ((verified >= 0))",
          "name": "__traversal_verified_check__"
        }
      ],
      "force_rls": true,
      "indexes": [
        {
          "definition": "CREATE UNIQUE INDEX __traversal_pkey__ ON public.__traversal__ USING btree (id)"
        }
      ],
      "kind": "r",
      "name": "__traversal__",
      "owner": "postgres",
      "persistence": "p",
      "policies": [
        {
          "check": null,
          "command": "r",
          "name": "__traversal_service_read__",
          "permissive": true,
          "roles": [
            "service_role"
          ],
          "using": "true"
        }
      ],
      "rls": true,
      "triggers": [
        {
          "definition": "CREATE TRIGGER __traversal_updated__ BEFORE UPDATE ON public.__traversal__ FOR EACH ROW EXECUTE FUNCTION update_updated_at()",
          "enabled": "O",
          "name": "__traversal_updated__"
        }
      ]
    }
  ]
};
function traversalStable(value) {
    if(Array.isArray(value))return value.map(traversalStable);
    if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,traversalStable(value[key])]));
    return value;
}
const traversalEqual=(a,b)=>JSON.stringify(traversalStable(a))===JSON.stringify(traversalStable(b));
function traversalModel(sql) {
    const statements=sqlStatements(sql);let literal,mainIndex;
    for(let index=0;index<statements.length;index++) {
        const statement=statements[index];
        if(!word(statement[0],'do'))continue;
        if(statement.length!==3||statement[1]?.kind!=='body')throw Error('Unknown traversal DO');
        for(const token of sqlTokens(statement[1].value).filter(t=>t.kind==='body')) {
            let data;try{data=JSON.parse(token.value);}catch{throw Error('Unknown nested executable body');}
            if(literal||!data||typeof data!=='object'||!Array.isArray(data.tables)||data.tables.length!==2||!data.function||!data.namespace)throw Error('Unbound traversal literal');
            literal={index,token,data};mainIndex=index;
        }
    }
    if(!literal)throw Error('Missing traversal literal');
    const profile=literal.data;
    const traversal=profile.tables.find(t=>Array.isArray(t.columns)&&t.columns.some(c=>c.name==='cursor_site_id'));
    const batches=profile.tables.find(t=>Array.isArray(t.columns)&&t.columns.some(c=>c.name==='request_key'));
    const identifier=v=>typeof v==='string'&&/^[a-z_][a-z0-9_]{0,62}$/.test(v);
    if(!traversal||!batches||traversal===batches||!identifier(traversal.name)||!identifier(batches.name)
        ||!traversal.name.endsWith('_traversal')||!batches.name.endsWith('_batches'))throw Error('Unknown traversal families');
    const family=traversal.name.slice(0,-'traversal'.length);
    if(batches.name!==family+'batches')throw Error('Unrelated traversal families');
    const bodyTokens=sqlTokens(statements[mainIndex][1].value);
    const signatures=bodyTokens.filter((t,i)=>t.kind==='string'&&word(bodyTokens[i-3],'rpc')&&word(bodyTokens[i-2],'oid')
        &&bodyTokens[i-1]?.value===':='&&bodyTokens[i+1]?.value==='::'&&word(bodyTokens[i+2],'regprocedure')).map(t=>functionIdentity(t.value)).filter(Boolean);
    if(signatures.length!==1||!/^public\.[a-z_][a-z0-9_]*\(text,integer\)$/.test(signatures[0]))throw Error('Unbound traversal RPC');
    const signature=signatures[0],rpc=signature.slice(7,signature.indexOf('(')),rpcFamily=rpc.replace(/_v[0-9]+$/,'');
    if(rpcFamily===rpc||!identifier(rpcFamily)||typeof profile.function.definition_sha256!=='string'||!/^[0-9a-f]{64}$/.test(profile.function.definition_sha256))throw Error('Unknown RPC fingerprint');
    const bindings=new Map();
    const bind=(value,marker)=>{if(!identifier(value)||bindings.has(value)&&bindings.get(value)!==marker)throw Error('Conflicting traversal identity');bindings.set(value,marker);};
    bind(traversal.name,'__traversal__');bind(batches.name,'__batches__');bind(family,'__family__');
    bind(rpc,'__rpc__');bind(rpcFamily,'__rpc_family__');bind(family+'sites_order_idx','__sites_order_index__');
    for(const [table,role] of [[traversal,'traversal'],[batches,'batches']]) {
        for(const key of ['constraints','policies','triggers']) {
            if(!Array.isArray(table[key]))throw Error('Unknown literal subobjects');
            for(const object of table[key]) {
                if(!identifier(object.name)||!object.name.startsWith(table.name+'_'))throw Error('Unbound literal subobject');
                bind(object.name,'__'+role+object.name.slice(table.name.length)+'__');
            }
        }
        if(!Array.isArray(table.indexes))throw Error('Unknown literal indexes');
        for(const index of table.indexes) {
            const match=index.definition?.match(/^CREATE (?:UNIQUE )?INDEX ([a-z_][a-z0-9_]*) ON public\.([a-z_][a-z0-9_]*) /);
            if(!match||match[2]!==table.name||!match[1].startsWith(table.name+'_'))throw Error('Unbound literal index');
            bind(match[1],'__'+role+match[1].slice(table.name.length)+'__');
        }
    }
    const ordered=[...bindings].sort((a,b)=>b[0].length-a[0].length);
    const replace=value=>ordered.reduce((text,[name,marker])=>text.replace(new RegExp('(?<![a-z0-9_])'+name+'(?![a-z0-9_])','g'),marker),value);
    const mapData=value=>Array.isArray(value)?value.map(mapData):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[replace(key),mapData(v)])):typeof value==='string'?replace(value):value;
    const copy=JSON.parse(JSON.stringify(profile));copy.function.definition_sha256='__literal_definition_sha256__';
    const normalize=(tokens,{profileBody=false}={})=>tokens.map((token,index)=>{
        if(token.kind==='body') {
            if(!profileBody||token.start!==literal.token.start||token.end!==literal.token.end)throw Error('Unknown traversal nested body');
            return ['literal-profile','__literal_profile__'];
        }
        const refusal=token.kind==='string'&&word(tokens[index-2],'raise')&&word(tokens[index-1],'exception');
        return [token.kind,refusal?'__literal_refusal__':replace(token.value)];
    });
    // Token kinds stay part of the model: quoted identifiers cannot impersonate
    // keywords; strings, executable bodies and symbols never collapse together.
    const source=statements.map((statement,index)=>word(statement[0],'do')?
        ['do',normalize(sqlTokens(statement[1].value),{profileBody:index===mainIndex})]:normalize(statement));
    return {source,literal:traversalStable(mapData(copy)),signature,rpc,traversal:traversal.name,batches:batches.name,
        fingerprint:profile.function.definition_sha256,mainIndex};
}
function traversalCatalogCertificate(sql) {
    try {
        const model=traversalModel(sql);
        if(!traversalEqual(model.source,TRAVERSAL_SOURCE_TEMPLATE)||!traversalEqual(model.literal,TRAVERSAL_LITERAL_TEMPLATE))return [];
        return [{level:'typed-ABI',identity:model.signature,input_names:['p_request_key','p_limit'],result_type:'jsonb',
            returns_set:false,overloads:1,quiescence_guard:true,requires_catalog_lock:true,
            guard_start:sqlStatements(sql)[model.mainIndex][0].start,
            body_fingerprint:{definition_sha256:model.fingerprint,owner_relation:'public.'+model.traversal},
            catalog_retention_profile:{kind:'closed-literal-traversal-profile',relations:['public.'+model.traversal,'public.'+model.batches],
                retained_rows_refused:true,foreign_dependencies_refused:true,prepared_before_locks:true,final_quiescence_recheck:true}}];
    }catch{return [];}
}

export function rollbackSignatureGuards(sql) {
    const existing=baseRollbackSignatureGuards(sql);
    if(existing.length)return existing;
    const receipt=retentionCatalogCertificate(sql,baseRollbackSignatureGuards);
    return receipt.length?receipt:traversalCatalogCertificate(sql);
}

// Recognize a historical full-definition receipt, not a function-name exemption.
// The forward source must enumerate every restored ABI in its finite birth set;
// the rollback must revalidate that set from the receipt before any mutation.
export function birthBoundSignatureGuards(sql, forwardSql) {
    try {
        if (!forwardSql) return [];
        const statements=sqlStatements(sql), definitions=functionDefinitions(sql);
        if (!same(statements[0], 'BEGIN;') || !same(statements.at(-1), 'COMMIT;')) return [];
        const firstMutation=statements.findIndex(s=>['create','drop','alter','insert','update','delete','truncate','grant','revoke','call'].includes(s[0]?.value));
        const prefix=statements.slice(1,firstMutation);
        if (firstMutation<0 || prefix.some(s=>!['set','lock','do'].includes(s[0]?.value))) return [];
        if (!prefix.some(s=>same(s,'SET LOCAL search_path=pg_catalog,public;'))) return [];
        // Catalog provenance is checked under the same exclusive DDL admission.
        const catalogLock=prefix.find(s=>s[0]?.value==='lock' && tokenText(s).startsWith('lock table pg_catalog . pg_proc ,'));
        if (!catalogLock || !tokenText(catalogLock).endsWith('in share row exclusive mode nowait ;')) return [];
        if (prefix.some(s=>s[0]?.value==='set' && !same(s,'SET LOCAL search_path=pg_catalog,public;') && !/^set local lock_timeout = '[1-9][0-9]*(?:ms|s)' ;$/.test(tokenText(s)))) return [];
        const blocks=prefix.filter(s=>s[0]?.value==='do');
        if (blocks.some(s=>s.length!==3 || s[1].kind!=='body')) return [];
        const parsed=blocks.map(s=>({statement:s,...new GuardParser(s[1].value,true).parse()}));
        // This grammar has only SELECT, FOR, IF/RAISE EXCEPTION. No return,
        // exception handler, assignment, EXECUTE or mutating statement can bypass
        // the checks or replace their captured binding. All callees are builtins
        // under the pinned pg_catalog-first search path.
        const builtins=new Set('acldefault aclexplode array_fill coalesce convert_to count current_database current_setting encode has_function_privilege has_schema_privilege has_table_privilege jsonb_agg jsonb_array_length jsonb_each jsonb_each_text jsonb_typeof left length pg_backend_pid pg_current_xact_id_if_assigned pg_get_constraintdef pg_get_expr pg_get_functiondef pg_get_indexdef quote_ident regexp_matches regexp_replace sha256 split_part starts_with string_agg substring to_jsonb to_regclass to_regprocedure to_regrole unnest'.split(' '));
        const syntax=new Set('and array e exists from if in not or roles select values z'.split(' '));
        for (const {statement} of parsed) {
            const tokens=sqlTokens(statement[1].value);
            if(tokens.some((t,i)=>t.kind==='word' && tokens[i+1]?.value==='(' && !builtins.has(t.value) && !syntax.has(t.value))) return [];
            if(tokens.some((t,i)=>t.kind==='word' && tokens[i+1]?.value==='(' && tokens[i-1]?.value==='.' && tokens[i-2]?.value!=='pg_catalog')) return [];
            if(tokens.some((t,i)=>['e','roles','z'].includes(t.value) && tokens[i+1]?.value==='(' && ![')','as','ordinality'].includes(tokens[i-1]?.value)))return [];
        }
        const block=parsed.find(p=>p.nodes.some(n=>n.op==='for' && same(n.head,"v_entry IN SELECT key,value FROM jsonb_each(binding->'functions')")));
        if(!block) return [];
        const loopIndex=block.nodes.findIndex(n=>n.op==='for' && same(n.head,"v_entry IN SELECT key,value FROM jsonb_each(binding->'functions')"));
        const loop=block.nodes[loopIndex];
        if(loop.nodes.length!==2 || !same(loop.nodes[0].tokens,'SELECT * INTO v_fn FROM pg_proc WHERE oid=to_regprocedure(v_entry.key)') || !refuses(loop.nodes[1]) || loop.nodes[1].branches.length!==1) return [];
        const condition=terms(loop.nodes[1].branches[0].condition);
        for(const required of [
            'v_fn.oid IS NULL',
            "v_fn.oid IS DISTINCT FROM (v_entry.value->>'oid')::oid",
            "v_fn.proowner IS DISTINCT FROM (v_entry.value->>'owner')::oid",
            "encode(sha256(convert_to(v_fn.prosrc,'UTF8')),'hex') IS DISTINCT FROM v_entry.value->>'body_hash'",
            "(SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=v_fn.proname)<>1",
            "v_fn.prokind<>'f'",'v_fn.proretset','v_fn.proargmodes IS NOT NULL','v_fn.proallargtypes IS NOT NULL',
        ]) if(!condition.includes(norm(required)))return [];
        const hashTerm=condition.find(c=>c.includes('definition_hash'));
        const verifier=hashTerm?.match(/v_entry \. key <> '([^']+)'/)?.[1];
        if(!verifier || !functionIdentity(verifier) || !same(sqlTokens(hashTerm),`(v_entry.key<>'${verifier}' AND encode(sha256(convert_to(pg_get_functiondef(v_fn.oid),'UTF8')),'hex') IS DISTINCT FROM v_entry.value->>'definition_hash')`)) return [];
        const nodes=block.nodes.slice(0,loopIndex), texts=nodes.map(n=>tokenText(n.tokens??[]));
        const capture=texts.indexOf(norm(`SELECT * INTO v_fn FROM pg_proc WHERE oid=to_regprocedure('${verifier}')`));
        if(capture<0) return [];
        const receipt=nodes[capture+1]?.tokens, receiptText=tokenText(receipt??[]);
        const migration=receiptText.match(/where migration = '([0-9]+)'/)?.[1];
        if(!migration || !same(receipt,`SELECT * INTO v_journal FROM public.migration_privilege_journal WHERE migration='${migration}' AND object_signature='${verifier}' AND grantee='service_role' AND privilege='EXECUTE' AND action='granted'`))return [];
        const custody=nodes[capture+2];
        if(!refuses(custody) || custody.branches.length!==1 || !equalTerms(custody.branches[0].condition,[
            'v_fn.oid IS NULL','v_journal.object_oid IS DISTINCT FROM v_fn.oid','v_journal.object_owner IS DISTINCT FROM v_fn.proowner',
            "v_journal.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(pg_get_functiondef(v_fn.oid),'UTF8')),'hex')"
        ]))return [];
        const binding=nodes[capture+3]?.tokens, key=binding?.find(t=>t.kind==='string')?.value;
        if(!key || !/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*=$/.test(key) || !same(binding,`SELECT substring(config from length('${key}')+1)::jsonb INTO binding FROM unnest(v_fn.proconfig)config WHERE starts_with(config,'${key}')`))return [];
        const allTokens=sqlTokens(block.statement[1].value);
        if(allTokens.filter((t,i)=>t.value==='into' && allTokens[i+1]?.value==='binding').length!==1)return [];
        const valid=nodes[capture+4];
        const count=terms(valid?.branches?.[0]?.condition??[]).find(c=>c.includes('jsonb_each'))?.match(/<> ([0-9]+)$/)?.[1];
        if(!refuses(valid) || valid.branches.length!==1 || !count || !equalTerms(valid.branches[0].condition,[
            "jsonb_typeof(binding) IS DISTINCT FROM 'object'","binding->>'schema_version' IS DISTINCT FROM '1'",`(SELECT count(*) FROM jsonb_each(binding->'functions'))<>${count}`
        ]))return [];
        // The forward birth loop is finite, and each restored signature/name list
        // must match its installed definition. Capture must include exactly that
        // finite family, so deleting a member cannot turn the loop vacuous.
        const forward=sqlStatements(forwardSql), birth=forward.find(s=>s[0]?.value==='do' && s[1]?.kind==='body' && s[1].value.includes(key.slice(0,-1)));
        if(!birth)return [];
        const tokens=sqlTokens(birth[1].value), begin=tokens.findIndex(t=>word(t,'begin'));
        const loopStart=tokens.findIndex((t,i)=>i>begin && word(t,'for')), loopEnd=tokens.findIndex((t,i)=>i>loopStart && word(t,'loop'));
        const rows=finiteRows(tokens.slice(loopStart+1,loopEnd), cell=>same(cell,'NULL')||same(cell,'NULL::text[]')?null:literalCell(cell)).rows;
        const snapshot=tokenText(tokens).match(/'functions' , \( select jsonb_object_agg \( ([\s\S]*?) from pg_proc p where p \. pronamespace = 'public' :: regnamespace and p \. proname in \( ([\s\S]*?) \) \)/);
        if(!snapshot || !snapshot[1].includes("pg_get_functiondef ( p . oid )"))return [];
        const names=splitSqlList(sqlTokens(snapshot[2])).map(cell=>cell.length===1 && cell[0].kind==='string' ? cell[0].value:null);
        if(names.some(n=>!n) || names.length!==Number(count) || new Set(names).size!==names.length)return [];
        const forwardDefs=functionDefinitions(forwardSql);
        return definitions.map(fn=>{
            const row=rows.find(r=>r.signature && functionIdentity(r.signature)===fn.identity);
            const current=forwardDefs.find(d=>d.identity===fn.identity);
            if(!row || !current || !names.includes(fn.name) || JSON.stringify(row.arg_names)!==JSON.stringify(current.inputNames) || JSON.stringify(fn.inputNames)!==JSON.stringify(current.inputNames))throw Error('Unbound restored ABI');
            return {identity:fn.identity,input_names:fn.inputNames,level:'historical-full-definition',guard_start:block.statement[0].start};
        });
    } catch {return [];}
}
