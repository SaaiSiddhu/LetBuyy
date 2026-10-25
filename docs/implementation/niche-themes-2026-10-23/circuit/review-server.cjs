const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const repo = path.resolve(__dirname, '../../../..');
const fonts = path.join(repo, 'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/circuit-storybook/assets');
const allowed = new Set(['home', 'collection', 'product', 'missing', 'empty', 'invalid']);
const mime = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:43272');let file;
  if (url.pathname.startsWith('/qa-font/') && /^inter-[0-4]\.ttf$/.test(path.basename(url.pathname))) file = path.join(fonts, path.basename(url.pathname));
  else if (url.pathname.startsWith('/theme-assets/circuit/v2/') && /^[a-z0-9-]+\.webp$/.test(path.basename(url.pathname))) file = path.join(repo, 'apps/commerce/web/public/theme-assets/circuit/v2', path.basename(url.pathname));
  else { const scene = url.pathname === '/' ? 'home' : path.basename(url.pathname, '.html');if (allowed.has(scene)) file = path.join(__dirname, 'actual-liquid', `${scene}.html`); }
  if (!file || !fs.existsSync(file)) { res.writeHead(404);res.end('Review fixture route not available.');return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });fs.createReadStream(file).pipe(res);
});
server.listen(43272, '127.0.0.1', () => process.stdout.write('Circuit isolated actual Liquid review at http://127.0.0.1:43272\n'));
module.exports = server;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
