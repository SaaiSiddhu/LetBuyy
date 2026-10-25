import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const port=Number(process.argv[2]);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Provide the coordinator-allocated localhost port.');
const root='docs/implementation/niche-themes-2026-10-23/trailmark';
const story='docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals';
const special={
  '/fixture/liquid-theme.css':root+'/rendered/storefront.css',
  '/fixture/inter-400.ttf':story+'/trailmark-storybook/assets/inter-400.ttf',
  '/fixture/inter-600.ttf':story+'/trailmark-storybook/assets/inter-600.ttf',
  '/fixture/inter-700.ttf':story+'/pantry-storybook/assets/inter-700.ttf',
  '/fixture/inter-800.ttf':story+'/trailmark-storybook/assets/inter-800.ttf',
};
const scenes=new Set(JSON.parse(fs.readFileSync(path.join(root,'render-fixtures.json'),'utf8')).files.map(row=>'/'+path.basename(row.file)));
const server=http.createServer((req,res)=>{
  let pathname;try{pathname=new URL(req.url,'http://127.0.0.1:'+port).pathname;}catch{res.writeHead(400).end();return;}
  const file=special[pathname]??(scenes.has(pathname)?path.join(root,'rendered',path.basename(pathname)):/^\/theme-assets\/trailmark\/v2\/[a-z0-9-]+\.webp$/.test(pathname)?path.join('apps/commerce/web/public/theme-assets/trailmark/v2',path.basename(pathname)):null);
  if(!file||!fs.existsSync(file)){res.writeHead(404).end();return;}
  const mime=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.webp')?'image/webp':'font/ttf';
  res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
});
server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({owner:'Trailmark',port,pid:process.pid,scope:'Owned static actual Liquid review only'})));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
