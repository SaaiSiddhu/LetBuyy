// Explicit-only cross-runtime manual fixture. Never auto-discovered by the DB lane.
// Uses the existing gateway/client supervisor and canonical webhook satellite.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'node:http';
import { constants, openSync, fstatSync, readFileSync, closeSync, existsSync, writeFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import webhookWorker from '../../services/webhook-service/src/index';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { holdThreadlineBrowserFixture, threadlineFixturePaths } from '../../services/api-gateway/src/__tests__/owned-db/threadline-browser-fixture';
import { INTERNAL_SECRET } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { parseRazorpayTestCsv, mapOwnedGatewayServiceUrl } from './theme-completion-provider-config.mjs';

if (process.env.LETBUYY_THEME_COMPLETION_RAZORPAY_HOLD !== '1'
    || process.env.LETBUYY_THEME_EDITOR_BROWSER_HOLD !== '1') throw new Error('Manual Test Mode fixture requires explicit opt-in');
const owned = requireOwnedDatabase();
let proxy: OwnedPooledSqlProxy | undefined;
after(async () => { await closePooledSqlClients(); await proxy?.stop(); });

test('manual all-theme fixture binds real Test Mode credentials and canonical webhook receiver', async () => {
    const file = process.env.LETBUYY_MANUAL_RAZORPAY_TEST_CSV;
    assert(file && file.startsWith('/') && !file.includes('\0'), 'An explicit authorized Test CSV path is required');
    const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    let text: string;
    try {
        const stat = fstatSync(fd);
        assert(stat.isFile() && stat.size <= 16384 && stat.uid === process.getuid?.(), 'Test CSV must be a bounded owned regular file');
        text = readFileSync(fd, 'utf8');
    } finally { closeSync(fd); }
    const credentials = parseRazorpayTestCsv(text);
    // These are exact previously qualified proposals on a new owned fixture.
    // No migration is emitted or applied to any ambient database.
    if (process.env.LETBUYY_THEME_COMPLETION_SHARED_PROPOSALS === '1') {
        const admission = JSON.parse(readFileSync('docs/implementation/niche-theme-programme/completion-2026-10-24/SHARED_RUNTIME_ADMISSION.json', 'utf8')) as { status: string; upProposals: Array<{ path: string; sha256: string }> };
        assert.equal(admission.status, 'ROOT_QUALIFIED_SHARED_PROPOSALS_FOR_OWNED_BROWSER_FIXTURE');
        assert.equal(admission.upProposals.length, 4);
        for (const proposal of admission.upProposals) {
            assert(proposal.path.startsWith('docs/implementation/') && !proposal.path.split('/').includes('..'));
            const sql = readFileSync(proposal.path, 'utf8');
            assert.equal(createHash('sha256').update(sql).digest('hex'), proposal.sha256);
            owned.scriptLarge(sql);
        }
    }
    proxy = await startOwnedPooledSqlProxy(owned);
    const bindings = { ...proxy.env(), RAZORPAY_KEY_ID: credentials.keyId, RAZORPAY_KEY_SECRET: credentials.keySecret };
    assert(!Object.hasOwn(bindings, 'HOSTED_RAZORPAY_TEST_ADAPTER'));
    const statePath = threadlineFixturePaths(owned.runId).statePath;
    let secret = randomBytes(32).toString('hex');
    const secretFile = process.env.LETBUYY_MANUAL_RAZORPAY_WEBHOOK_SECRET_FILE;
    if (secretFile !== undefined) {
        assert(secretFile.startsWith('/private/tmp/') && !secretFile.includes('\0'), 'An explicit private owned webhook-secret file is required');
        const secretFd = openSync(secretFile, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
            const stat = fstatSync(secretFd);
            assert(stat.isFile() && stat.uid === process.getuid?.() && (stat.mode & 0o777) === 0o600 && stat.size <= 256, 'Webhook secret must be a bounded0600 owned regular file');
            const value = readFileSync(secretFd, 'utf8').trim();
            assert(/^[a-f0-9]{64}$/.test(value), 'Expected the existing owned fixture webhook secret');
            secret = value;
        } finally { closeSync(secretFd); }
    }
    const privatePath = `/private/tmp/theme-completion-${owned.runId}-provider.json`;
    const deliveriesPath = `/private/tmp/theme-completion-${owned.runId}-webhook-deliveries.json`;
    const deliveries: Array<Record<string, unknown>> = [];
    const receiver = createServer();
    const controller = new AbortController();
    let holding = true;
    const hold = holdThreadlineBrowserFixture(owned, bindings, { signal: controller.signal }).finally(() => { holding = false; });
    // Register the rejection immediately while the supervised clients build.
    const outcome = hold.then(() => null, (error: unknown) => error);
    try {
        const deadline = Date.now() + 45 * 60_000;
        while (!existsSync(statePath) && holding && Date.now() < deadline) await new Promise(done => setTimeout(done, 250));
        if (!existsSync(statePath)) {
            controller.abort(new Error('Owned application readiness did not finish'));
            const error = await outcome;
            throw error instanceof Error ? error : new Error('Owned application readiness did not finish');
        }
        const state: { runId: string; apiOrigin: string } = JSON.parse(readFileSync(statePath, 'utf8'));
        assert.equal(state.runId, owned.runId);
        mapOwnedGatewayServiceUrl('https://api-gateway/v1/health', state.apiOrigin);
        const db = owned.restEnv();
        const env = {
            SUPABASE_URL: db.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: db.SUPABASE_SERVICE_ROLE_KEY,
            RAZORPAY_KEY_ID: credentials.keyId, RAZORPAY_KEY_SECRET: credentials.keySecret,
            RAZORPAY_WEBHOOK_SECRET: secret, STRIPE_WEBHOOK_SECRET: '', ENVIRONMENT: 'test',
            INTERNAL_API_SECRET: INTERNAL_SECRET,
            API_GATEWAY_SERVICE: { fetch(input: string | Request, init?: RequestInit) {
                const url = mapOwnedGatewayServiceUrl(input, state.apiOrigin);
                return typeof input === 'string' ? fetch(url, init) : fetch(new Request(url, input), init);
            } },
        };
        receiver.on('request', async (req, res) => {
            try {
                if (req.method !== 'POST' || req.url !== '/razorpay') { res.writeHead(404); res.end(); return; }
                let length = 0; const chunks: Buffer[] = [];
                for await (const chunk of req) {
                    const bytes = Buffer.from(chunk); length += bytes.length;
                    if (length > 1_048_576) { res.writeHead(413); res.end(); return; }
                    chunks.push(bytes);
                }
                const headers = new Headers();
                for (const [name, value] of Object.entries(req.headers)) if (typeof value === 'string' && !['host', 'connection', 'transfer-encoding', 'content-length'].includes(name)) headers.set(name, value);
                const body = Uint8Array.from(Buffer.concat(chunks)).buffer;
                const response = await webhookWorker.fetch(new Request('http://127.0.0.1/razorpay', { method: 'POST', headers, body }), env);
                // Passive redacted evidence only: never persist raw payloads,
                // HMAC signatures, credentials, customer details or request headers.
                let event: Record<string, unknown> = {};
                try {
                    const parsed = JSON.parse(Buffer.from(body).toString('utf8')) as { event?: unknown; payload?: { payment?: { entity?: { id?: unknown; order_id?: unknown; status?: unknown; amount?: unknown; currency?: unknown } } } };
                    const payment = parsed.payload?.payment?.entity;
                    event = { event: typeof parsed.event === 'string' ? parsed.event : null,
                        paymentId: typeof payment?.id === 'string' ? payment.id : null,
                        providerOrderId: typeof payment?.order_id === 'string' ? payment.order_id : null,
                        paymentStatus: typeof payment?.status === 'string' ? payment.status : null,
                        amount: typeof payment?.amount === 'number' ? payment.amount : null,
                        currency: typeof payment?.currency === 'string' ? payment.currency : null };
                } catch { /* Invalid input is handled by the canonical receiver. */ }
                deliveries.push({ runId: owned.runId, receivedAt: new Date().toISOString(), ...event,
                    providerEventId: headers.get('x-razorpay-event-id'), signaturePresent: headers.has('x-razorpay-signature'),
                    bodySha256: createHash('sha256').update(Buffer.from(body)).digest('hex'), canonicalStatus: response.status });
                writeFileSync(deliveriesPath, JSON.stringify(deliveries, null, 2) + '\n', { mode: 0o600 });
                res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
                res.end(Buffer.from(await response.arrayBuffer()));
            } catch { if (!res.headersSent) res.writeHead(503); res.end(); }
        });
        await new Promise<void>(done => receiver.listen(0, '127.0.0.1', done));
        const address = receiver.address(); assert(address && typeof address !== 'string');
        const callback = `http://127.0.0.1:${address.port}/razorpay`;
        writeFileSync(privatePath, JSON.stringify({ runId: owned.runId, webhookSecret: secret, localReceiver: callback,
            deliveriesPath, secretReused: secretFile !== undefined, testKeyIdSha256: createHash('sha256').update(credentials.keyId).digest('hex'), publicHttpsUrl: null }), { mode: 0o600, flag: 'wx' });
        const denied = await fetch(callback, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        assert(denied.status >= 400 && denied.status < 500, 'Unsigned callbacks must fail before provider effects');
        console.info('THEME_COMPLETION_TEST_PROVIDER_READY', JSON.stringify({ runId: owned.runId, privateConfigurationPath: privatePath,
            credentialsBound: true, injectedPaymentAdapter: false, unsignedWebhookDenied: true, publicIngressConfigured: false }));
        await hold;
    } finally {
        controller.abort(new Error('Owned provider fixture finished'));
        await outcome;
        if (receiver.listening) await new Promise<void>(done => { receiver.close(() => done()); receiver.closeAllConnections(); });
    }
});
