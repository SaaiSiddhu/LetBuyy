import fs from 'node:fs';
const root='/Users/saai_mithra/.npm/_npx/ba16b138af87a83e/node_modules/lighthouse/core/';
const {LanternLargestContentfulPaint:LCP}=await import(root+'computed/metrics/lantern-largest-contentful-paint.js');
const base=process.argv[2]??'/tmp/letbuyy-lcp-final-20261101/verified-performance/guide-simulate-1';
const report=JSON.parse(fs.readFileSync(base+'.json')); const trace=JSON.parse(fs.readFileSync(base+'-0.trace.json'));const devtoolsLog=JSON.parse(fs.readFileSync(base+'-0.devtoolslog.json'));
const data={trace,devtoolsLog,gatherContext:{gatherMode:'navigation'},settings:report.configSettings,simulator:null,URL:{requestedUrl:report.requestedUrl,mainDocumentUrl:report.mainDocumentUrl??report.finalUrl,finalDisplayedUrl:report.finalDisplayedUrl??report.finalUrl},SourceMaps:[],HostDPR:1};
const result=await LCP.request(data,{computedCache:new Map()});
const out={timing:result.timing,keys:Object.keys(result)};
for(const mode of ['optimistic','pessimistic']){
 const est=result[mode+'Estimate'];out[mode]={keys:Object.keys(est),time:est.timeInMs};
 const entries=[...est.nodeTimings.entries()].map(([node,t])=>({id:node.id,type:node.type,url:node.request?.url,event:node.event?.name,dependencies:[...node.dependencies].map(n=>n.id),...t}));
 out[mode].nodes=entries.sort((a,b)=>a.endTime-b.endTime);
}
fs.writeFileSync(base+'-lantern.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out));
