#!/usr/bin/env node
// Seeds the shared "snaz" merchant fixture (see seed-snaz-fixture.sql for the full why/what).
// Idempotent -- safe to re-run any number of times against the same local database.
//
// This is a manual local-development seed for the developer's own stack. The gateway's database test suites do NOT use
// it: since P2-HERMETIC-GATEWAY-DB they build their own synthetic tenants in a database the executable-suite runner owns
// (services/api-gateway/src/__tests__/owned-db/), and never touch the developer's stack.
//
// Usage: node scripts/dev/seed-snaz-fixture.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CONTAINER = process.env.LETBUYY_LOCAL_SUPABASE_CONTAINER || 'supabase_db_letbuyy-newmac-20260926';
const here = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(here, 'seed-snaz-fixture.sql');

try {
    execFileSync('docker', ['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-c', 'SELECT 1'], { stdio: 'ignore', timeout: 5000 });
} catch {
    console.error(`seed-snaz-fixture: local Supabase Postgres container "${CONTAINER}" is not reachable -- is it running? (docker ps)`);
    process.exit(1);
}

const sql = readFileSync(sqlPath, 'utf8');
console.log(`seed-snaz-fixture: applying ${sqlPath} to ${CONTAINER}...`);
const output = execFileSync(
    'docker',
    ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8', timeout: 30000 },
);
console.log(output);
console.log('seed-snaz-fixture: done.');
