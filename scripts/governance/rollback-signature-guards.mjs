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
