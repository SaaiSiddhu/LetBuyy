// The `/rest/v1` front of an owned PostgREST sidecar.
//
// The gateway reaches PostgREST through the Supabase client, which always calls `<SUPABASE_URL>/rest/v1/<table>`;
// on a Supabase stack Kong maps that prefix onto PostgREST. A bare PostgREST has no such prefix, and the gateway's
// production code path must not change to suit a test. This is the one small piece that supplies it: a loopback
// HTTP server that forwards `/rest/v1/...` to the sidecar's published port with the prefix removed, and answers
// 404 to everything else.
//
// It lives in the runner's process, so it cannot outlive the run: closing the runner (or killing it) closes the
// listener, and there is no second container for the reaper to find. It forwards only to the one upstream port it
// was given, on 127.0.0.1, and it never adds, removes or logs credentials: the keys travel in the request headers
// exactly as the client sent them.

import { createServer, request as httpRequest } from 'node:http';

const PREFIX = '/rest/v1';
// Hop-by-hop headers are meaningful for one connection only (RFC 9110 7.6.1) and are not forwarded.
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);

function forwardableHeaders(headers) {
    return Object.fromEntries(Object.entries(headers).filter(([name]) => !HOP_BY_HOP.has(name.toLowerCase())));
}

/**
 * Starts the proxy on an OS-allocated loopback port. Resolves to `{ port, url, stats, close }`; `close` stops
 * accepting, drops idle connections and resolves once the listener is down.
 */
export function startRestProxy({ upstreamPort }) {
    if (!Number.isInteger(upstreamPort) || upstreamPort <= 0 || upstreamPort > 65535) {
        throw new Error('startRestProxy needs the sidecar\'s published port');
    }
    const stats = { forwarded: 0, refused: 0, upstreamErrors: 0 };
    const sockets = new Set();

    const server = createServer((req, res) => {
        const url = req.url ?? '/';
        if (url !== PREFIX && !url.startsWith(`${PREFIX}/`) && !url.startsWith(`${PREFIX}?`)) {
            stats.refused += 1;
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'only /rest/v1 is served by the owned fixture' }));
            return;
        }
        const upstreamPath = url.slice(PREFIX.length) || '/';
        const upstream = httpRequest({
            host: '127.0.0.1',
            port: upstreamPort,
            method: req.method,
            path: upstreamPath.startsWith('/') ? upstreamPath : `/${upstreamPath}`,
            headers: forwardableHeaders(req.headers),
        }, (upstreamRes) => {
            stats.forwarded += 1;
            res.writeHead(upstreamRes.statusCode ?? 502, forwardableHeaders(upstreamRes.headers));
            upstreamRes.pipe(res);
        });
        upstream.on('error', (error) => {
            stats.upstreamErrors += 1;
            if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: `owned REST sidecar unreachable: ${error.code ?? 'error'}` }));
        });
        req.pipe(upstream);
    });
    server.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    });

    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({
                port,
                url: `http://127.0.0.1:${port}`,
                stats,
                close: () => new Promise((done) => {
                    server.close(() => done());
                    for (const socket of sockets) socket.destroy();
                }),
            });
        });
    });
}
