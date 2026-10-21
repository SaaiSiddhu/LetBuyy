import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { createRequire, builtinModules } from 'node:module';
import { Miniflare } from 'miniflare';
import { requireOwnedDatabase } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { gatewayEnv, newIdentityKeys, nextClientAddress, signedIdentityHeaders } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';

const owned = requireOwnedDatabase();
const owner = crypto.randomUUID(), stranger = crypto.randomUUID(), store = crypto.randomUUID(), foreign = crypto.randomUUID();
const email = `syn-export-${owner}@example.invalid`, strangerEmail = `syn-export-${stranger}@example.invalid`;
let mf: Miniflare;
interface StoredJob { id: string; status: 'queued' | 'running' | 'completed' | 'failed'; rowCount: number; expiresAt: string; [key: string]: unknown }

before(async () => {
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${email}',true),('${stranger}','${strangerEmail}',true);
      INSERT INTO sites(id,name,store_name,site_type,subdomain,custom_user_id) VALUES
      ('${store}','Synthetic export','Synthetic export','store','syn-export-${store.slice(0,8)}','${owner}'),
      ('${foreign}','Synthetic foreign export','Synthetic foreign export','store','syn-export-${foreign.slice(0,8)}','${stranger}');
      INSERT INTO products(store_id,name,description,price,stock,is_active,status,created_at,deleted_at)
      SELECT '${store}','Synthetic, "東京" '||n,repeat('Synthetic CSV content ',300)||E'\r\nend',100+n,1,true,'active','2026-10-01',CASE WHEN n=1104 THEN now() END
      FROM generate_series(1,1104) n;
      INSERT INTO products(store_id,name,price,stock,is_active,status) VALUES('${foreign}','FOREIGN-EXPORT-SECRET',1,1,true,'active');`);
    const gatewayRequire = createRequire(new URL('../../services/api-gateway/package.json', import.meta.url));
    const compiler = createRequire(gatewayRequire.resolve('wrangler'))('esbuild') as { build(options: unknown): Promise<{ outputFiles: { text: string }[] }> };
    const bundle = await compiler.build({ entryPoints: [new URL('../../services/api-gateway/src/index.ts', import.meta.url).pathname], absWorkingDir: new URL('../..', import.meta.url).pathname,
        bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', tsconfig: 'services/api-gateway/tsconfig.json',
        banner: { js: "import { createRequire as nativeCreateRequire } from 'node:module'; const require = nativeCreateRequire('file:///letbuyy-export-owned.mjs');" },
        external: ['cloudflare:*', 'node:*'], conditions: ['workerd', 'worker', 'browser'], logLevel: 'silent',
        plugins: [{ name: 'native-node-builtins', setup(build: { onResolve(options: { filter: RegExp }, handler: (args: { path: string }) => unknown): void }) {
            const native = new Set(builtinModules);
            build.onResolve({ filter: /^[a-z][\w/]*$/ }, args => native.has(args.path) ? { path: 'node:' + args.path, external: true } : undefined);
        } }],
    });
    const origin = new URL(owned.restUrl).origin;
    mf = new Miniflare({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-05-25', compatibilityFlags: ['nodejs_compat'], cf: false,
        bindings: gatewayEnv(owned, await newIdentityKeys()) as never, r2Buckets: ['R2_BUCKET'], r2Persist: false,
        durableObjects: { RUNTIME_COORDINATOR: { className: 'LetbuyyRuntimeDurableObject', useSQLite: true } }, durableObjectsPersist: false,
        outboundService: async (request: Request) => {
            assert.equal(new URL(request.url).origin, origin, 'only this owned PostgREST is reachable');
            return await fetch(request.url, { method: request.method, headers: Object.fromEntries(request.headers.entries()),
                body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body, duplex: 'half', redirect: 'error' } as RequestInit) as never;
        },
    });
    await mf.ready;
});
after(async () => { await mf?.dispose(); });

async function request(path: string, actor = owner, actorEmail = email) {
    return mf.dispatchFetch('https://gateway.test' + path, { headers: { ...await signedIdentityHeaders(actor, actorEmail), 'CF-Connecting-IP': nextClientAddress() } });
}

// Independent RFC-style parser: quoted CR/LF and doubled quotes are real data.
function csvRows(text: string): string[][] {
    const rows: string[][] = []; let row: string[] = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (ch === '"') quoted = false;
            else field += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(field); field = ''; }
        else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else field += ch;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
}

test('actual Worker exports every live product across REST pages and R2 parts, then rechecks current access', { timeout: 120_000 }, async () => {
    const started = await request(`/v1/export/products?store_id=${store}`);
    assert.equal(started.status, 202, await started.clone().text());
    const initial = (await started.json() as { data: { job: { id: string } } }).data.job;
    const bucket = await mf.getR2Bucket('R2_BUCKET');
    let job: StoredJob | null = null;
    for (let i = 0; i < 200; i++) {
        job = JSON.parse(await (await bucket.get(`exports/jobs/${initial.id}.json`))!.text());
        if (job?.status === 'completed' || job?.status === 'failed') break;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(job?.status, 'completed', JSON.stringify(job));
    assert.equal(job?.rowCount, 1103);
    const status = await request(`/v1/export/jobs/${initial.id}?store_id=${store}`);
    assert.equal(status.status, 200, await status.clone().text());
    const summary = (await status.json() as { data: { job: { download_url: string } } }).data.job;
    const downloadPath = new URL(summary.download_url).pathname + new URL(summary.download_url).search + `&store_id=${store}`;
    const result = await request(downloadPath);
    assert.equal(result.status, 200);
    assert.match(result.headers.get('Cache-Control')!, /no-store/);
    const csv = await result.text(), rows = csvRows(csv);
    assert.ok(Buffer.byteLength(csv) > 5 * 1024 * 1024, 'exercise real multipart completion');
    assert.equal(rows.length, 1104);
    const expected = JSON.parse(owned.psql(`SELECT json_agg(id ORDER BY created_at DESC,id) FROM products WHERE store_id='${store}' AND deleted_at IS NULL`));
    assert.deepEqual(rows.slice(1).map(row => row[0]), expected);
    assert.equal(rows[1][1].startsWith('Synthetic, "東京" '), true);
    assert.equal(rows[1][2], 'Synthetic CSV content '.repeat(300) + '\r\nend');
    assert.doesNotMatch(csv, /FOREIGN-EXPORT-SECRET/);
    assert.equal((await request(`/v1/export/jobs/${initial.id}?store_id=${foreign}`)).status, 404);
    assert.equal((await request(downloadPath, stranger, strangerEmail)).status, 404);
    owned.psql(`UPDATE sites SET custom_user_id='${stranger}' WHERE id='${store}'`);
    assert.equal((await request(`/v1/export/jobs/${initial.id}?store_id=${store}`)).status, 404);
    assert.equal((await request(downloadPath)).status, 404, 'an old signature cannot outlive store ownership');
    console.log('MERCHANT_EXPORT_OWNED_EVIDENCE', JSON.stringify({ rows: 1103, bytes: Buffer.byteLength(csv), nativeWorker: true, nativeR2: true }));
});

test('order filters and saved-customer exports cross REST caps, exclude deleted rows and expire access', { timeout: 120_000 }, async () => {
    owned.psql(`INSERT INTO orders(store_id,site_id,order_number,customer_email,shipping_address,items,subtotal,total,status,created_at,deleted_at)
      SELECT '${foreign}','${foreign}','SYN-EXPORT-'||n,'syn-order-'||n||'@example.invalid','{}'::jsonb,'[]'::jsonb,123.45,123.45,
      CASE WHEN n<=1103 OR n=1106 THEN 'shipped' ELSE 'cancelled' END,'2026-10-01',CASE WHEN n=1106 THEN now() END
      FROM generate_series(1,1106) n;
      INSERT INTO store_customers(store_id,email,full_name,created_at,deleted_at)
      SELECT '${foreign}','syn-profile-'||n||'@example.invalid','Synthetic, "東京" '||n,'2026-10-01',CASE WHEN n=1104 THEN now() END
      FROM generate_series(1,1104) n;`);
    const bucket = await mf.getR2Bucket('R2_BUCKET');
    for (const type of ['orders', 'customers']) {
        const start = await request(`/v1/export/${type}?store_id=${foreign}${type === 'orders' ? '&status=shipped' : ''}`, stranger, strangerEmail);
        assert.equal(start.status, 202, await start.clone().text());
        const id = (await start.json() as { data: { job: { id: string } } }).data.job.id;
        let persisted: StoredJob | null = null;
        for (let i = 0; i < 200; i++) {
            persisted = JSON.parse(await (await bucket.get(`exports/jobs/${id}.json`))!.text());
            if (persisted?.status === 'completed' || persisted?.status === 'failed') break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert.equal(persisted?.status, 'completed', JSON.stringify(persisted));
        assert.equal(persisted?.rowCount, 1103);
        const read = await request(`/v1/export/jobs/${id}?store_id=${foreign}`, stranger, strangerEmail);
        const summary = (await read.json() as { data: { job: { download_url: string } } }).data.job;
        const url = new URL(summary.download_url);
        const downloaded = await request(url.pathname + url.search + `&store_id=${foreign}`, stranger, strangerEmail);
        assert.equal(downloaded.status, 200);
        const rows = csvRows(await downloaded.text());
        assert.equal(rows.length, 1104);
        if (type === 'orders') {
            const expected = JSON.parse(owned.psql(`SELECT json_agg(order_number ORDER BY created_at DESC,id) FROM orders WHERE store_id='${foreign}' AND status='shipped' AND deleted_at IS NULL`));
            assert.deepEqual(rows.slice(1).map(row => row[0]), expected);
            assert.ok(rows.slice(1).every(row => row[1] === 'shipped' && row[8] === '123.45'));
        } else {
            const expected = JSON.parse(owned.psql(`SELECT json_agg(id ORDER BY created_at DESC,id) FROM store_customers WHERE store_id='${foreign}' AND deleted_at IS NULL`));
            assert.deepEqual(rows.slice(1).map(row => row[0]), expected);
        }
        assert.ok(persisted);
        await bucket.put(`exports/jobs/${id}.json`, JSON.stringify({ ...persisted, expiresAt: '2020-01-01T00:00:00Z' }));
        assert.equal((await request(`/v1/export/jobs/${id}?store_id=${foreign}`, stranger, strangerEmail)).status, 404);
        assert.equal((await request(url.pathname + url.search, stranger, strangerEmail)).status, 404);
    }
});
