#!/usr/bin/env node
/**
 * LCIS Operator Dashboard — static server + /intelligence/* proxy
 *
 * Serves dashboard.html on :3335
 * Proxies /intelligence/* → http://localhost:3334/intelligence/*  (avoids CORS)
 *
 * Zero external dependencies — node:http, node:fs, node:path, node:url only.
 *
 * Usage:
 *   node serve-dashboard.mjs              # port 3335 (default)
 *   LCIS_DASH_PORT=8080 node serve-dashboard.mjs
 */

import http   from 'node:http';
import fs     from 'node:fs';
import path   from 'node:path';
import { URL, fileURLToPath } from 'node:url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const DASH_PORT  = Number(process.env.LCIS_DASH_PORT)  || 3335;
const API_PORT   = Number(process.env.LCIS_V2_PORT)    || 3334;
const API_HOST   = process.env.LCIS_V2_HOST            || 'localhost';
const DASH_HTML  = path.join(__dirname, 'dashboard.html');

// ── MIME types ────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
};

// ── Proxy one request to the Intelligence API ─────────────────────────────────
function proxyToApi(req, res, targetPath) {
  const opts = {
    hostname: API_HOST,
    port:     API_PORT,
    path:     targetPath,
    method:   req.method,
    headers:  {
      ...req.headers,
      host: `${API_HOST}:${API_PORT}`,
    },
  };

  const proxy = http.request(opts, (apiRes) => {
    res.writeHead(apiRes.statusCode, apiRes.headers);
    apiRes.pipe(res, { end: true });
  });

  proxy.on('error', (err) => {
    const body = JSON.stringify({
      error:   'Intelligence API not reachable',
      detail:  err.message,
      hint:    `Is the API server running on port ${API_PORT}? Start it with: node tools/central-intelligence/intelligence-api/server.mjs`,
    });
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(body);
  });

  req.pipe(proxy, { end: true });
}

// ── Static file server ────────────────────────────────────────────────────────
function serveStatic(req, res, filePath) {
  const ext  = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Not found: ${filePath}`);
      return;
    }
    res.writeHead(200, {
      'Content-Type':  mime,
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

// ── Request handler ───────────────────────────────────────────────────────────
function handleRequest(req, res) {
  const u        = new URL(req.url, `http://localhost:${DASH_PORT}`);
  const pathname = u.pathname;

  // Proxy /intelligence/* to the API server verbatim (includes query string)
  if (pathname.startsWith('/intelligence/')) {
    proxyToApi(req, res, req.url);
    return;
  }

  // Root → dashboard.html
  if (pathname === '/' || pathname === '/index.html') {
    serveStatic(req, res, DASH_HTML);
    return;
  }

  // Any other static file relative to this directory
  const candidate = path.join(__dirname, pathname);
  // Safety: prevent directory traversal outside __dirname
  if (!candidate.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    serveStatic(req, res, candidate);
    return;
  }

  // Default → dashboard.html (SPA fallback)
  serveStatic(req, res, DASH_HTML);
}

// ── Start ─────────────────────────────────────────────────────────────────────
const server = http.createServer(handleRequest);

server.listen(DASH_PORT, () => {
  console.log(`[LCIS-DASH] Operator dashboard → http://localhost:${DASH_PORT}`);
  console.log(`[LCIS-DASH] Proxying /intelligence/* → http://${API_HOST}:${API_PORT}/intelligence/*`);
  console.log(`[LCIS-DASH] Dashboard file: ${DASH_HTML}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[LCIS-DASH] Port ${DASH_PORT} already in use. Set LCIS_DASH_PORT to a free port.`);
  } else {
    console.error('[LCIS-DASH] Server error:', err);
  }
  process.exit(1);
});
