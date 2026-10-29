// Canonical SQL authority and real immutable facts in an owned disposable database.
// No provider transaction, production records or injected authorization context.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant, seedSyntheticProductInventory } from './synthetic-tenant';

const owned = requireOwnedDatabase();
let ordinal = 0;
function fixture(price = 1000, inclusive = false) {
  const site = newSyntheticTenant(`gst-authority-${++ordinal}`);
  seedSyntheticTenant(owned.psql, site, { gst: true });
  const product = randomUUID();
  owned.psql(`UPDATE sites SET tax_inclusive=${inclusive} WHERE id='${site.siteId}';
    INSERT INTO products(id,store_id,site_id,name,sku,price,stock,is_active,status)
    VALUES('${product}','${site.siteId}','${site.siteId}','Synthetic taxed product','SYN-${product}',${price},30,true,'active');`);
  seedSyntheticProductInventory(owned.psql, site.siteId);
  const items = JSON.stringify([{ product_id: product, quantity: 1 }]);
  const address = JSON.stringify({ line1: 'Synthetic Road', city: 'Bengaluru', state: 'Karnataka', state_code: '29', zip: '560001', country: 'IN' });
  const rate = (percent = 18, extra = '') => owned.psql(`INSERT INTO tax_rates(store_id,name,rate,country,is_active,is_shipping,priority,applies_to${extra ? ',hsn_code' : ''})
    VALUES('${site.siteId}','Synthetic GST',${percent}/100.0,'IN',true,false,10,'products'${extra ? `,'${extra}'` : ''});`);
  const quote = (shipping = 'NULL') => JSON.parse(owned.psql(`SELECT quote_storefront_checkout_totals('${site.siteId}','${items}','${address}',${shipping},NULL,NULL);`));
  const order = (key = randomUUID()) => JSON.parse(owned.psql(`SELECT create_checkout_order('${site.siteId}',
    'Synthetic buyer','syn-${key}@example.invalid','9000000001','${address}','${items}','cod',NULL,NULL,NULL,'standard',
    '${key}',NULL,'syn-tax-${key}',NULL,999,'33','[]');`));
  return { site, product, items, address, rate, quote, order };
}

test('fresh schema reverses and reapplies before use without losing predecessor routines', () => {
  for (const file of ['rollback/412_invoice_checkout_fact_parity.rollback.sql','rollback/411_authoritative_checkout_gst.rollback.sql',
    'migrations/411_authoritative_checkout_gst.sql','migrations/412_invoice_checkout_fact_parity.sql']) {
    owned.script(readFileSync(new URL(`../../../../../database/supabase/${file}`,import.meta.url),'utf8'));
  }
  assert.equal(owned.psql("SELECT count(*) FROM information_schema.columns WHERE table_name='orders' AND column_name='tax_snapshot';"),'1');
});

test('review and canonical order use actual configured GST; supplied tax cannot override it', () => {
  const f = fixture(); f.rate(); const quote = f.quote();
  assert.equal(quote.tax_minor, 18000); assert.equal(quote.total_minor, 118000);
  assert.deepEqual(quote.components.map((c: { title: string; rate_percent: number; amount_minor: number }) => [c.title, c.rate_percent, c.amount_minor]),
    [['CGST', 9, 9000], ['SGST', 9, 9000]]);
  const order = f.order(); assert.equal(Number(order.tax), 180); assert.equal(Number(order.total), 1180);
  const saved = JSON.parse(owned.psql(`SELECT tax_snapshot FROM orders WHERE id='${order.id}';`));
  assert.equal(saved.fingerprint, quote.fingerprint);
  assert.equal(owned.psql(`SELECT place_of_supply_state FROM orders WHERE id='${order.id}';`), '29');
  assert.match(owned.psqlExpectError(`UPDATE orders SET tax_snapshot='{}' WHERE id='${order.id}';`), /immutable/);
});

