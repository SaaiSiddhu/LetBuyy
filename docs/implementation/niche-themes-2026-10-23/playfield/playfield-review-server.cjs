const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const repo = path.resolve(__dirname, '../../../..');
const fontRoot = path.join(repo, 'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/playfield-storybook/assets');
const scenes = new Set(['home', 'collection', 'collection-all', 'product', 'missing', 'edition-cleared', 'edition-different', 'empty', 'long-copy', 'hindi']);
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:43273'); let file;
  if (url.pathname.startsWith('/qa-font/') && /^inter-[0-4]\.ttf$/.test(path.basename(url.pathname))) file = path.join(fontRoot, path.basename(url.pathname));
  else if (url.pathname.startsWith('/theme-assets/playfield/v2/') && /^[a-z-]+\.webp$/.test(path.basename(url.pathname))) file = path.join(repo, 'apps/commerce/web/public/theme-assets/playfield/v2', path.basename(url.pathname));
  else { const scene = url.pathname === '/' ? 'home' : path.basename(url.pathname, '.html'); if (scenes.has(scene)) file = path.join(__dirname, 'actual-liquid', scene + '.html'); }
  if (!file || !fs.existsSync(file)) { response.writeHead(404); response.end('Owned review fixture route unavailable.'); return; }
  response.writeHead(200, { 'Content-Type': { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.ttf': 'font/ttf' }[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(response);
});
server.listen(43273, '127.0.0.1');
module.exports = server;
