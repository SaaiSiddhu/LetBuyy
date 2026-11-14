const fs=require('node:fs'),{createRequire}=require('node:module');const req=createRequire(require.resolve('next/package.json',{paths:[process.cwd()+'/apps/marketing/web']})),postcss=req('postcss');
const base='apps/marketing/web/src/app',source=fs.readFileSync('/tmp/letbuyy-mobile-performance-20261030/before-strict-css.css','utf8'),root=postcss.parse(source);
const groups={home:/\.(?:hero(?:\b|-)|commerce-globe(?:\b|-)|cg-|cmap(?:\b|-)|cop-|cn-|cnet-|mgj(?:\b|-)|ecosystem(?:\b|-)|ecos-)/,resources:/\.(?:arc-|rc-|cat-|clg-|adock-)/};
function fingerprint(n,parents=[],result=[]){if(n.type==='rule')result.push(JSON.stringify([parents,n.selector,n.nodes.map(x=>x.toString())]));else if(n.nodes)for(const c of n.nodes)fingerprint(c,n.type==='atrule'?[...parents,[n.name,n.params]]:parents,result);return result}
function eligible(selector, pattern) {
 if(selector.includes('('))return false;
 let quote='',depth=0,last=0;
 for(let i=0;i<selector.length;i++) {const ch=selector[i];if(quote){if(ch===quote&&selector[i-1]!=='\\')quote='';continue}if(ch==='\"'||ch==="'"){quote=ch;continue}if(ch==='[')depth++;else if(ch===']')depth--;else if(!depth&&/[ >+~]/.test(ch))last=i+1;}
 const subject=selector.slice(last).replace(/\[[^\]]*\]/g,'');
 return pattern.test(subject);
}
const protectedClasses=new Set();
root.walkRules(node=>{
 if(Object.values(groups).some(pattern=>node.selectors.every(selector=>eligible(selector,pattern))))return;
 for(const selector of node.selectors)for(const match of selector.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g))if(Object.values(groups).some(pattern=>pattern.test('.'+match[1])))protectedClasses.add(match[1]);
});
function independent(selector,pattern){return eligible(selector,pattern)&&![...selector.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)].some(match=>protectedClasses.has(match[1]));}
const original=fingerprint(root).sort(),outputs={},moves=[];
for(const[name,pattern]of Object.entries(groups)){const dest=postcss.root();function move(container,out){for(const node of[...container.nodes]){if(node.type==='rule'&&node.selectors.every(s=>independent(s,pattern))){out.append(node.clone());moves.push({route:name,selector:node.selector});node.remove()}else if(node.type==='atrule'&&['media','supports','container'].includes(node.name)&&node.nodes){const clone=node.clone({nodes:[]});move(node,clone);if(clone.nodes.length)out.append(clone);if(!node.nodes.length)node.remove()}}}move(root,dest);outputs[name]=dest;fs.writeFileSync(`${base}/${name}.css`,`/* Route-owned styles. Shared/mixed selectors stay in globals.css. */\n`+dest.toString()+'\n')}
const after=[...fingerprint(root),...Object.values(outputs).flatMap(n=>fingerprint(n))].sort();if(JSON.stringify(original)!==JSON.stringify(after))throw Error('A rule, declaration or at-rule condition changed');
fs.writeFileSync(base+'/globals.css',root.toString());fs.writeFileSync('/tmp/letbuyy-mobile-performance-20261030/css-strict-proof.json',JSON.stringify({original_bytes:Buffer.byteLength(source),shared_bytes:Buffer.byteLength(root.toString()),route_bytes:Object.fromEntries(Object.entries(outputs).map(([k,v])=>[k,Buffer.byteLength(v.toString())])),rule_count:original.length,protected_shared_classes:[...protectedClasses].sort(),rule_declaration_and_conditions_equal:true,method:'Move only rules where EVERY comma-separated selector has a positive route-specific SUBJECT class and NO functional pseudo selector; all :is/:where/:has/:not and mixed shared rules AND every rule touching their route classes stay in original global order. Visual and SPA route-order validation is also required.',moves},null,2));console.log(JSON.stringify({shared:Buffer.byteLength(root.toString()),routes:Object.fromEntries(Object.entries(outputs).map(([k,v])=>[k,Buffer.byteLength(v.toString())])),rules:moves.length}));
