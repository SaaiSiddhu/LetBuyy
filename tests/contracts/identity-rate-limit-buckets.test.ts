// APPID-P4a — identity-platform's rate-limit buckets and the gateway's are one contract.
//
// identity-platform names a bucket and asks the gateway's /auth/custom/rate-limit/check. The gateway
// answers 400 for a name it does not know, and identity-platform treats any failure as "not allowed"
// outside development. In development it skips the remote check, which is why nobody saw the
// consequence: three names identity-platform used (buyer-register, buyer-login, switch) were missing
// from the gateway's table, so every production buyer registration and sign-in, and every merchant
// account switch, answered 429.
//
// Two hand-declared tables for one contract drift; this keeps them equal, entry for entry.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

interface Bucket { limit: number; windowMs: number; prefix: string }

const UNIT_MS: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/// The object literal between `startAnchor` and the first `endAnchor` after it. Both anchors are
/// asserted present so a renamed table fails loudly instead of parsing as empty.
function block(source: string, startAnchor: string, endAnchor: string): string {
    const start = source.indexOf(startAnchor);
    assert.ok(start >= 0, `anchor not found: ${startAnchor}`);
    const end = source.indexOf(endAnchor, start);
    assert.ok(end > start, `end anchor not found after ${startAnchor}: ${endAnchor}`);
    return source.slice(start + startAnchor.length, end);
}

function parse(body: string, windowOf: (raw: string) => number): Map<string, Bucket> {
    const entries = new Map<string, Bucket>();
    // A bare or quoted key, then { limit, window|windowMs, prefix } in that order: the shape both
    // tables use. A line that does not match is caught by the size check below, not skipped silently.
    const entry = /^\s*'?([A-Za-z_][\w-]*)'?:\s*\{\s*limit:\s*(\d+),\s*window(?:Ms)?:\s*([^,]+),\s*prefix:\s*'([^']+)'\s*\},?\s*$/gm;
    for (const m of body.matchAll(entry)) {
        assert.ok(!entries.has(m[1]), `duplicate bucket ${m[1]}`);
        entries.set(m[1], { limit: Number(m[2]), windowMs: windowOf(m[3].trim()), prefix: m[4] });
    }
    const declared = body.split('\n').filter((line) => /^\s*'?[A-Za-z_][\w-]*'?:\s*\{/.test(line)).length;
    assert.equal(entries.size, declared, 'every bucket line must parse; an unparsed line would hide a drift');
    return entries;
}

const identityTable = parse(
    block(read('apps/platform/identity/src/lib/rate-limit.ts'), 'export const AUTH_RATE_LIMITS = {', '} satisfies Record<'),
    (raw) => {
        const m = /^'(\d+) ([smhd])'$/.exec(raw);
        assert.ok(m, `identity window not understood: ${raw}`);
        return Number(m[1]) * UNIT_MS[m[2]];
    },
);

const gatewayTable = parse(
    block(read('services/api-gateway/src/routes/auth.ts'), 'const AUTH_RATE_LIMITS = {', '} as const;'),
    (raw) => {
        assert.ok(/^[\d_\s*]+$/.test(raw), `gateway window not understood: ${raw}`);
        return raw.split('*').map((part) => Number(part.replace(/[_\s]/g, ''))).reduce((a, b) => a * b, 1);
    },
);

function routeFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return routeFiles(path);
        return name === 'route.ts' ? [path] : [];
    });
}

const usedBuckets = new Map<string, string[]>();
for (const file of routeFiles(join(root, 'apps/platform/identity/src/app'))) {
    for (const m of readFileSync(file, 'utf8').matchAll(/checkRateLimit\(\s*'([^']+)'/g)) {
        usedBuckets.set(m[1], [...(usedBuckets.get(m[1]) ?? []), relative(root, file)]);
    }
}

test('the tables are not empty and include both key styles, so the parse is real', () => {
    assert.ok(identityTable.size >= 16, `identity table parsed ${identityTable.size} buckets`);
    assert.ok(gatewayTable.size >= 16, `gateway table parsed ${gatewayTable.size} buckets`);
    for (const key of ['login', 'verify_otp', 'buyer-login', 'switch']) {
        assert.ok(identityTable.has(key), `identity table: ${key}`);
    }
    assert.ok(usedBuckets.size >= 12, `found ${usedBuckets.size} bucket names in identity routes`);
});

test('every bucket an identity route uses is declared in identity-platform', () => {
    for (const [name, files] of usedBuckets) {
        assert.ok(identityTable.has(name), `${name} is used by ${files.join(', ')} but not declared in identity-platform`);
    }
});

test('the gateway accepts exactly the buckets identity-platform declares, with the same limits', () => {
    assert.deepEqual([...gatewayTable.keys()].sort(), [...identityTable.keys()].sort());
    for (const [name, bucket] of identityTable) {
        assert.deepEqual(gatewayTable.get(name), bucket, `bucket ${name} differs between identity-platform and the gateway`);
    }
});
