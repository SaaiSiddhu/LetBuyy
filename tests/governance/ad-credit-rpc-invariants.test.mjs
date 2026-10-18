// The lineage guard for the two ad-credit money RPCs.
//
// WHY THIS EXISTS, and why it is written BEFORE either function is redefined. `create_checkout_order`
// has been rewritten eight times, and migration 218 exists solely to restore an idempotency advisory
// lock that 213 and 215 silently dropped — the fix was lost, shipped, and only found later, twice,
// with nothing failing either time. `record_ad_credit_purchase` and `allocate_ad_campaign_budget`
// are about to get their SECOND definition (238's tenant fence). This file pins what 232 put in
// them, against WHATEVER the live definition is, so the redefinition that drops one fails here.
//
// It reads the LATEST migration defining each function rather than a fixed file: pinning 232 would
// make the guard stale the moment 238 lands, which is exactly when it is needed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const migrationsDir = join(root, 'database/supabase/migrations');

function numericPrefix(name) {
    const m = /^(\d+)/.exec(name);
    return m ? Number(m[1]) : -1;
}

function liveDefinition(functionName) {
    const marker = `CREATE OR REPLACE FUNCTION public.${functionName}`;
    const defining = readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .filter((f) => readFileSync(join(migrationsDir, f), 'utf8').includes(marker))
        .sort((a, b) => numericPrefix(a) - numericPrefix(b));
    assert.ok(defining.length > 0, `${functionName} must be defined by a tracked migration`);

    const file = defining[defining.length - 1];
    const source = readFileSync(join(migrationsDir, file), 'utf8');
    const start = source.indexOf(marker);
    // The body is dollar-quoted and the tag can vary between migrations, so the terminator is matched
    // as any dollar-tag rather than a literal `$$;` — matching only `$$;` reads to end-of-file when a
    // later author uses `$function$`, which is the difference between guarding a definition and
    // guarding a whole migration.
    const rest = source.slice(start);
    const terminator = /\n\s*\$[A-Za-z_]*\$\s*;/.exec(rest);
    assert.ok(terminator, `${file} should contain a complete, dollar-quoted ${functionName}`);
    // Comments stripped: both functions document the very things asserted below, so an assertion that
    // read their prose would pass on a comment about a deleted guard.
    return { file, code: rest.slice(0, terminator.index).replace(/--[^\n]*/g, ' ') };
}

