// Local HTTP transport for the actual monolith; no routes, identities or commerce logic live here.
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { createHmac } from 'node:crypto';
import { loadConfig, PORTS, ORIGINS, DATABASE } from './theme-marketplace-local-support.mjs';
const c = loadConfig(process.env.LETBUYY_MARKETPLACE_CONFIG, process.cwd());
const { default: worker } = await import(pathToFileURL(`${c.sourceRoot}/services/api-gateway/src/index.ts`).href);
const { startRestProxy } = await import(pathToFileURL(`${c.sourceRoot}/scripts/governance/owned-rest-proxy.mjs`).href);
const rest = await startRestProxy({ upstreamPort: PORTS.rest });
const { d, ...publicJwk } = c.privateJwk;
const env = { ENVIRONMENT: 'local', SUPABASE_URL: rest.url, INTERNAL_API_SECRET: c.internalSecret,
  LETBUYY_IDENTITY_ISSUER: ORIGINS.identity, LETBUYY_IDENTITY_PUBLIC_JWKS: JSON.stringify({ keys: [publicJwk] }),
  NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'localhost', CHECKOUT_ORIGIN: 'https://checkout.localhost:9024', CHECKOUT_SIGNING_SECRET: c.checkoutSecret,
  STOREFRONT_POOLED_SQL: 'on', HYPERDRIVE: { connectionString: `postgresql://authenticator:${c.dbPassword}@127.0.0.1:${PORTS.pg}/${DATABASE}` } };
let renewAt = 0;
function rotateRestCredential() {
  const now = Math.floor(Date.now() / 1000), encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  if (now < renewAt) return;
  const signingInput = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role: 'service_role', iss: 'letbuyy-local-marketplace', iat: now, exp: now + 7200 })}`;
  env.SUPABASE_SERVICE_ROLE_KEY = signingInput + '.' + createHmac('sha256', c.restSecret).update(signingInput).digest('base64url');
  renewAt = now + 3600;
}
rotateRestCredential();
const rotation = setInterval(rotateRestCredential, 60 * 60 * 1000);
const background = new Set();
const server = createServer(async (req, res) => {
  try {
    if (req.headers.host !== `127.0.0.1:${PORTS.api}` || !req.url?.startsWith('/') || req.url.startsWith('//')) { res.writeHead(421); res.end(); return; }
    if (req.url === '/__local_health' && req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ tool: 'theme-marketplace', id: c.id, sourceEpoch: c.sourceEpoch })); return; }
    const chunks = []; let length = 0;
    for await (const chunk of req) { length += chunk.length; if (length > 2 * 1024 * 1024) { res.writeHead(413); res.end(); return; } chunks.push(chunk); }
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) if (typeof value === 'string' && !['host', 'connection', 'content-length', 'transfer-encoding'].includes(name)) headers.set(name, value);
    headers.set('CF-Connecting-IP', '127.0.0.1');
    // Also refresh synchronously after laptop sleep, before any database request.
    rotateRestCredential();
    const response = await worker.fetch(new Request(ORIGINS.api + req.url, { method: req.method, headers, ...(!['GET', 'HEAD'].includes(req.method) ? { body: Buffer.concat(chunks) } : {}) }), env,
      { waitUntil(promise) { const p = Promise.resolve(promise).catch(() => undefined).finally(() => background.delete(p)); background.add(p); }, passThroughOnException() {} });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body).pipe(res); else res.end();
  } catch { if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' }); res.end('{"error":"Local API request failed"}'); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORTS.api, '127.0.0.1', resolve); });
process.send?.({ ready: true, role: 'api' });
let stopping = false;
async function stop() { if (stopping) return; stopping = true; clearInterval(rotation); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rest.close(); await Promise.allSettled(background); process.exit(0); }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop);
