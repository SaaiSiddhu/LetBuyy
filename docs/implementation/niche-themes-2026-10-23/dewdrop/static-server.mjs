import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const evidence = path.resolve('docs/implementation/niche-themes-2026-10-23/dewdrop/rendered');
const assets = path.resolve('apps/commerce/web/public/theme-assets/dewdrop/v2');
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = new URL(req.url, 'http://127.0.0.1:43271').pathname; } catch { res.writeHead(400).end(); return; }
  let file;
  if (/^\/(home|collection|product|missing-product)\.html$/.test(pathname)) file = path.join(evidence, path.basename(pathname));
  else if (/^\/theme-assets\/dewdrop\/v2\/[a-z0-9-]+\.(webp|ttf)$/.test(pathname)) file = path.join(assets, path.basename(pathname));
  if (!file || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  const mime = file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.webp') ? 'image/webp' : 'font/ttf';
  res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' }); fs.createReadStream(file).pipe(res);
});
server.listen(43271, '127.0.0.1', () => console.log('Dewdrop owned renderer fixture server on127.0.0.1:43271; pid' + process.pid));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
