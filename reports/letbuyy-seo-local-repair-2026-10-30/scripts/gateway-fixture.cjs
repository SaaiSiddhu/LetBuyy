const http=require('node:http'),fs=require('node:fs');
const state='/tmp/letbuyy-seo-repair-20261030/gateway-mode.txt';
const program={available:true,total_slots:10,used_slots:6,remaining_slots:4,active:true,paused:false};
const plan={slug:'seo-test-launch',name:'SEO fixture Launch',tagline:'Synthetic test catalogue',is_popular:true,display_order:1,status:'active',purchasable:true,regular_inr:37.25,founding_inr:31.25,savings_inr:6,has_founding:true,features:['Fixture feature'],compare_features:[{category:'Fixture comparison',items:[{label:'Products','seo-test-launch':true}]}]};
http.createServer((req,res)=>{
 const mode=fs.readFileSync(state,'utf8').trim();res.setHeader('Content-Type','application/json');
 if(mode==='timeout')return setTimeout(()=>{res.statusCode=503;res.end('{}')},8000);
 if((mode==='pricing_error'&&req.url==='/v1/pricing')||(mode==='counter_error'&&req.url.includes('remaining'))){res.statusCode=503;return res.end(JSON.stringify({error:{message:'synthetic upstream failure'}}));}
 const data=req.url==='/v1/pricing'?{plans:mode==='empty'?[]:[plan,{...plan,slug:'seo-test-soon',name:'SEO fixture Upcoming',status:'coming_soon',purchasable:false,display_order:2,is_popular:false}],founding_program:program}:program;
 res.end(JSON.stringify({success:true,data}));
}).listen(9018,'127.0.0.1',()=>console.log('Synthetic public gateway fixture listening on127.0.0.1:9018'));
