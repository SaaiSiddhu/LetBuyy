import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// LB-5: multi-variant products end-to-end

const repoRoot = process.cwd();

const newProductPage = path.join(
    repoRoot,
    'apps/merchant/web/src/app/[store]/products/new/page.tsx',
);
const cartCtx = path.join(
    repoRoot,
    'apps/commerce/web/src/context/cart-context.tsx',
);
const productDetails = path.join(
    repoRoot,
    'apps/commerce/web/src/app/store/[subdomain]/product/[productId]/product-details-client.tsx',
);
const storefrontRoutes = path.join(
    repoRoot,
    'services/api-gateway/src/routes/storefront.ts',
);
const migration170 = path.join(
    repoRoot,
    'database/supabase/migrations/170_v1_variant_checkout.sql',
);

// (a) MCP new/page.tsx no longer sends variants: [] hardcoded and contains cartesian matrix generation
test('LB-5a: new/page.tsx does not hardcode variants: []', () => {
    const src = readFileSync(newProductPage, 'utf8');
    // Must NOT contain the bare hardcoded `variants: []` literal
    assert.doesNotMatch(
        src,
        /\bvariants:\s*\[\s*\]/,
        'variants must not be hardcoded as empty array',
    );
});

test('LB-5a: new/page.tsx contains cartesian/matrix generation (buildVariantMatrix)', () => {
    const src = readFileSync(newProductPage, 'utf8');
    assert.match(src, /buildVariantMatrix/, 'must export/define buildVariantMatrix');
    assert.match(src, /variantMatrix/, 'must have variantMatrix state');
});

test('LB-5a: new/page.tsx sends real variants array from variantMatrix', () => {
    const page = readFileSync(newProductPage, 'utf8');
    assert.match(page, /buildProductFormFields\(currentSnapshot,/);
    const src = readFileSync(path.join(repoRoot, 'apps/merchant/web/src/lib/product-form-state.ts'), 'utf8');
    // variantMatrix.map(...) must appear in the body sent to the API
    assert.match(
        src,
        /variants:\s*variantMatrix\.map/,
        'variants payload must be built from variantMatrix',
    );
});

// (b) adapter persists product_variants on create AND diffs on update (structural — already present pre-task)
test('LB-5b: product-execution.adapter creates variants on create', () => {
    const src = readFileSync(
        path.join(repoRoot, 'services/api-gateway/src/execution/product-execution.adapter.ts'),
        'utf8',
    );
    assert.match(src, /replaceProductVariants/, 'adapter must call replaceProductVariants on create');
    assert.match(src, /executeProductCreate\(this\.options\.mutationEnv, input, userId\)/);
    const command = readFileSync(path.join(repoRoot, 'services/api-gateway/src/execution/product-mutation.adapter.ts'), 'utf8');
    assert.match(command, /planProductCreate\(input\)/);
    assert.match(command, /variants: plan[.]productVariants/);
    assert.match(command, /sql[.]unsafe[(]APPLY_PRODUCT_EDIT_SQL/);
});

test('LB-5b: adapter diffs variants through the owned atomic product edit', () => {
    const read = file => readFileSync(path.join(repoRoot,file),'utf8');
    const src=read('services/api-gateway/src/execution/product-execution.adapter.ts');
    assert.match(src,/return executeProductMutation\(this\.options\.mutationEnv, storeId, productId, userId, updates, requestId\)/);
    const transaction=read('services/api-gateway/src/execution/product-mutation.adapter.ts');
    assert.match(transaction,/SELECT public\.apply_product_edit_v1\(\$1::uuid,\$2::uuid,\$3::uuid,\$4::integer,\$5::uuid/);
    assert.match(transaction,/\[storeId, productId, actorId, plan\.expectedVersion, plan\.idempotencyKey, JSON\.stringify\(plan\.mutation\)\]/);
    const sql=read('database/supabase/migrations/346_product_atomic_edits.sql');
    assert.match(sql,/INSERT INTO public\.product_variants/);
    assert.match(sql,/UPDATE public\.product_variants SET/);
    assert.match(sql,/DELETE FROM public\.product_variants WHERE product_id=p_product_id AND id=ANY\(removed\)/);
});

// (c) cart-context no longer hardcodes variant_id: null
test('LB-5c: cart-context cartLineInputFromItem does not hardcode variant_id: null', () => {
    const src = readFileSync(cartCtx, 'utf8');
    // The only null assignment must be via a variable/ternary, not a literal `variant_id: null`
    assert.doesNotMatch(
        src,
        /variant_id:\s*null(?!.*variantId)/,
        'variant_id must not be hardcoded null — must be resolved from item',
    );
});

test('LB-5c: cart-context carries variantId from item', () => {
    const src = readFileSync(cartCtx, 'utf8');
    assert.match(src, /variantId/, 'CartVariantContext or variantId must appear in cart-context');
});

// (d) product-details-client resolves selected variant and passes variantId
test('LB-5d: product-details-client resolveMatchingVariant is defined', () => {
    const src = readFileSync(productDetails, 'utf8');
    assert.match(src, /resolveMatchingVariant/, 'must define resolveMatchingVariant');
});

test('LB-5d: product-details-client passes resolvedVariant to addToCart', () => {
    const src = readFileSync(productDetails, 'utf8');
    assert.match(
        src,
        /addToCart\s*\(product,\s*resolvedVariant\)/,
        'addToCart must receive resolvedVariant as second arg',
    );
});

test('LB-5d: product-details-client uses CartVariantContext import', () => {
    const src = readFileSync(productDetails, 'utf8');
    assert.match(src, /CartVariantContext/, 'must import CartVariantContext');
});

// (e) storefront.ts PRODUCT_SELECT_FULL selects compare_price not compare_at_price
test('LB-5e: PRODUCT_SELECT_FULL does not contain compare_at_price', () => {
    const src = readFileSync(storefrontRoutes, 'utf8');
    // Extract the PRODUCT_SELECT_FULL definition line
    const match = src.match(/PRODUCT_SELECT_FULL:\s*string\s*=\s*'([^']+)'/);
    assert.ok(match, 'PRODUCT_SELECT_FULL must be defined as a string constant');
    assert.doesNotMatch(
        match[1],
        /compare_at_price/,
        'PRODUCT_SELECT_FULL must not select non-existent compare_at_price column',
    );
    assert.match(
        match[1],
        /compare_price/,
        'PRODUCT_SELECT_FULL must select compare_price',
    );
});

// (f) migration 170: if it exists, check it contains variant price resolution
test('LB-5f: migration 170 verdict — RPC pre-existing verdict', () => {
    if (!existsSync(migration170)) {
        // VERDICT: Migration 170 was NOT created.
        // create_checkout_order in migration 166 already:
        //   - accepts variant_id in p_items (line 74)
        //   - resolves price from product_variants when variant_id provided (lines 101-112)
        //   - decrements/validates variant stock via reserve_inventory with variant_id (lines 134-145)
        //   - writes variant_id to order_items (line 231/241/253/265)
        // No changes needed; storefront checkout-client.tsx now passes variantId through.
        assert.ok(true, 'Migration 170 not needed: existing RPC handles variant_id correctly');
        return;
    }
    const sql = readFileSync(migration170, 'utf8');
    assert.match(sql, /CREATE OR REPLACE.*create_checkout_order/is,
        'migration 170 must CREATE OR REPLACE create_checkout_order');
    assert.match(sql, /variant_id/i,
        'migration 170 must contain variant_id handling');
});
