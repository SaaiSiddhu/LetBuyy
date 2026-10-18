import {createHash} from 'node:crypto';
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
                if(!/^[a-z_][a-z0-9_]* (?:record|integer|pg_catalog \. pg_proc(?: % rowtype)?|text \[ \](?: := array \[[\s\S]*\])?)$/.test(text)) throw Error('Unknown declaration');
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

export function rollbackSignatureGuards(sql) {
    const existing=baseRollbackSignatureGuards(sql);
    return existing.length?existing:retentionCatalogCertificate(sql,baseRollbackSignatureGuards);
}
