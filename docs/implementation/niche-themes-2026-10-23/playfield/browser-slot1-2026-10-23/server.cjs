// Task-owned static server. No dynamic product filtering, app runtime or database.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const repo=path.resolve(__dirname,'../../../../..'),manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'render-manifest.json')));
const core=createRequire(path.join(repo,'apps/commerce/web/package.json'))('@letbuyy/commerce-core');
const fonts=new Map(manifest.fonts.map(font=>[font.url,path.join(repo,font.path)]));
const requests=[];
const server=http.createServer((request,response)=>{
 const url=new URL(request.url,'http://127.0.0.1:43271');let file;
 if(url.pathname==='/favicon.ico'){response.writeHead(204);return response.end();}
 if(url.pathname==='/__qa_health'){response.writeHead(200,{'Content-Type':'application/json'});return response.end(JSON.stringify({task:'playfield-browser-slot1',pid:process.pid,port:43271}));}
 if(fonts.has(url.pathname))file=fonts.get(url.pathname);
 else if(url.pathname.startsWith('/theme-assets/playfield/v2/')&&/^[a-z-]+\.webp$/.test(path.basename(url.pathname)))file=path.join(repo,'apps/commerce/web/public/theme-assets/playfield/v2',path.basename(url.pathname));
 else {
  const parsed=core.StorefrontDiscoveryQuerySchema.safeParse(core.storefrontDiscoveryQueryFromEntries(url.searchParams));
  if(parsed.success){const key=core.storefrontDiscoveryUrl(url.pathname,parsed.data);const name=manifest.routes[key];if(name)file=path.join(__dirname,'rendered',name);}
 }
 const status=file&&fs.existsSync(file)?200:404;requests.push({method:request.method,path:url.pathname,query:url.search,status});
 if(status!==200){response.writeHead(status,{'Content-Type':'text/plain'});return response.end('No pre-rendered admitted fixture for this route.');}
 response.writeHead(200,{'Content-Type':path.extname(file)==='.ttf'?'font/ttf':path.extname(file)==='.webp'?'image/webp':'text/html; charset=utf-8','Cache-Control':'no-store'});fs.createReadStream(file).pipe(response);
});
module.exports={server,requests,manifest,repo};
