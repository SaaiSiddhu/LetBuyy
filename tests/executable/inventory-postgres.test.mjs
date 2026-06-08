import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';
const foundationSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/139_executable_foundation_ledger_core.sql'),
  'utf8',
);
const inventorySql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/141_executable_inventory_reservations.sql'),
  'utf8',
);
const inventoryRollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/141_executable_inventory_reservations.rollback.sql'),
  'utf8',
);
const foundationRollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/139_executable_foundation_ledger_core.rollback.sql'),
  'utf8',
);

function psql(sql, options = {}) {
  return execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { input: sql, encoding: 'utf8', ...options },
  ).trim();
}

async function psqlAsync(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', [
      'exec',
      '-i',
      containerName,
      'psql',
      '-U',
      'postgres',
      '-d',
      databaseName,
      '-v',
      'ON_ERROR_STOP=1',
      '-qAt',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `psql exited with ${code}`));
      }
    });
    child.stdin.end(sql);
  });
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function resetDatabase() {
  psql(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT USAGE ON SCHEMA public TO public;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE OR REPLACE FUNCTION public.update_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;
    CREATE OR REPLACE FUNCTION public.increment_version()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.version = OLD.version THEN
        NEW.version = OLD.version + 1;
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TABLE public.sites (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.products (
      id uuid PRIMARY KEY,
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      name text NOT NULL DEFAULT 'Inventory product',
      deleted_at timestamptz
    );
    CREATE TABLE public.inventory_locations (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      name text NOT NULL,
      address jsonb,
      is_default boolean DEFAULT false,
      status text DEFAULT 'active',
      created_at timestamptz DEFAULT now(),
      deleted_at timestamptz,
      created_by uuid,
      updated_by uuid
    );
    CREATE TABLE public.inventory_levels (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
      variant_id uuid,
      location_id uuid NOT NULL REFERENCES public.inventory_locations(id) ON DELETE CASCADE,
      available integer NOT NULL DEFAULT 0,
      reserved integer NOT NULL DEFAULT 0,
      incoming integer NOT NULL DEFAULT 0,
      updated_at timestamptz DEFAULT now(),
      on_hand_quantity integer,
      available_quantity integer,
      committed_quantity integer NOT NULL DEFAULT 0,
      unavailable_quantity integer NOT NULL DEFAULT 0,
      incoming_quantity integer,
      reserved_quantity integer,
      safety_stock_quantity integer NOT NULL DEFAULT 0
    );
    CREATE TABLE public.inventory_reservations (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
      variant_id uuid,
      location_id uuid NOT NULL REFERENCES public.inventory_locations(id) ON DELETE CASCADE,
      order_id uuid,
      quantity integer NOT NULL CHECK (quantity > 0),
      status text NOT NULL DEFAULT 'active',
      idempotency_key text UNIQUE,
      expires_at timestamptz NOT NULL DEFAULT now() + interval '20 minutes',
      committed_at timestamptz,
      released_at timestamptz,
      release_reason text,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
  `);
  psql(foundationSql);
  psql(inventorySql);
}

function reserveSql({ siteId, productId, locationId, key, quantity = 1, ttl = 1200 }) {
  return `
    BEGIN;
    SELECT public.set_current_site_id(${sqlString(siteId)}::uuid);
    SELECT public.reserve_inventory(
      ${sqlString(siteId)}::uuid,
      ${sqlString(productId)}::uuid,
      NULL,
      ${sqlString(locationId)}::uuid,
      ${quantity},
      ${ttl},
      ${sqlString(key)},
      NULL,
      ${sqlString(`req-${key}`)}
    );
    COMMIT;
  `;
}

test('Task 006 inventory reservations prevent oversell and support commit, release, and expiry on real Postgres', async () => {
  resetDatabase();
  const siteId = '11111111-1111-4111-8111-111111111111';
  const productId = '22222222-2222-4222-8222-222222222222';
  const locationId = '33333333-3333-4333-8333-333333333333';

  psql(`
    INSERT INTO public.sites (id, name) VALUES (${sqlString(siteId)}::uuid, 'Inventory Store');
    INSERT INTO public.products (id, store_id, name) VALUES (${sqlString(productId)}::uuid, ${sqlString(siteId)}::uuid, 'Last unit');
    INSERT INTO public.inventory_locations (id, store_id, name) VALUES (${sqlString(locationId)}::uuid, ${sqlString(siteId)}::uuid, 'Default');
    INSERT INTO public.inventory_levels (store_id, product_id, location_id, available, reserved, available_quantity, reserved_quantity)
    VALUES (${sqlString(siteId)}::uuid, ${sqlString(productId)}::uuid, ${sqlString(locationId)}::uuid, 1, 0, 1, 0);
  `);

  const attempts = await Promise.allSettled([
    psqlAsync(reserveSql({ siteId, productId, locationId, key: 'reserve:last-unit:a' })),
    psqlAsync(reserveSql({ siteId, productId, locationId, key: 'reserve:last-unit:b' })),
  ]);
  assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === 'rejected').length, 1);
  assert.match(
    String(attempts.find((attempt) => attempt.status === 'rejected')?.reason?.message || ''),
    /INSUFFICIENT_INVENTORY/,
  );
  assert.equal(
    psql(`SELECT available || ':' || reserved || ':' || version FROM public.inventory_levels WHERE product_id = ${sqlString(productId)}::uuid;`),
    '1:1:2',
  );

  const reservationId = psql(`SELECT id FROM public.inventory_reservations WHERE status = 'active' LIMIT 1;`);
  assert.match(reservationId, /^[0-9a-f-]{36}$/);

  const replay = psql(reserveSql({ siteId, productId, locationId, key: 'reserve:last-unit:a' }));
  assert.match(replay, /"idempotent" : true|"idempotent": true/);
  assert.equal(psql('SELECT count(*) FROM public.inventory_reservations;'), '1');

  psql(`
    BEGIN;
    SELECT public.set_current_site_id(${sqlString(siteId)}::uuid);
    SELECT public.commit_inventory_reservation(${sqlString(siteId)}::uuid, ${sqlString(reservationId)}::uuid, 'commit:last-unit:a', NULL, 'req-commit');
    COMMIT;
  `);
  assert.equal(
    psql(`SELECT available || ':' || reserved || ':' || committed_quantity FROM public.inventory_levels WHERE product_id = ${sqlString(productId)}::uuid;`),
    '0:0:1',
  );

  psql(`
    UPDATE public.inventory_levels
       SET available = 2, reserved = 0, available_quantity = 2, reserved_quantity = 0
     WHERE product_id = ${sqlString(productId)}::uuid;
  `);
  psql(reserveSql({ siteId, productId, locationId, key: 'reserve:release:a' }));
  const releaseReservationId = psql("SELECT id FROM public.inventory_reservations WHERE idempotency_key = 'reserve:release:a';");
  psql(`
    BEGIN;
    SELECT public.set_current_site_id(${sqlString(siteId)}::uuid);
    SELECT public.release_inventory_reservation(${sqlString(siteId)}::uuid, ${sqlString(releaseReservationId)}::uuid, 'release:release:a', 'buyer_removed_line', NULL, 'req-release');
    COMMIT;
  `);
  assert.equal(
    psql(`SELECT available || ':' || reserved FROM public.inventory_levels WHERE product_id = ${sqlString(productId)}::uuid;`),
    '2:0',
  );

  psql(reserveSql({ siteId, productId, locationId, key: 'reserve:expire:a' }));
  psql("UPDATE public.inventory_reservations SET expires_at = now() - interval '1 minute' WHERE idempotency_key = 'reserve:expire:a';");
  assert.equal(psql('SELECT public.expire_inventory_reservations(10, \'req-expire\');'), '1');
  assert.equal(psql("SELECT status FROM public.inventory_reservations WHERE idempotency_key = 'reserve:expire:a';"), 'expired');

  psql(inventoryRollbackSql);
  psql(foundationRollbackSql);
  assert.equal(psql("SELECT to_regprocedure('public.reserve_inventory(uuid,uuid,uuid,uuid,integer,integer,text,uuid,text)') IS NULL;"), 't');
});