// Replay guards below require the payload conflict check added by 291 before
// returning the stored entry. A character-distance cap misclassified that stronger
// guard as absent. Both approved fixed search paths exclude caller-controlled schemas.
// Each entry: what it protects, and why losing it is not cosmetic.
const INVARIANTS = {
    record_ad_credit_purchase: [
        {
            what: 'the idempotency advisory lock on the ad-credit seed, taken BEFORE the existence check',
            pattern: /pg_advisory_xact_lock\(hashtextextended\(p_site_id::text \|\| ':' \|\| p_idempotency_key, 3\)\)/,
            why: 'without it two concurrent purchases with one key both pass the existence check and credit the merchant twice',
        },
        {
            what: 'seed 3 domain-separates ad credits from checkout (0), gift cards (1) and loyalty (2)',
            pattern: /, 3\)\)/,
            why: 'sharing a seed makes unrelated money paths block each other under load',
        },
        {
            what: 'the replay path returns the existing entry instead of writing a second one',
            pattern: /FROM public\.ad_credit_ledger_entries[\s\S]{0,200}?idempotency_key = p_idempotency_key\s+LIMIT 1;\s+IF FOUND THEN[\s\S]*?RAISE EXCEPTION 'ad credit idempotency key conflicts with a different request payload';[\s\S]*?RETURN jsonb_build_object\([\s\S]*?'replayed', true\);\s+END IF;/,
            why: 'a retried purchase must return the first result, not add credits again',
        },
        {
            what: 'a payment reference is REQUIRED (D-5: credits are prepaid)',
            pattern: /p_payment_reference IS NULL OR length\(btrim\(p_payment_reference\)\) = 0/,
            why: 'a credit with no funding reference is credit extended, which D-5 forbids',
        },
        {
            what: 'the amount must be positive',
            pattern: /p_amount_minor IS NULL OR p_amount_minor <= 0/,
            why: 'a zero or negative purchase would write a meaningless or balance-reducing entry',
        },
        {
            what: 'the account is locked FOR UPDATE and its status checked',
            pattern: /FROM public\.ad_credit_accounts WHERE site_id = p_site_id FOR UPDATE[\s\S]{0,200}?v_account\.status <> 'active'/,
            why: 'a frozen or closed account must not accept credits, and a concurrent writer must not interleave',
        },
        {
            what: 'the balance comes from the ledger projection, never a stored column',
            pattern: /public\.ad_credit_balance_minor\(v_account\.id\)/,
            why: 'a mutable balance column is the read-modify-write shape this ledger replaced',
        },
        {
            what: "the entry is typed 'purchased'",
            pattern: /'purchased'/,
            why: "only 'purchased' carries a payment reference; the CHECK on the table depends on the pairing",
        },
    ],
    // Pinned BEFORE migration 240 redefines this function. Its fences are security-relevant: a
    // sponsored placement is a paid slot on a public feed, and dropping one would surface a hidden
    // product, a soft-deleted one, or an unpublished seller to every buyer.
    marketplace_sponsored_products: [
        {
            what: 'only ACTIVE placements are served',
            pattern: /pl\.is_active/,
            why: 'a merchant who removed a product from a campaign must stop paying for it and stop showing it',
        },
        {
            what: 'the product must be active and not soft-deleted',
            pattern: /p\.is_active[\s\S]{0,200}?p\.deleted_at IS NULL/,
            why: 'a paid slot must not be a route around the storefront\'s own visibility rules',
        },
        {
            what: 'the seller must be published and not soft-deleted',
            pattern: /s\.status = 'published'[\s\S]{0,200}?s\.deleted_at IS NULL/,
            why: 'an unpublished seller appearing in a paid slot leaks a store that is not open',
        },
        {
            what: 'the placement, campaign and product are joined ON MATCHING site_id',
            pattern: /c\.id = pl\.campaign_id AND c\.site_id = pl\.site_id[\s\S]{0,300}?p\.id = pl\.product_id AND p\.site_id = pl\.site_id/,
            why: 'joining on id alone would let one merchant\'s campaign sponsor another\'s product',
        },
        {
            what: 'the campaign window is respected',
            pattern: /c\.starts_at IS NULL OR c\.starts_at <= now\(\)[\s\S]{0,200}?c\.ends_at IS NULL OR c\.ends_at >= now\(\)/,
            why: 'a scheduled campaign must not serve early or outlive its end date',
        },
        {
            what: 'the result set is bounded',
            pattern: /LIMIT GREATEST\(LEAST\(COALESCE\(p_limit, 10\), 20\), 1\)/,
            why: 'an unbounded SECURITY DEFINER read on a public path is an enumeration primitive',
        },
    ],
    release_ad_campaign_budget: [
        {
            what: 'the idempotency advisory lock on the ad-credit seed',
            pattern: /pg_advisory_xact_lock\(hashtextextended\(p_site_id::text \|\| ':' \|\| p_idempotency_key, 3\)\)/,
            why: 'without it one key can release twice, crediting the account for money the campaign still holds',
        },
        {
            what: 'the replay path returns the existing entry',
            pattern: /FROM public\.ad_credit_ledger_entries[\s\S]{0,200}?idempotency_key = p_idempotency_key\s+LIMIT 1;\s+IF FOUND THEN[\s\S]*?RAISE EXCEPTION 'ad credit idempotency key conflicts with a different request payload';[\s\S]*?RETURN jsonb_build_object\([\s\S]*?'replayed', true\);\s+END IF;/,
            why: 'a retried release must not credit twice',
        },
        {
            what: 'the tenant fence',
            pattern: /v_tenant_guc := NULLIF\(current_setting\('app\.site_id', true\), ''\);[\s\S]{0,300}?IF v_tenant_guc IS NULL OR v_tenant_guc::uuid IS DISTINCT FROM p_site_id THEN\s+RAISE EXCEPTION 'Current tenant site context is required for campaign budget' USING ERRCODE = '42501'/,
            why: 'a caller in one tenant transaction must not move another merchant\'s budget',
        },
        {
            what: 'the campaign must belong to THIS site, and is locked',
            pattern: /FROM public\.ad_campaigns WHERE id = p_campaign_id AND site_id = p_site_id FOR UPDATE/,
            why: 'releasing from another merchant\'s campaign into this account is the transfer D-5 forbids',
        },
        {
            what: 'RELEASING MORE THAN REMAINS IS REFUSED',
            pattern: /IF v_amount > v_releasable THEN[\s\S]{0,300}?RAISE EXCEPTION 'cannot release/,
            why: 'crediting the account beyond what the campaign holds invents credit out of a ledger meant to conserve it — the single most important line in this function',
        },
        {
            what: 'the releasable amount comes from the shared projection',
            pattern: /v_releasable := public\.ad_campaign_remaining_minor\(p_campaign_id\)/,
            why: '"remaining" must mean one thing across serving, spending and releasing',
        },
        {
            what: "the entry is typed 'released' and carries its campaign",
            pattern: /campaign_id, entry_type[\s\S]{0,300}?'released'/,
            why: 'an untagged credit cannot be traced back to the campaign it came from',
        },
        {
            what: 'allocated_minor is DECREMENTED by exactly the released amount',
            pattern: /UPDATE public\.ad_campaigns\s*SET allocated_minor = allocated_minor - v_amount/,
            why: 'a credit without this decrement leaves the campaign able to spend money the account already has back — the two must move together',
        },
    ],
    record_ad_spend: [
        {
            what: 'the cost is computed from the campaign, never accepted from the caller',
            pattern: /v_cost := CASE[\s\S]{0,400}?v_campaign\.bid_minor/,
            why: 'a caller-supplied amount is a caller-chosen charge against a merchant\'s prepaid balance',
        },
        {
            // Found by a plant that ESCAPED the invariant above: assigning v_cost from a parameter
            // first and leaving the original CASE behind an `IF false` still matched it. A pattern
            // that only proves the right code EXISTS says nothing about whether it runs.
            what: 'v_cost is assigned exactly once, so no earlier assignment can override the computation',
            pattern: /^(?:(?!v_cost\s*:=)[\s\S])*v_cost\s*:=(?:(?!v_cost\s*:=)[\s\S])*$/,
            why: 'a second assignment means the computed cost is dead code and something else decides the charge',
        },
        {
            what: 'the idempotency advisory lock on the ad-credit seed',
            pattern: /pg_advisory_xact_lock\(hashtextextended\(p_site_id::text \|\| ':' \|\| p_idempotency_key, 3\)\)/,
            why: 'a retried click must not be billed twice',
        },
        {
            what: 'the replay path returns the existing entry',
            pattern: /FROM public\.ad_credit_ledger_entries[\s\S]{0,200}?idempotency_key = p_idempotency_key\s+LIMIT 1;\s+IF FOUND THEN[\s\S]*?RAISE EXCEPTION 'ad credit idempotency key conflicts with a different request payload';[\s\S]*?RETURN jsonb_build_object\([\s\S]*?'replayed', true\);\s+END IF;/,
            why: 'ad servers retry; without this every retry is a fresh charge',
        },
        {
            what: 'the tenant fence',
            pattern: /current_setting\('app\.site_id', true\)[\s\S]{0,300}?does not match the requested site/,
            why: 'a caller inside one tenant transaction must not spend another merchant\'s budget',
        },
        {
            what: 'the campaign must belong to THIS site, and is locked',
            pattern: /FROM public\.ad_campaigns WHERE id = p_campaign_id AND site_id = p_site_id FOR UPDATE/,
            why: 'spending against another merchant\'s campaign is the transfer D-5 forbids',
        },
        {
            what: 'the charge is CLAMPED to what the campaign has left',
            pattern: /v_charged := LEAST\(v_cost, v_remaining\)/,
            why: 'charging the full bid past the allocation is the overdraft D-5 forbids; refusing it serves the click free',
        },
        {
            what: 'a spent-out campaign is flipped to exhausted',
            pattern: /UPDATE public\.ad_campaigns SET status = 'exhausted'/,
            why: 'a campaign with no budget must stop serving, and status is a fact about the ledger',
        },
        {
            what: "the entry is typed 'spent' and carries its campaign",
            pattern: /campaign_id, entry_type[\s\S]{0,300}?'spent'/,
            why: 'the per-campaign spend projection reads by campaign_id; an untagged entry is invisible to it',
        },
    ],
    allocate_ad_campaign_budget: [
        {
            what: 'the idempotency advisory lock on the ad-credit seed',
            pattern: /pg_advisory_xact_lock\(hashtextextended\(p_site_id::text \|\| ':' \|\| p_idempotency_key, 3\)\)/,
            why: 'without it one key can allocate twice, spending credits the merchant never bought',
        },
        {
            what: 'the replay path returns the existing entry',
            pattern: /FROM public\.ad_credit_ledger_entries[\s\S]{0,200}?idempotency_key = p_idempotency_key\s+LIMIT 1;\s+IF FOUND THEN[\s\S]*?RAISE EXCEPTION 'ad credit idempotency key conflicts with a different request payload';[\s\S]*?RETURN jsonb_build_object\([\s\S]*?'replayed', true\);\s+END IF;/,
            why: 'a retried allocation must not move money twice',
        },
        {
            what: 'the campaign must belong to THIS site, and is locked',
            pattern: /FROM public\.ad_campaigns WHERE id = p_campaign_id AND site_id = p_site_id FOR UPDATE/,
            why: "allocating one merchant's prepaid credits to another's campaign is the transfer D-5 forbids",
        },
        {
            what: 'the credit account is locked FOR UPDATE and its status checked',
            pattern: /FROM public\.ad_credit_accounts WHERE site_id = p_site_id FOR UPDATE[\s\S]{0,300}?v_account\.status <> 'active'/,
            why: 'a concurrent allocation must not read a stale balance, and a frozen account must not spend',
        },
        {
            what: 'NO OVERDRAFT: the allocation is refused when it exceeds the balance',
            pattern: /IF p_amount_minor > v_balance THEN[\s\S]{0,200}?RAISE EXCEPTION 'insufficient ad credits/,
            why: 'an overdraft is credit extended, which D-5 forbids; this is the single most important line in the function',
        },
        {
            what: 'the balance comes from the ledger projection',
            pattern: /public\.ad_credit_balance_minor\(v_account\.id\)/,
            why: 'a second definition of the balance would eventually disagree with the first',
        },
        {
            what: "the entry is typed 'allocated' and carries the campaign",
            pattern: /campaign_id, entry_type[\s\S]{0,300}?'allocated'/,
            why: 'the per-campaign spend projection reads entries by campaign_id; an untagged entry is invisible to it',
        },
        {
            what: 'the campaign budget is increased by exactly the allocated amount',
            pattern: /UPDATE public\.ad_campaigns\s*SET allocated_minor = allocated_minor \+ p_amount_minor/,
            why: 'the ledger entry and the budget must move together, or the campaign can spend what it was never allocated',
        },
    ],
};

