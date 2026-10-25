const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const repo = path.resolve(__dirname, '../../../..');
const out = path.join(__dirname, 'browser-rendered');
const fonts = path.join(repo, 'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/pantry-storybook/assets');
const scenes = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, 'browser-fixtures.json'), 'utf8')).files.map(row => row.scene));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.ttf': 'font/ttf' };
const server = http.createServer((req,res) => {
  let name; try { name = new URL(req.url,'http://127.0.0.1').pathname; } catch { res.writeHead(400).end(); return; }
  if (name === '/favicon.ico') { res.writeHead(204).end(); return; }
  let file;
  if (['/storefront.css','/navigation.js'].includes(name)) file = path.join(out,path.basename(name));
  else if (/^\/fixture-fonts\/inter-(400|500|600|700)\.ttf$/.test(name)) file = path.join(fonts,path.basename(name));
  else if (/^\/theme-assets\/pantry\/v2\/[a-z0-9-]+\.webp$/.test(name)) file = path.join(repo,'apps/commerce/web/public/theme-assets/pantry/v2',path.basename(name));
  else { const scene = name === '/' ? 'home' : path.basename(name,'.html'); if (scenes.has(scene) && /^\/[a-z-]+\.html$/.test(name) || name === '/') file = path.join(out,scene+'.html'); }
  if (!file || !fs.existsSync(file)) { res.writeHead(404).end('Owned Pantry fixture route unavailable.'); return; }
  res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
});
server.once('error',error => { if (error.code === 'EADDRINUSE') server.listen(0,'127.0.0.1'); else throw error; });
server.listen(43270,'127.0.0.1',()=>process.stdout.write(JSON.stringify({owner:'Pantry',pid:process.pid,port:server.address().port})+'\n'));
module.exports = server;
