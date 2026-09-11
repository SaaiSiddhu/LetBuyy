// F-WIRETYPE-1 — a route may not hand-declare a wire contract that checkout-core already infers.
//
// THE DEFECT CLASS (CAP-C39 → CAP-C42 → CAP-C46, three occurrences)
// A handler receives a body parsed by a Zod schema, then casts it to a SECOND, hand-maintained
// description of the same contract. TypeScript then checks the handler against the hand-written
// copy instead of against the thing that actually parses the request, so the two can disagree while
// the build stays green. That is not hypothetical here: `StorefrontCreateOrderBody` declared
// `shippingRateId?: string | null` for months while `StorefrontCreateOrderSchema` did not declare
// the field at all. `z.object()` strips unrecognised keys silently, so `body.shippingRateId` was
// always `undefined`, `resolveShippingRate` always received `null`, and a merchant's real configured
// shipping rate was never reachable. Nothing failed. Nothing could fail — the checker was reading
// the wrong description.
//
// THE RULE
// If checkout-core exports `type <Name>Input`, no gateway route may declare a local `type <Name>Body`.
// The inferred type is the contract; a second spelling of it is the bug waiting to happen.
//
// WHAT THIS RULE DELIBERATELY DOES NOT SAY
// It does not forbid every local body type. `internal-payment-routes.ts` and
// `customer-engagement-routes.ts` declare eight of them with no `<Name>Input` counterpart — those
// contracts have no schema yet, and authoring one is a runtime change, not a type change. Widening
// this rule to "no local body types at all" would turn that into a failing test with no safe fix.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const routesRoot = join(testDir, '..', 'routes');
const checkoutCore = join(testDir, '../../../../packages/checkout-core/src/index.ts');

function tsFilesUnder(directory: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(directory)) {
        const full = join(directory, entry);
        if (statSync(full).isDirectory()) found.push(...tsFilesUnder(full));
        else if (entry.endsWith('.ts')) found.push(full);
    }
    return found.sort();
}

// Anchored at line start, so a `// type FooBody = {` mention in prose is not a declaration.
const LOCAL_BODY_TYPE = /^type (\w+)Body = \{/gm;

export function inferredInputNames(checkoutCoreSource: string): Set<string> {
    return new Set(
        [...checkoutCoreSource.matchAll(/^export type (\w+)Input = z\.infer</gm)].map((m) => m[1]),
    );
}

export function duplicatedContracts(source: string, inferred: Set<string>): string[] {
    return [...source.matchAll(LOCAL_BODY_TYPE)]
        .map((m) => m[1])
        .filter((name) => inferred.has(name));
}

const checkoutCoreSource = readFileSync(checkoutCore, 'utf8');
const inferred = inferredInputNames(checkoutCoreSource);

test('checkout-core actually exports inferred input types — the rule has something to compare against', () => {
    // Without this the sweep below would pass by finding nothing to match, forever.
    assert.ok(inferred.size >= 20, `expected many inferred Input types, found ${inferred.size}`);
    for (const name of ['StorefrontCreateOrder', 'StorefrontRazorpayOrder', 'StorefrontRazorpayVerify']) {
        assert.ok(inferred.has(name), `${name}Input must stay exported — three handlers now depend on it`);
    }
});

test('no route hand-declares a contract checkout-core already infers', () => {
    const offenders: string[] = [];
    for (const file of tsFilesUnder(routesRoot)) {
        for (const name of duplicatedContracts(readFileSync(file, 'utf8'), inferred)) {
            offenders.push(`${file.slice(file.indexOf('src/'))}: type ${name}Body duplicates ${name}Input`);
        }
    }
    assert.deepEqual(
        offenders,
        [],
        'import the inferred type from @letbuyy/checkout-core instead. A hand-written copy of a wire '
            + 'contract is what let shippingRateId be declared in one place, absent in the other, and '
            + 'silently stripped at runtime while the build stayed green.',
    );
});

test('the rule is load-bearing: it fires on the exact declaration this phase removed', () => {
    // The real pre-phase line. If the detector stops matching it, the empty sweep above means nothing.
    const before = `type StorefrontCreateOrderBody = {\n    customer: {\n        name: string;\n    };\n};`;
    assert.deepEqual(duplicatedContracts(before, inferred), ['StorefrontCreateOrder']);

    // And it must not fire on a body type that has no schema counterpart — those are legitimate.
    const legitimate = `type InternalPaymentConfirmBody = {\n    orderId: string;\n};`;
    assert.deepEqual(duplicatedContracts(legitimate, inferred), []);

    // A mention in prose is not a declaration.
    assert.deepEqual(duplicatedContracts('// type StorefrontCreateOrderBody = { ... }', inferred), []);
});

test('the three converted handlers read the inferred type, not a local copy', () => {
    const route = readFileSync(join(routesRoot, 'storefront/checkout-payment-routes.ts'), 'utf8');
    for (const name of ['StorefrontCreateOrderInput', 'StorefrontRazorpayOrderInput', 'StorefrontRazorpayVerifyInput']) {
        assert.match(route, new RegExp(`as ${name};`), `${name} must be what validatedBody is cast to`);
    }
    assert.doesNotMatch(route, /type Storefront\w*Body = \{/, 'the local copies must stay deleted');
});
