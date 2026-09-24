// APPID-SEC1 — every SECURITY DEFINER function a migration creates after 256 revokes EXECUTE from
// PUBLIC, anon and authenticated BY NAME.
//
// WHY. A new function is executable by PUBLIC (PostgreSQL's default) and, under Supabase's default
// privileges, by anon and authenticated through named grants. A SECURITY DEFINER function runs as its
// owner and usually takes the ids it acts on as parameters, trusting its caller: exactly what the Data
// API must never reach. Migration 256 closed the 158 that were open and removed the named default grant;
// PostgreSQL's grant to PUBLIC cannot be removed per schema, so this ratchet makes each new definer
// function close itself. tests/executable/definer-function-api-roles-postgres.test.mjs proves the
// behaviour on a real database; this file stops the next migration from reopening it.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const migrationsDir = join(repoRoot, 'database/supabase/migrations');
const RATCHET_FROM_EXCLUSIVE = 256;

const number = (name) => parseInt(name, 10);
const stripSqlComments = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');

// Names of functions created with SECURITY DEFINER. The header runs from CREATE to the body's opening
// dollar quote, which is where SECURITY DEFINER has to appear.
export function definerFunctions(sql) {
    const source = stripSqlComments(sql);
    const names = [];
    const pattern = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-z0-9_]+)\s*\(([\s\S]*?)\bAS\s+\$[a-z_]*\$/gi;
    let match;
    while ((match = pattern.exec(source))) {
        if (/\bSECURITY\s+DEFINER\b/i.test(match[0])) names.push(match[1]);
    }
    return [...new Set(names)];
}

// The roles a migration revokes EXECUTE (or ALL) from, for one function, across every REVOKE naming it.
export function revokedRoles(sql, name) {
    const source = stripSqlComments(sql);
    const pattern = new RegExp(`REVOKE\\s+(?:ALL(?:\\s+PRIVILEGES)?|EXECUTE)\\s+ON\\s+FUNCTION\\s+public\\.${name}\\b[^;]*?\\bFROM\\s+([^;]+);`, 'gi');
    const roles = new Set();
    let match;
    while ((match = pattern.exec(source))) {
        for (const role of match[1].split(',')) roles.add(role.trim().toLowerCase());
    }
    return roles;
}

export function offenders(sql) {
    return definerFunctions(sql).filter((name) => {
        const roles = revokedRoles(sql, name);
        return !['public', 'anon', 'authenticated'].every((role) => roles.has(role));
    });
}

test('the check sees definer functions, and 255 (which revokes by name) passes it', () => {
    const sql255 = readFileSync(join(migrationsDir, '255_buyer_verified_ownership_links.sql'), 'utf8');
    const found = definerFunctions(sql255);
    for (const name of ['link_buyer_store_customer', 'claim_buyer_orders', 'request_order_return']) {
        assert.ok(found.includes(name), `${name} must be detected as SECURITY DEFINER`);
    }
    assert.ok(!found.includes('buyer_accounts_stamp_email_verified_at'), 'an invoker trigger function is not a definer function');
    assert.deepEqual(offenders(sql255), []);
});

test('a definer function closed only to PUBLIC is an offender', () => {
    const synthetic = `
      CREATE OR REPLACE FUNCTION public.mint_things(p_site uuid) RETURNS void
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN NULL; END; $$;
      REVOKE ALL ON FUNCTION public.mint_things(uuid) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION public.mint_things(uuid) TO service_role;`;
    assert.deepEqual(offenders(synthetic), ['mint_things']);
    assert.deepEqual(offenders(`${synthetic}\nREVOKE ALL ON FUNCTION public.mint_things(uuid) FROM anon, authenticated;`), []);
});

test('every migration after 256 closes its definer functions to PUBLIC, anon and authenticated by name', () => {
    // Stated plainly: with the ratchet at 256 nothing follows it yet, so this passes vacuously today.
    // The two tests above are what keep the check from being decoration.
    const found = [];
    for (const name of readdirSync(migrationsDir).filter((n) => n.endsWith('.sql'))) {
        if (number(name) <= RATCHET_FROM_EXCLUSIVE) continue;
        for (const fn of offenders(readFileSync(join(migrationsDir, name), 'utf8'))) found.push(`${name}: public.${fn}`);
    }
    assert.deepEqual(found, [], 'Add `REVOKE ALL ON FUNCTION public.<name>(<args>) FROM PUBLIC, anon, authenticated;` and grant only the backend roles that call it.');
});
