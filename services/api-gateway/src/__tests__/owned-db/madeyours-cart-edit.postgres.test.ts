// Canonical migration395 cohort, always on a fresh owned PostgreSQL allocation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { before, after, afterEach } from 'node:test';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { PersonalizationFactsSchema, type PersonalizationCartDraft } from '@letbuyy/commerce-core';
import { Gateway, gatewayEnv, mintSession, newIdentityKeys, seedBuyerAccount, tapRest, type IdentityKeys } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase(), { psql } = owned;
const site = newSyntheticTenant('configured-cart');
const product = crypto.randomUUID(), moss = crypto.randomUUID(), oat = crypto.randomUUID();
const facts = PersonalizationFactsSchema.parse({ version: 1, revision: 2, methods: [{ id: 'engrave', label: 'Engrave', min_graphemes: 1, max_graphemes: 18, character_set: 'unicode-letters', styles: [{ id: 'sans', label: 'Sans' }, { id: 'serif', label: 'Serif' }], placements: [{ id: 'front', label: 'Front' }, { id: 'back', label: 'Back' }] }] });
const quote = (v: string) => `'${v.replace(/'/g, "''")}'`;
const json = (v: unknown) => `${quote(JSON.stringify(v))}::jsonb`;
const signature = 'public.edit_storefront_configured_cart_line(uuid,uuid,text,timestamp with time zone,text,uuid,text,uuid,integer,jsonb)';
const writeSignature = 'public.write_storefront_cart(uuid,uuid,text,timestamp with time zone,jsonb,uuid,integer)';
let gateway: Gateway, keys: IdentityKeys, pooled: OwnedPooledSqlProxy;
before(async () => {
  assert.equal(psql(`SELECT to_regprocedure(${quote(signature)}) IS NOT NULL;`), 't', 'Exact private SQL must be admitted first; no skip or fallback');
  assert.equal(psql(`SELECT to_regprocedure(${quote(writeSignature)}) IS NOT NULL;`), 't', 'Atomic existing-writer guard must also be admitted');
  keys = await newIdentityKeys(); seedSyntheticTenant(psql, site);
  psql(`INSERT INTO products(id,store_id,site_id,name,slug,price,sku,stock,is_active,status,metadata)
    VALUES('${product}','${site.siteId}','${site.siteId}','Synthetic configured notebook','syn-${product}',690,'SYN-${product}',8,true,'active',${json({ personalization: facts })});
    INSERT INTO product_options(product_id,name,position,values) VALUES('${product}','Cover',0,'["Moss","Oat"]');
    INSERT INTO product_variants(id,product_id,title,price,inventory_qty,option1) VALUES('${moss}','${product}','Moss',690,4,'Moss'),('${oat}','${product}','Oat',690,4,'Oat');
    SELECT public.set_inventory_level_available('${product}','${moss}','${site.locationId}',4,NULL);
    SELECT public.set_inventory_level_available('${product}','${oat}','${site.locationId}',4,NULL);`);
  pooled = await startOwnedPooledSqlProxy(owned);
  gateway = new Gateway(gatewayEnv(owned, keys, { ...pooled.env(), CHECKOUT_SIGNING_SECRET: `owned-cart-edit-${crypto.randomUUID()}`, CHECKOUT_ORIGIN: 'https://checkout.letbuyy.com' }));
});
afterEach(async () => { await gateway?.settle(); });
after(async () => { await closePooledSqlClients(); await pooled?.stop(); });
type Line = { id: string; product_id: string; variant_id: string | null; quantity: number; unit_price: number; personalization: PersonalizationCartDraft };
type Cart = { id: string; cart_token: string; status: string; updated_at: string; lines: Line[] };
type Flow = { cart: Cart; headers: Record<string, string>; buyerId: string };
async function headers(buyerId: string, siteId = site.siteId, epoch = 1) {
  return { 'Content-Type': 'application/json', [LETBUYY_STOREFRONT_SESSION_HEADER]: await mintSession(keys, buyerId, { audience: 'letbuyy:storefront-session', tokenUse: 'storefront_session', epoch, extraClaims: { site_id: siteId } }) };
}
async function draft(text: string, variant: string = moss) {
  const response = await gateway.request(`/v1/storefront/${site.subdomain}/products/${product}/personalization-review?variant_id=${variant}`);
  assert.equal(response.status, 200, response.text);
  const context = response.json!.data;
  return { method_id: 'engrave', style_id: 'sans', placement_id: 'front', text, facts_revision: context.facts_revision as number, review_fingerprint: context.review_fingerprint as string };
}
async function begin(quantity = 1, bind = true): Promise<Flow> {
  const buyer = seedBuyerAccount(psql, `edit-${crypto.randomUUID().slice(0,16)}`), auth = await headers(buyer.id);
  const response = await gateway.request(`/v1/storefront/${site.subdomain}/cart`, { method: 'POST', headers: auth, body: JSON.stringify({ lines: [
    { product_id: product, variant_id: moss, quantity, properties: { Cover: 'Moss' }, personalization: await draft('Asha') },
    { product_id: product, variant_id: moss, quantity: 1, properties: { Cover: 'Moss' }, personalization: await draft('Kabir') },
  ] }) }); assert.equal(response.status, 201, response.text);
  const cart = response.json!.data as Cart;
  if (bind) { const entry = await gateway.request(`/v1/storefront/${site.subdomain}/cart/${cart.cart_token}/checkout-url`, { method: 'POST', headers: auth }); assert.equal(entry.status, 200, entry.text); }
  await gateway.settle();
  // Checkout entry can bind the buyer and advance the canonical cart revision.
  // Model a real consumer's acknowledged reload before it starts an edit.
  const current = await gateway.request(`/v1/storefront/${site.subdomain}/cart/${cart.cart_token}`, { headers: auth });
  assert.equal(current.status, 200, current.text);
  return { cart: current.json!.data as Cart, headers: auth, buyerId: buyer.id };
}
async function command(flow: Flow, text = 'Asha-Rae', variant = moss) {
  return { operation_key: crypto.randomUUID(), expected_updated_at: flow.cart.updated_at, line_id: flow.cart.lines[0].id,
    replacement: { variant_id: variant, personalization: await draft(text, variant) } };
}
const send = (flow: Flow, body: unknown, auth = flow.headers) => gateway.request(`/v1/storefront/${site.subdomain}/cart/${flow.cart.cart_token}`, { method: 'PATCH', headers: auth, body: JSON.stringify(body) });
function stored(flow: Flow): Record<string, unknown> { return JSON.parse(psql(`SELECT row_to_json(c) FROM carts c WHERE id='${flow.cart.id}' AND store_id='${site.siteId}';`)); }
function business() {
  return psql(`SELECT jsonb_build_object(
    'inventory',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM inventory_levels x WHERE store_id='${site.siteId}'),
    'orders',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM orders x WHERE store_id='${site.siteId}'),
    'payments',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM payment_transactions x WHERE site_id='${site.siteId}'),
    'ledger',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM ledger_entries x WHERE site_id='${site.siteId}'),
    'outbox',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM outbox_events x WHERE site_id='${site.siteId}'));`);
}
function receipts(flow: Flow) { return Number(psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${site.siteId}' AND scope='cart.configured_line_edit:${flow.cart.id}';`)); }

test('real worker atomically edits one configured line while retaining unrelated accepted JSON and all business effects', async () => {
  const flow = await begin(), before = stored(flow), effects = business(), edit = await command(flow);
  const response = await send(flow, { line_edit: edit }); assert.equal(response.status, 200, response.text);
  const after = stored(flow), items = after.items as Array<Record<string, unknown>>, old = before.items as Array<Record<string, unknown>>;
  assert.equal(after.id, before.id); assert.equal(after.session_id, before.session_id); assert.equal(items.length, 2);
  assert.deepEqual(items.find(row => row.id === old[1].id), old[1]); assert.equal(items[0].quantity, old[0].quantity);
  assert.equal((items[0].personalization as PersonalizationCartDraft).text, 'Asha-Rae'); assert.equal(receipts(flow), 1); assert.equal(business(), effects);
});
test('same-result merge totals quantities once and leaves different names distinct until acknowledged', async () => {
  const flow = await begin(), effects = business(); const edit = await command(flow, 'Kabir');
  const response = await send(flow, { line_edit: edit }); assert.equal(response.status, 200, response.text);
  const items = stored(flow).items as Line[]; assert.equal(items.length, 1); assert.equal(items[0].id, flow.cart.lines[1].id); assert.equal(items[0].quantity, 2); assert.equal(business(), effects);
});
test('duplicate concurrent Save has exactly one durable receipt and same current result', async () => {
  const flow = await begin(), edit = await command(flow), effects = business();
  const results = await Promise.all([send(flow, { line_edit: edit }), send(flow, { line_edit: edit })]);
  for (const response of results) assert.equal(response.status, 200, response.text);
  assert.equal(receipts(flow), 1); assert.deepEqual(results[0].json?.data?.edit_receipt, results[1].json?.data?.edit_receipt); assert.equal(business(), effects);
});
test('competing different edits against one raw revision admit one and refuse the stale competitor', async () => {
  const flow = await begin(), edits = [await command(flow, 'Asha-Rae'), await command(flow, 'Asha-Lee')], effects = business();
  const results = await Promise.all(edits.map(line_edit => send(flow, { line_edit })));
  assert.deepEqual(results.map(x => x.status).sort(), [200,409]); assert.equal(receipts(flow), 1); assert.equal(business(), effects);
});
test('lost post-commit acknowledgement recovers original key before catalog revalidation', async () => {
  const flow = await begin(), edit = await command(flow), effects = business(); let dropped = false;
  const tap = tapRest(owned.restEnv().SUPABASE_URL, async (call, forward) => {
    const body = call.json as Record<string, unknown> | null;
    const response = await forward();
    if (!dropped && call.resource === 'rpc/edit_storefront_configured_cart_line' && body?.p_replacement && response.ok) { dropped = true; throw new Error('Owned lost acknowledgement after real SQL commit'); }
    return response;
  });
  try { const unknown = await send(flow, { line_edit: edit }); assert.equal(unknown.status, 503, unknown.text); } finally { tap.restore(); }
  assert.equal(dropped, true); assert.equal(receipts(flow), 1); const committed = stored(flow); assert.equal(business(), effects);
  psql(`UPDATE buyer_accounts SET session_epoch=session_epoch+1 WHERE id='${flow.buyerId}';`);
  const revoked = await send(flow, { line_edit: edit }); assert.equal(revoked.status, 401, revoked.text); assert.deepEqual(stored(flow), committed);
  flow.headers = await headers(flow.buyerId, site.siteId, 2);
  psql(`UPDATE products SET metadata=jsonb_set(metadata,'{personalization,revision}','3'::jsonb) WHERE id='${product}';`);
  const replay = await send(flow, { line_edit: edit }); assert.equal(replay.status, 200, replay.text); assert.deepEqual(stored(flow), committed); assert.equal(receipts(flow), 1);
  psql(`UPDATE products SET metadata=${json({ personalization: facts })} WHERE id='${product}';`);
});
test('same key changed body and an old revision refuse without cart or business effects', async () => {
  const flow = await begin(), edit = await command(flow); assert.equal((await send(flow, { line_edit: edit })).status, 200);
  const before = stored(flow), effects = business();
  const changed = await send(flow, { line_edit: { ...edit, replacement: { ...edit.replacement, personalization: { ...edit.replacement.personalization, text: 'Other' } } } });
  assert.equal(changed.status, 409, changed.text); assert.equal(changed.json?.error?.code, 'CART_EDIT_INTENT_CONFLICT');
  const stale = await send(flow, { line_edit: { ...edit, operation_key: crypto.randomUUID() } }); assert.equal(stale.status, 409, stale.text);
  assert.deepEqual(stored(flow), before); assert.equal(business(), effects); assert.equal(receipts(flow), 1);
});
test('newer remove and unversioned whole-cart write cannot be overwritten by a stale edit', async () => {
  const flow = await begin(), edit = await command(flow), effects = business();
  const oldWhole = await send(flow, { lines: [] }); assert.equal(oldWhole.status, 409, oldWhole.text);
  const remaining = flow.cart.lines.slice(1).map(row => ({ product_id: row.product_id, variant_id: row.variant_id, quantity: row.quantity, properties: {}, personalization: row.personalization }));
  const remove = await send(flow, { expected_updated_at: flow.cart.updated_at, lines: remaining }); assert.equal(remove.status, 200, remove.text);
  const before = stored(flow); const stale = await send(flow, { line_edit: edit }); assert.equal(stale.status, 409, stale.text); assert.deepEqual(stored(flow), before); assert.equal(business(), effects);
});
test('invalid, foreign buyer/site, revoked-epoch and disabled-account commands conserve bound cart', async () => {
  const flow = await begin(), edit = await command(flow), before = stored(flow), effects = business();
  const other = seedBuyerAccount(psql, `foreign-${crypto.randomUUID().slice(0,12)}`);
  const foreign = await send(flow, { line_edit: edit }, await headers(other.id)); assert.equal(foreign.status, 403, foreign.text);
  const foreignWhole = await send(flow, { expected_updated_at: flow.cart.updated_at, lines: [] }, await headers(other.id)); assert.equal(foreignWhole.status, 403, foreignWhole.text);
  const wrongSite = await send(flow, { line_edit: edit }, await headers(flow.buyerId, crypto.randomUUID())); assert.equal(wrongSite.status, 401, wrongSite.text);
  const invalid = await send(flow, { line_edit: { ...edit, replacement: { ...edit.replacement, unit_price: 1 } } }); assert.equal(invalid.status, 400, invalid.text);
  psql(`UPDATE buyer_accounts SET session_epoch=session_epoch+1 WHERE id='${flow.buyerId}';`);
  const revoked = await send(flow, { line_edit: edit }); assert.equal(revoked.status, 401, revoked.text);
  psql(`UPDATE buyer_accounts SET status='disabled' WHERE id='${flow.buyerId}';`);
  const disabled = await send(flow, { line_edit: edit }, await headers(flow.buyerId, site.siteId, 2)); assert.equal(disabled.status, 403, disabled.text);
  assert.deepEqual(stored(flow), before); assert.equal(business(), effects); assert.equal(receipts(flow), 0);
});
test('invalid and non-NFC production text cannot replace an accepted line', async () => {
  const flow = await begin(), edit = await command(flow), before = stored(flow), effects = business();
  for (const text of ['Asha ✦','Jose\u0301','A'.repeat(19),'<b>Asha</b>']) {
    const response = await send(flow, { line_edit: { ...edit, operation_key: crypto.randomUUID(), replacement: { ...edit.replacement, personalization: { ...edit.replacement.personalization, text } } } });
    assert.equal(response.status, 409, response.text); assert.deepEqual(stored(flow), before); assert.equal(receipts(flow), 0); assert.equal(business(), effects);
  }
});
test('variant edit retains quantity and cannot bypass current stock under a valid current review', async () => {
  psql(`SELECT public.set_inventory_level_available('${product}','${oat}','${site.locationId}',1,NULL);`);
  try {
    const flow = await begin(3), edit = await command(flow, 'Asha', oat), before = stored(flow), effects = business();
    const response = await send(flow, { line_edit: edit }); assert.equal(response.status, 409, response.text);
    assert.equal(response.json?.error?.code, 'INSUFFICIENT_INVENTORY', 'Must reach current stock branch, not pass through a masking stale-facts refusal');
    assert.deepEqual(stored(flow), before); assert.equal(business(), effects); assert.equal(receipts(flow), 0);
  } finally { psql(`SELECT public.set_inventory_level_available('${product}','${oat}','${site.locationId}',4,NULL);`); }
});
test('completed edit receipt remains recoverable after cart closure without reopening it', async () => {
  const flow = await begin(), edit = await command(flow); const response = await send(flow, { line_edit: edit }); assert.equal(response.status, 200, response.text);
  psql(`UPDATE carts SET status='abandoned' WHERE id='${flow.cart.id}' AND store_id='${site.siteId}';`);
  const before = stored(flow), effects = business(); const replay = await send(flow, { line_edit: edit }); assert.equal(replay.status, 200, replay.text);
  assert.equal(replay.json?.data?.status, 'abandoned'); assert.deepEqual(stored(flow), before); assert.equal(business(), effects); assert.equal(receipts(flow), 1);
});
test('atomic functions are service-only and aborted DROP preserves their current identities', () => {
  for (const functionName of [signature,writeSignature]) {
    for (const role of ['anon','authenticated','app_tenant']) assert.equal(psql(`SELECT has_function_privilege('${role}',${quote(functionName)},'EXECUTE');`), 'f');
    assert.equal(psql(`SELECT has_function_privilege('service_role',${quote(functionName)},'EXECUTE');`), 't');
    psql(`BEGIN; DROP FUNCTION ${functionName}; ROLLBACK;`); assert.equal(psql(`SELECT to_regprocedure(${quote(functionName)}) IS NOT NULL;`), 't');
  }
});
test('canonical buyer bind winning after generic owner read prevents that stale foreign write atomically', { timeout: 10000 }, async () => {
  const flow = await begin(1, false), before = stored(flow), effects = business();
  const other = seedBuyerAccount(psql, `race-${crypto.randomUUID().slice(0,12)}`); let release!: () => void, reached!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), entered = new Promise<void>(resolve => { reached = resolve; });
  const tap = tapRest(owned.restEnv().SUPABASE_URL, async (call, forward) => {
    if (call.resource === 'rpc/write_storefront_cart') { reached(); await gate; } return forward();
  });
  let writer: ReturnType<typeof send> | undefined;
  try {
    writer = send(flow, { expected_updated_at: flow.cart.updated_at, lines: [] }, await headers(other.id));
    await Promise.race([entered, new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error('Worker did not reach actual atomic writer')), 3000); timer.unref(); })]);
    const bound = await gateway.request(`/v1/storefront/${site.subdomain}/cart/${flow.cart.cart_token}/checkout-url`, { method: 'POST', headers: flow.headers }); assert.equal(bound.status, 200, bound.text);
    const boundCart = stored(flow); assert.deepEqual(boundCart.items, before.items, 'legitimate buyer binding must preserve every accepted line');
    release(); const response = await writer; assert.equal(response.status, 403, response.text); assert.equal(response.json?.error?.code, 'CART_OWNER_CONFLICT');
    assert.deepEqual(stored(flow), boundCart, 'stale foreign writer must have zero effect after the legitimate binding'); assert.equal(business(), effects);
  } finally { release(); tap.restore(); await writer; }
});

