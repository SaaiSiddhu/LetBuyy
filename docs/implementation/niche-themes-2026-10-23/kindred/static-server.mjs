import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const port=Number(process.argv[2]);
if(port!==43275)throw new Error('Kindred is allocated port43275 only.');
const root='docs/implementation/niche-themes-2026-10-23/kindred';
const fonts='docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/kindred-storybook/assets';
const scenes=new Set(JSON.parse(fs.readFileSync(path.join(root,'render-fixtures.json'),'utf8')).files.map(row=>'/'+path.basename(row.file)));
const server=http.createServer((req,res)=>{
 let name;try{name=new URL(req.url,'http://127.0.0.1:'+port).pathname;}catch{res.writeHead(400).end();return;}
 const file=name==='/fixture/storefront.css'?path.join(root,'rendered/storefront.css'):scenes.has(name)?path.join(root,'rendered',path.basename(name)):/^\/fixture\/(font-[0-4]\.ttf|identity-geist-sans-latin\.woff2)$/.test(name)?path.join(fonts,path.basename(name)):/^\/theme-assets\/kindred\/v2\/[a-z0-9-]+\.webp$/.test(name)?path.join('apps/commerce/web/public/theme-assets/kindred/v2',path.basename(name)):null;
 if(!file||!fs.existsSync(file)){res.writeHead(404).end();return;}
 const mime=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.webp')?'image/webp':file.endsWith('.woff2')?'font/woff2':'font/ttf';
 res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
});
server.listen(port,'127.0.0.1',()=>process.stdout.write(JSON.stringify({owner:'Kindred',port,pid:process.pid,scope:'Owned actual Liquid static review'})+'\n'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
