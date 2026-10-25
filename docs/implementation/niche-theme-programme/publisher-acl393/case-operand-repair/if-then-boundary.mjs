// Limited source tripwire using the existing governance SQL lexer. NOT a PostgreSQL/PLpgSQL parser.
// Primary reference: PostgreSQL16 pl_gram.y expr_until_then/read_sql_construct, depth-zero terminator.
import {sqlTokens} from '../../../../../scripts/governance/definer-role-closure.mjs';
export function ifThenBoundaries(sql){
 const results=[];
 for(const body of sqlTokens(sql).filter(t=>t.kind==='body')){
  const tokens=sqlTokens(body.value);
  for(let i=0;i<tokens.length;i++){
   if(tokens[i].kind!=='word'||tokens[i].value!=='if'||tokens[i-1]?.value==='end')continue;
   let depth=0,openCases=0,found=false;
   for(let j=i+1;j<tokens.length;j++){
    const token=tokens[j];
    if(token.kind==='word'&&token.value==='then'&&depth===0){results.push({bodyTokenStart:body.start,ifBodyOffset:tokens[i].start,condition:body.value.slice(tokens[i+1].start,token.start),openCasesAtTerminator:openCases});found=true;break;}
    if(token.kind==='symbol'&&['(','['].includes(token.value))depth++;
    if(token.kind==='symbol'&&[')',']'].includes(token.value)){depth--;if(depth<0)throw new SyntaxError('Unbalanced IF condition');}
    if(token.kind==='word'&&token.value==='case')openCases++;
    if(token.kind==='word'&&token.value==='end'&&openCases)openCases--;
    if(token.kind==='symbol'&&token.value===';')throw new SyntaxError('IF lacks a depth-zero THEN');
   }
   if(!found)throw new SyntaxError('Incomplete IF condition');
  }
 }
 return results;
}
export function assertNoTruncatedCaseCondition(sql){const rows=ifThenBoundaries(sql);if(rows.some(r=>r.openCasesAtTerminator))throw new SyntaxError('Depth-zero THEN truncates a scalar CASE in an IF condition');return rows;}
