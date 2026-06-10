import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migration = fs.readFileSync(
  path.join(repoRoot, "database/supabase/migrations/163_d2_live_data_leak_rls.sql"),
  "utf8",
);

test("RT-1 through RT-9 live-data leak guard is enforced by the public-true validator", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/no-public-using-true-validator.mjs"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /No public USING true validator passed/);
});

const cases = [
  ["RT-1", "orders", "service_role_orders", "FOR ALL TO service_role"],
  ["RT-2", "orders", "orders_tenant_site_guc", "COALESCE(site_id, store_id) = public.current_site_id()"],
  ["RT-3", "product_variants", "product_variants_tenant_site_guc", "products.id = product_variants.product_id"],
  ["RT-4", "product_options", "product_options_tenant_site_guc", "products.id = product_options.product_id"],
  ["RT-5", "sites", "sites_tenant_site_guc", "id = public.current_site_id()"],
  ["RT-6", "store_customers", "store_customers_tenant_store_guc", "store_id = public.current_site_id()"],
  ["RT-7", "wishlists", "wishlists_tenant_store_guc", "store_id = public.current_site_id()"],
  ["RT-8", "billing_history", "billing_history_tenant_site_guc", "site_id = public.current_site_id()"],
  ["RT-9", "super_admin_allowlist", "super_admin_manage_allowlist", "WITH CHECK (public.is_super_admin())"],
];

for (const [id, table, policy, predicate] of cases) {
  test(`${id} ${table} policy denies anon or forged-tenant access`, () => {
    assert.match(migration, new RegExp(`-- ${id}\\b`));
    assert.match(migration, new RegExp(`CREATE POLICY ${policy} ON public\\.${table}`));
    assert.ok(migration.includes(predicate), `${policy} must contain ${predicate}`);
  });
}

test("D2 migration removes the public wishlist manage policies", () => {
  assert.match(migration, /DROP POLICY IF EXISTS "Anyone can manage their wishlists via API" ON public\.wishlists/);
  assert.match(migration, /DROP POLICY IF EXISTS "Store owners view wishlists" ON public\.wishlists/);
});