test('inclusive quote extracts tax without adding it again; replay preserves the committed quote', () => {
  const f = fixture(1180, true); f.rate(); const q = f.quote();
  assert.equal(q.tax_minor, 18000); assert.equal(q.added_tax_minor, 0); assert.equal(q.total_minor, 118000);
  const key = randomUUID(); const first = f.order(key);
  assert.equal(Number(first.total), 1180);
  owned.psql(`UPDATE tax_rates SET rate=0.05 WHERE store_id='${f.site.siteId}';`);
  const replay = f.order(key); assert.equal(replay.id, first.id); assert.equal(Number(replay.tax), 180);
});

test('missing applicable GST refuses atomically instead of silently creating a zero-tax order', () => {
  const f = fixture();
  assert.match(owned.psqlExpectError(`SELECT quote_storefront_checkout_totals('${f.site.siteId}','${f.items}','${f.address}',NULL,NULL,NULL);`), /GST_RATE_REQUIRED/);
  assert.match(owned.psqlExpectError(`SELECT create_checkout_order('${f.site.siteId}','Synthetic buyer','syn-missing@example.invalid',NULL,
    '${f.address}','${f.items}','cod',NULL,NULL,NULL,'standard','${randomUUID()}');`), /GST_RATE_REQUIRED/);
  assert.equal(owned.psql(`SELECT count(*) FROM orders WHERE store_id='${f.site.siteId}';`), '0');
  assert.equal(owned.psql(`SELECT reserved FROM inventory_levels WHERE store_id='${f.site.siteId}';`), '0');
});

test('matching HSN priority chooses the highest saved rate and state scope is enforced', () => {
  const f = fixture(); f.rate(18, '6109');
  owned.psql(`UPDATE products SET hsn_code='6109' WHERE id='${f.product}';
    INSERT INTO tax_rates(store_id,name,rate,country,hsn_code,priority,is_active,is_shipping,applies_to)
    VALUES('${f.site.siteId}','Synthetic lower priority',0.05,'IN','6109',1,true,false,'products');`);
  assert.equal(f.quote().tax_minor, 18000);
  owned.psql(`UPDATE tax_rates SET state='33' WHERE store_id='${f.site.siteId}';`);
  assert.match(owned.psqlExpectError(`SELECT quote_storefront_checkout_totals('${f.site.siteId}','${f.items}','${f.address}',NULL,NULL,NULL);`), /GST_RATE_REQUIRED/);
});

function delivery(f: ReturnType<typeof fixture>, type = 'flat') {
  const zone = randomUUID(), rate = randomUUID();
  owned.psql(`INSERT INTO shipping_zones(id,store_id,site_id,name,countries,states,zip_codes,cod_enabled)
    VALUES('${zone}','${f.site.siteId}','${f.site.siteId}','Synthetic delivery',ARRAY['IN'],ARRAY['29'],ARRAY['560001'],true);
    INSERT INTO shipping_rates(id,zone_id,site_id,name,type,price,cod_enabled,is_active,estimated_days_min,estimated_days_max)
    VALUES('${rate}','${zone}','${f.site.siteId}','Synthetic selected rate','${type}',100,true,true,0,0);`);
  return { zone, rate };
}

