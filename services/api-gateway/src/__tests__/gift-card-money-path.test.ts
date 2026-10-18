import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// T15 (CAP-C50): the gift-card subsystem had never run a single operation. W0 found the real
// cause live (executed check_gift_card_balance / issue_gift_card / create_checkout_order's
// gift-card branch directly): all three called the unqualified pgcrypto function `digest()`
// under `SET search_path TO 'public'`, but pgcrypto is installed in the `extensions` schema on
// this database -- identical defect class to T14's issue_gst_invoice bug. Migration 215
// qualifies each call site as `extensions.digest(...)` (narrower than widening the whole
// function's search_path, matching T14's precedent).
//
// This file is the part of that suite that needs no database: a source-level check of migration 215. The real-database
// proof (issue, ledger-projected balance, tender redemption, append-only refund restore, cap, concurrency, replay and
// cross-tenant refusal) lives in owned-db/gift-card-money-path.test.ts and runs only in the owned database lane
// (`pnpm --filter @letbuyy/api-gateway run test:db`), against a database the runner created for it.

const repoRoot = process.cwd();
const migration215Source = readFileSync(
    join(repoRoot, 'database/supabase/migrations/215_fix_gift_card_digest_search_path.sql'),
    'utf8',
);

test('migration 215 qualifies every gift-card digest() call to extensions.digest, and leaves the two unaffected functions alone', () => {
    assert.match(migration215Source, /CREATE OR REPLACE FUNCTION public\.check_gift_card_balance/);
    assert.match(migration215Source, /CREATE OR REPLACE FUNCTION public\.issue_gift_card/);
    assert.match(migration215Source, /CREATE OR REPLACE FUNCTION public\.create_checkout_order/);
    assert.match(migration215Source, /extensions\.digest\(p_code, 'sha256'\)/);
    assert.match(migration215Source, /extensions\.digest\(p_gift_card_code, 'sha256'\)/);
    // The whole point of qualifying (not widening) is that no other name resolution in these
    // functions changes -- so no bare `digest(` call may remain anywhere in the new bodies
    // (excluding header-comment lines that intentionally quote the OLD broken call for context).
    const codeOnly = migration215Source
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n');
    const bareDigestCalls = (codeOnly.match(/[^.]digest\(/g) || []).length;
    assert.equal(bareDigestCalls, 0, 'every digest() call must be schema-qualified after this migration');
});
