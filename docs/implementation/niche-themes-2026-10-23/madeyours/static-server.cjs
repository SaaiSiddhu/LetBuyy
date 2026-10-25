const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = __dirname, port = 43276;
const repo = path.resolve(root, '../../../..');
const fonts = path.join(repo, 'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/madeyours-storybook/assets');
const scenes = new Set(JSON.parse(fs.readFileSync(path.join(root, 'render-fixtures.json'), 'utf8')).files.map(row => '/' + path.basename(row.file)));
const server = http.createServer((req, res) => {
  let name; try { name = new URL(req.url, 'http://127.0.0.1:' + port).pathname; } catch { res.writeHead(400).end(); return; }
  const file = scenes.has(name) ? path.join(root, 'rendered', path.basename(name)) : ['/fixture/storefront.css', '/fixture/helper.js'].includes(name) ? path.join(root, 'rendered', path.basename(name)) : /^\/fixture\/inter-(400|500|600|700)\.ttf$/.test(name) ? path.join(fonts, path.basename(name)) : /^\/theme-assets\/madeyours\/v2\/[a-z]+\.webp$/.test(name) ? path.join(repo, 'apps/commerce/web/public/theme-assets/madeyours/v2', path.basename(name)) : null;
  if (!file || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  const ext = path.extname(file), mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.ttf': 'font/ttf' }[ext];
  res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' }); fs.createReadStream(file).pipe(res);
});
server.listen(port, '127.0.0.1', () => process.stdout.write(JSON.stringify({ owner: 'MadeYours', port, pid: process.pid }) + '\n'));
module.exports = server;