test('reviewed quote binds final order atomically and committed replay survives retirement', () => {
  const f = fixture(); f.rate(); const { rate } = delivery(f); const quote = f.quote(`'${rate}'`);
  const command = { p_customer_name: 'Synthetic buyer', p_customer_email: 'syn-reviewed@example.invalid', p_customer_phone: '9000000001',
    p_shipping_address: JSON.parse(f.address), p_items: JSON.parse(f.items), p_payment_method: 'cod', p_shipping_method: 'standard',
    p_idempotency_key: randomUUID(), p_shipping_rate_id: rate, p_expected_shipping_amount: 100 };
  const sql = (fingerprint: string) => `SELECT create_storefront_checkout_order_with_quote('${f.site.siteId}','${JSON.stringify(command)}','${fingerprint}');`;
  assert.match(owned.psqlExpectError(sql('0'.repeat(64))), /CHECKOUT_QUOTE_CHANGED/);
  assert.equal(owned.psql(`SELECT count(*) FROM orders WHERE store_id='${f.site.siteId}';`), '0');
  assert.equal(owned.psql(`SELECT reserved FROM inventory_levels WHERE store_id='${f.site.siteId}';`), '0');
  const order = JSON.parse(owned.psql(sql(quote.fingerprint)));
  assert.equal(Number(order.total), 1280);
  owned.psql(`UPDATE shipping_rates SET is_active=false WHERE id='${rate}';`);
  const replay = JSON.parse(owned.psql(sql(quote.fingerprint)));
  assert.equal(replay.id, order.id);
  assert.equal(owned.psql(`SELECT count(*) FROM gst_invoices WHERE site_id='${f.site.siteId}';`), '1');
});

test('weighted delivery enforces product weight, exact address, COD and zero-day ETA at review', () => {
  const f = fixture(); f.rate(); const { rate, zone } = delivery(f, 'weight_based');
  owned.psql(`UPDATE shipping_rates SET min_weight_grams=500,max_weight_grams=1000 WHERE id='${rate}';
    UPDATE products SET weight=0.75,weight_unit='kg' WHERE id='${f.product}';`);
  const options = () => JSON.parse(owned.psql(`SELECT list_storefront_shipping_options('${f.site.siteId}','${f.items}','${f.address}');`));
  assert.equal(options()[0].amount_minor,10000); assert.equal(options()[0].estimated_days_min,0);
  owned.psql(`UPDATE shipping_zones SET cod_enabled=false WHERE id='${zone}';`);
  assert.equal(options()[0].cod_available,false);
  assert.match(owned.psqlExpectError(`SELECT resolve_storefront_shipping_v1('${f.site.siteId}','${f.items}','${f.address}','${rate}',true);`),/CHECKOUT_COD_UNAVAILABLE/);
  owned.psql(`UPDATE products SET weight=2 WHERE id='${f.product}';`);
  assert.deepEqual(options(),[]);
  owned.psql(`UPDATE products SET weight=NULL WHERE id='${f.product}';`);
  assert.match(owned.psqlExpectError(`SELECT list_storefront_shipping_options('${f.site.siteId}','${f.items}','${f.address}');`),/WEIGHT_REQUIRED/);
});

test('inclusive products and exclusive shipping GST produce an invoice equal to the gross supply total', () => {
  const f = fixture(1180,true); f.rate(); const { rate } = delivery(f);
  owned.psql(`INSERT INTO tax_rates(store_id,name,rate,country,is_active,is_shipping,priority,applies_to)
    VALUES('${f.site.siteId}','Synthetic delivery GST',0.18,'IN',true,true,10,'shipping');`);
  const quote = f.quote(`'${rate}'`);
  assert.equal(quote.included_tax_minor,18000); assert.equal(quote.added_tax_minor,1800); assert.equal(quote.total_minor,129800);
  const order = JSON.parse(owned.psql(`SELECT create_checkout_order('${f.site.siteId}','Synthetic buyer','syn-invoice@example.invalid',NULL,
    '${f.address}','${f.items}','cod',NULL,NULL,NULL,'standard','${randomUUID()}',NULL,NULL,'${rate}');`));
  const invoice = JSON.parse(owned.psql(`SELECT to_jsonb(i) FROM gst_invoices i WHERE order_id='${order.id}';`));
  assert.equal(invoice.total_amount_minor,129800); assert.equal(invoice.tax_amount_minor,19800); assert.equal(invoice.taxable_amount_minor,110000);
  assert.equal(invoice.lines.length,2); assert.equal(invoice.lines[0].tax_amount_minor,18000);
  assert.equal(invoice.lines.reduce((sum: number,line: { total_amount_minor: number }) => sum+line.total_amount_minor,0),invoice.total_amount_minor);
});