for (const [functionName, invariants] of Object.entries(INVARIANTS)) {
    const { file, code } = liveDefinition(functionName);

    test(`${functionName}: the live definition is the newest one that defines it`, () => {
        assert.match(file, /^\d+_.*\.sql$/);
        assert.match(code, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${functionName}`));
        // A SECURITY DEFINER money RPC that lost its search_path pin can be hijacked by a caller's
        // search_path — the defect that kept gift cards from ever running.
        assert.match(code, /SECURITY DEFINER/);
        assert.match(code, /SET search_path = (?:public, pg_temp|pg_catalog, public)/);
    });

    for (const invariant of invariants) {
        test(`${functionName} keeps: ${invariant.what}`, () => {
            assert.match(code, invariant.pattern, `${file} dropped it — ${invariant.why}`);
        });
    }
}

// The account balance must NOT count campaign spend. Migration 232 subtracted both 'allocated' and
// 'spent', which debits the same money twice -- allocation is what moves it out of the account, and
// spending draws down the campaign it moved into. 239 removed 'spent'; re-adding it in EITHER arm
// would silently make every merchant's balance under-report by their total ad spend, and nothing
// else in the suite would notice. Asserting the name is absent from the whole body is deliberately
// blunt: there is no arm of this function in which 'spent' belongs.
test("ad_credit_balance_minor does not count campaign spend against the account", () => {
    const { file, code } = liveDefinition('ad_credit_balance_minor');
    assert.ok(!/'spent'/.test(code), `${file} counts 'spent' in the account balance again — that is the double-debit 239 removed`);
    // Non-vacuity: the other entry types must still be there, or an empty function would pass.
    for (const entryType of ["'purchased'", "'granted'", "'released'", "'allocated'"]) {
        assert.ok(code.includes(entryType), `${file} lost ${entryType} from the account balance`);
    }
});

// The structural half of "the caller does not choose the charge": record_ad_spend must not TAKE an
// amount. A pattern over the body can be satisfied by code that no longer runs -- a plant proved
// exactly that -- but a parameter the function does not have cannot be passed one.
test("record_ad_spend takes no amount parameter", () => {
    const { file, code } = liveDefinition('record_ad_spend');
    const signature = code.slice(0, code.search(/\bRETURNS\b/));
    for (const forbidden of [/p_amount/, /p_cost/, /p_charge/, /p_price/, /p_bid/, /_minor\s+bigint/]) {
        assert.ok(
            !forbidden.test(signature),
            `${file}: record_ad_spend's signature accepts an amount (${forbidden}) — the charge must come from the campaign's own bid`,
        );
    }
    // Non-vacuity: the parameters it SHOULD have are present, so an empty signature cannot pass.
    for (const expected of ['p_site_id', 'p_campaign_id', 'p_event_type', 'p_quantity', 'p_idempotency_key']) {
        assert.ok(signature.includes(expected), `${file}: record_ad_spend lost ${expected} from its signature`);
    }
});
