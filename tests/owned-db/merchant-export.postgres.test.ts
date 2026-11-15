import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { createRequire, builtinModules } from 'node:module';
import { Miniflare } from 'miniflare';
import { nativeGatewayWasmPlugin, nativeGatewayModules, NATIVE_GATEWAY_MODULE_ROOT } from '../helpers/native-gateway-wasm';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { gatewayEnv, newIdentityKeys, nextClientAddress, signedIdentityHeaders } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';

const owned = requireOwnedDatabase();
const owner = crypto.randomUUID(), stranger = crypto.randomUUID(), store = crypto.randomUUID(), foreign = crypto.randomUUID();
const email = `syn-export-${owner}@example.invalid`, strangerEmail = `syn-export-${stranger}@example.invalid`;
const importer = crypto.randomUUID(), importStore = crypto.randomUUID(), importEmail = `syn-csv-${importer}@example.invalid`;
let mf: Miniflare;
let sqlProxy: OwnedPooledSqlProxy;
interface StoredJob { id: string; status: 'queued' | 'running' | 'completed' | 'failed'; rowCount: number; expiresAt: string; [key: string]: unknown }

before(async () => {
    sqlProxy=await startOwnedPooledSqlProxy(owned);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${email}',true),('${stranger}','${strangerEmail}',true),('${importer}','${importEmail}',true);
      INSERT INTO sites(id,name,store_name,site_type,subdomain,custom_user_id) VALUES
      ('${store}','Synthetic export','Synthetic export','store','syn-export-${store.slice(0,8)}','${owner}'),
      ('${foreign}','Synthetic foreign export','Synthetic foreign export','store','syn-export-${foreign.slice(0,8)}','${stranger}'),
      ('${importStore}','Synthetic CSV import','Synthetic CSV import','store','syn-csv-${importStore.slice(0,8)}','${importer}');
      INSERT INTO products(store_id,name,description,price,stock,is_active,status,created_at,deleted_at)
      SELECT '${store}','Synthetic, "東京" '||n,repeat('Synthetic CSV content ',300)||E'\r\nend',100+n,1,true,'active','2026-10-01',CASE WHEN n=1104 THEN now() END
      FROM generate_series(1,1104) n;
      INSERT INTO products(store_id,name,price,stock,is_active,status) VALUES('${foreign}','FOREIGN-EXPORT-SECRET',1,1,true,'active');`);
    const gatewayRequire = createRequire(new URL('../../services/api-gateway/package.json', import.meta.url));
    const compiler = createRequire(gatewayRequire.resolve('wrangler'))('esbuild') as { build(options: unknown): Promise<{ outputFiles: { text: string }[] }> };
    const bundle = await compiler.build({ entryPoints: [fileURLToPath(new URL('../../services/api-gateway/src/index.ts', import.meta.url))], absWorkingDir: fileURLToPath(new URL('../..', import.meta.url)),
        bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', tsconfig: 'services/api-gateway/tsconfig.json',
        banner: { js: "import { createRequire as nativeCreateRequire } from 'node:module'; const require = nativeCreateRequire('file:///letbuyy-export-owned.mjs');" },
        external: ['cloudflare:*', 'node:*'], conditions: ['workerd', 'worker', 'browser'], logLevel: 'silent',
        plugins: [nativeGatewayWasmPlugin(), { name: 'native-node-builtins', setup(build: { onResolve(options: { filter: RegExp }, handler: (args: { path: string }) => unknown): void }) {
            const native = new Set(builtinModules);
            build.onResolve({ filter: /^[a-z][\w/]*$/ }, args => native.has(args.path) ? { path: 'node:' + args.path, external: true } : undefined);
        } }],
    });
    const origin = new URL(owned.restUrl).origin;
    mf = new Miniflare({ modules: nativeGatewayModules(bundle.outputFiles[0].text), modulesRoot: NATIVE_GATEWAY_MODULE_ROOT, compatibilityDate: '2026-05-25', compatibilityFlags: ['nodejs_compat'], cf: false,
        bindings: gatewayEnv(owned, await newIdentityKeys(),sqlProxy.env()) as never, r2Buckets: ['R2_BUCKET'], r2Persist: false,
        durableObjects: { RUNTIME_COORDINATOR: { className: 'LetbuyyRuntimeDurableObject', useSQLite: true } }, durableObjectsPersist: false,
        outboundService: async (request: Request) => {
            assert.equal(new URL(request.url).origin, origin, 'only this owned PostgREST is reachable');
            return await fetch(request.url, { method: request.method, headers: Object.fromEntries(request.headers.entries()),
                body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body, duplex: 'half', redirect: 'error' } as RequestInit) as never;
        },
    });
    await mf.ready;
});
after(async () => { await mf?.dispose();await sqlProxy?.stop(); });

async function request(path: string, actor = owner, actorEmail = email, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    for (const [key, value] of Object.entries(await signedIdentityHeaders(actor, actorEmail))) headers.set(key, value);
    headers.set('CF-Connecting-IP', nextClientAddress());
    return mf.dispatchFetch('https://gateway.test' + path, { ...init, headers });
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

test('actual Worker refuses invalid CSV before storing a job or creating any products', { timeout: 120_000 }, async () => {
    const bucket = await mf.getR2Bucket('R2_BUCKET');
    const beforeObjects = (await bucket.list()).objects.map(object => object.key).sort();
    const beforeRows = owned.psql(`SELECT count(*) FROM products WHERE store_id='${importStore}'`);
    for (const [csv, status] of [
        ['name,price\nValid first row,10\nInvalid later row,3oops', 400],
        ['name,description\nValid first row,ok\nInvalid,"unclosed', 400],
        ['name,price\n' + Array(501).fill('Synthetic,10').join('\n'), 413],
    ] as const) {
        const result = await request('/v1/export/import-products', importer, importEmail, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': 'syn-csv-' + crypto.randomUUID() }, body: JSON.stringify({ store_id: importStore, csv }),
        });
        assert.equal(result.status, status, await result.clone().text());
        const validation=await result.json() as {error:{code:string;message:string}};
        assert.ok(['INVALID_CSV','IMPORT_TOO_LARGE'].includes(validation.error.code));
        assert.match(validation.error.message,/CSV|500 rows/);
        assert.deepEqual((await bucket.list()).objects.map(object => object.key).sort(), beforeObjects);
        assert.equal(owned.psql(`SELECT count(*) FROM products WHERE store_id='${importStore}'`), beforeRows);
    }
});

test('actual Worker imports exactly the quoted logical records through the canonical product writer', { timeout: 120_000 }, async () => {
    // Persisted authority and a normal default inventory location, never a quota bypass.
    owned.psql(`INSERT INTO inventory_locations(id,store_id,name,is_default,status) VALUES(gen_random_uuid(),'${importStore}','Synthetic CSV warehouse',true,'active');
      INSERT INTO site_entitlement_overrides(site_id,limits,reason) VALUES('${importStore}','{"products":10}'::jsonb,'Synthetic CSV acceptance');`);
    const csv = '\uFEFFname,description,price,stock\r\n"Synthetic 東京, shop","  First line\r\nSecond ""quoted"" line  ",12.34,3\r\n"Synthetic CSV second","Tail",0,0\r\n';
    const command = { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': 'syn-csv-' + crypto.randomUUID() }, body: JSON.stringify({ store_id: importStore, csv }) };
    const started = await request('/v1/export/import-products', importer, importEmail, command);
    assert.equal(started.status, 202, await started.clone().text());
    const id = (await started.json() as { data: { job: { id: string } } }).data.job.id;
    const bucket = await mf.getR2Bucket('R2_BUCKET');
    let job: StoredJob | null = null;
    for (let i = 0; i < 300; i++) {
        job = JSON.parse(await (await bucket.get(`exports/jobs/${id}.json`))!.text());
        if (job?.status === 'completed' || job?.status === 'failed') break;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(job?.status, 'completed', JSON.stringify(job));
    assert.equal(job?.rowCount, 2);
    const products = JSON.parse(owned.psql(`SELECT json_agg(json_build_object('name',name,'description',description,'price',price,'stock',stock) ORDER BY name) FROM products WHERE store_id='${importStore}'`));
    assert.deepEqual(products, [
        { name: 'Synthetic CSV second', description: 'Tail', price: 0, stock: 0 },
        { name: 'Synthetic 東京, shop', description: '  First line\r\nSecond "quoted" line  ', price: 12.34, stock: 3 },
    ]);
    const replayed = await request('/v1/export/import-products', importer, importEmail, command);
    assert.equal(replayed.status, 202, await replayed.clone().text());
    assert.equal((await replayed.json() as { data: { job: { id: string } } }).data.job.id, id, 'the existing command key recovers the same acknowledged job');
    assert.equal(owned.psql(`SELECT count(*) FROM products WHERE store_id='${importStore}'`), '2');
});


test('actual Worker job status never exposes retained internal export or import diagnostics', async () => {
 const bucket=await mf.getR2Bucket('R2_BUCKET');
 const objects=(await bucket.list({prefix:'exports/jobs/'})).objects;
 let selected:StoredJob|undefined;
 for(const item of objects){const row=JSON.parse(await (await bucket.get(item.key))!.text()) as StoredJob;
  if(row.actorId===importer && (row.storeIds as string[]).includes(importStore)){selected=row;break;}}
 assert.ok(selected,'a real acknowledged owned job exists');
 try {
  for(const type of ['products','orders','customers','product_import']){
   await bucket.put(`exports/jobs/${selected.id}.json`,JSON.stringify({...selected,type,status:'failed',errorCode:type==='product_import'?'IMPORT_FAILED':'EXPORT_FAILED',errorMessage:'SQLSTATE SYNTHETIC_PRIVATE_DIAGNOSTIC relation detail',expiresAt:'2099-01-01T00:00:00Z'}));
   const result=await request(`/v1/export/jobs/${selected.id}?store_id=${importStore}`,importer,importEmail);
   assert.equal(result.status,200);
   const text=await result.text();assert.doesNotMatch(text,/SQLSTATE|SYNTHETIC_PRIVATE_DIAGNOSTIC|relation detail/);
   const body=JSON.parse(text);assert.equal(body.data.job.error_message,type==='product_import'?'Import failed. Retry the import.':'Export failed. Retry the export.');
  }
 } finally {await bucket.put(`exports/jobs/${selected.id}.json`,JSON.stringify(selected));}
});