test('discount remainder allocation preserves every paise across lines with different HSN rates', () => {
  const f = fixture();
  const lines = JSON.stringify([
    { ordinal: 1, product_id: randomUUID(), amount_minor: 1, charge_tax: false },
    { ordinal: 2, product_id: randomUUID(), amount_minor: 1, charge_tax: false },
    { ordinal: 3, product_id: randomUUID(), amount_minor: 1, charge_tax: false },
  ]);
  const q = JSON.parse(owned.psql(`SELECT resolve_checkout_gst_v1('${f.site.siteId}','${lines}','${f.address}',1,0,0);`));
  assert.deepEqual(q.lines.map((line: { discount_minor: number }) => line.discount_minor),[1,0,0]);
  assert.equal(q.total_minor,2); assert.equal(q.discount_minor,1);
});

test('ambiguous equal-scope rates are a setup refusal, and interstate uses IGST', () => {
  const f=fixture();f.rate();
  const address=JSON.stringify({...JSON.parse(f.address),state:'Tamil Nadu',state_code:'33'});
  const q=JSON.parse(owned.psql(`SELECT quote_storefront_checkout_totals('${f.site.siteId}','${f.items}','${address}',NULL,NULL,NULL);`));
  assert.deepEqual(q.components.map((c:{title:string})=>c.title),['IGST']);
  owned.psql(`INSERT INTO tax_rates(store_id,name,rate,country,is_active,is_shipping,priority,applies_to) VALUES('${f.site.siteId}','Synthetic conflict',0.05,'IN',true,false,10,'products');`);
  assert.match(owned.psqlExpectError(`SELECT quote_storefront_checkout_totals('${f.site.siteId}','${f.items}','${address}',NULL,NULL,NULL);`),/GST_RATE_AMBIGUOUS/);
});

test('canonical HSN schedules are effective-dated and scoped to the supplying site', () => {
  const f=fixture(), other=fixture();
  owned.psql(`UPDATE products SET hsn_code='6109' WHERE id='${f.product}';
    INSERT INTO hsn_rates(site_id,hsn_code,gst_rate_bps,effective_from,effective_to)
    VALUES('${f.site.siteId}','6109',500,CURRENT_DATE-20,CURRENT_DATE-1),
      ('${other.site.siteId}','6109',1200,CURRENT_DATE-1,NULL);`);
  assert.match(owned.psqlExpectError(`SELECT quote_storefront_checkout_totals('${f.site.siteId}','${f.items}','${f.address}',NULL,NULL,NULL);`),/GST_RATE_REQUIRED/);
  owned.psql(`INSERT INTO hsn_rates(site_id,hsn_code,gst_rate_bps,effective_from)
    VALUES('${f.site.siteId}','6109',1800,CURRENT_DATE);`);
  const q=f.quote();assert.equal(q.tax_minor,18000);assert.ok(q.lines[0].hsn_rate_id);
  assert.equal(q.lines[0].tax_rate_id,null);
  const saved=f.order();assert.equal(Number(saved.tax),180);
});

test('registered supplier identity must agree with its GST state and contain an invoice address',()=>{
 const f=fixture();f.rate();
 owned.psql(`UPDATE sites SET gst_state_code='33' WHERE id='${f.site.siteId}';`);
 const request=`SELECT quote_storefront_checkout_totals('${f.site.siteId}','${f.items}','${f.address}',NULL,NULL,NULL);`;
 assert.match(owned.psqlExpectError(request),/GST_SUPPLIER_DETAILS_REQUIRED/);
 owned.psql(`UPDATE sites SET gst_state_code='29',invoice_address='{}' WHERE id='${f.site.siteId}';`);
 assert.match(owned.psqlExpectError(request),/GST_SUPPLIER_DETAILS_REQUIRED/);
 assert.equal(owned.psql(`SELECT count(*) FROM orders WHERE store_id='${f.site.siteId}';`),'0');
});