test('configured DELETE requires the acknowledged revision and cannot replay an old clear after its first acknowledgement', async () => {
  const flow=await begin(),before=stored(flow),effects=business();
  const path=`/v1/storefront/${site.subdomain}/cart/${flow.cart.cart_token}`;
  const unversioned=await gateway.request(path,{method:'DELETE',headers:flow.headers});
  assert.equal(unversioned.status,409,unversioned.text);assert.deepEqual(stored(flow),before);
  const target=path+'?'+new URLSearchParams({expected_updated_at:flow.cart.updated_at});
  const cleared=await gateway.request(target,{method:'DELETE',headers:flow.headers});
  assert.equal(cleared.status,200,cleared.text);assert.deepEqual(cleared.json?.data.lines,[]);
  const accepted=stored(flow);assert.equal(accepted.status,'active');
  const replay=await gateway.request(target,{method:'DELETE',headers:flow.headers});
  assert.equal(replay.status,409,replay.text);assert.deepEqual(stored(flow),accepted);assert.equal(business(),effects);
});

test('ordinary cart creation and acknowledged whole-cart quantity changes remain compatible', async () => {
  const ordinary=crypto.randomUUID();
  psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status,country_of_origin,metadata) VALUES('${ordinary}','${site.siteId}','${site.siteId}','Synthetic ordinary pencil','syn-${ordinary}',40,8,true,'active','India','{}');SELECT public.set_inventory_level_available('${ordinary}',NULL,'${site.locationId}',8,NULL);`);
  const added=await gateway.request(`/v1/storefront/${site.subdomain}/cart`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines:[{product_id:ordinary,quantity:1}]})});
  assert.equal(added.status,201,added.text);const cart=added.json!.data as Cart;
  const changed=await gateway.request(`/v1/storefront/${site.subdomain}/cart/${cart.cart_token}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({expected_updated_at:cart.updated_at,lines:[{product_id:ordinary,quantity:2}]})});
  assert.equal(changed.status,200,changed.text);assert.equal(changed.json?.data.lines[0].quantity,2);assert.equal(changed.json?.data.status,'active');
  const stale=await gateway.request(`/v1/storefront/${site.subdomain}/cart/${cart.cart_token}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({expected_updated_at:cart.updated_at,lines:[]})});
  assert.equal(stale.status,409,stale.text);
});


test('canonical395 paired DOWN/reapply preserves nonempty carts and committed receipts; unknown generation refuses', () => {
 const file=(kind:string)=>readFileSync(new URL('../../../../../database/supabase/'+kind+'/395_atomic_storefront_cart_edits'+(kind==='rollback'?'.rollback':'')+'.sql',import.meta.url),'utf8');
 const unwrap=(text:string)=>text.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
 const down=unwrap(file('rollback')),up=unwrap(file('migrations'));
 const snapshot=()=>psql("SELECT jsonb_build_object('carts',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM carts c),'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM idempotency_keys r))");
 const before=snapshot(),effects=business();
 assert.ok(Number(psql("SELECT count(*) FROM carts;"))>0);
 assert.ok(Number(psql("SELECT count(*) FROM idempotency_keys WHERE starts_with(scope,'cart.configured_line_edit:');"))>0);
 owned.script('BEGIN;'+down+up+'ROLLBACK;');
 assert.equal(snapshot(),before);
 assert.equal(business(),effects);
 const drift="ALTER FUNCTION "+signature+" SET search_path=public;";
 assert.match(owned.psqlScriptExpectError('BEGIN;'+drift+down+'ROLLBACK;'),/395 rollback refuses a changed cart writer generation/);
 assert.equal(snapshot(),before);
 assert.equal(business(),effects);
});
