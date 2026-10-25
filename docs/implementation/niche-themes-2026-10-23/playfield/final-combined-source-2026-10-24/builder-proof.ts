import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { createFirstPartyCatalogBundle } from '@letbuyy/theme-engine';

const output = 'docs/implementation/niche-themes-2026-10-23/playfield/final-combined-source-2026-10-24';
const historical = JSON.parse(readFileSync('docs/implementation/niche-themes-2026-10-23/playfield/v201-source-repair-2026-10-23/after-bundle-hashes.json', 'utf8')) as {
    previousOutputs: { slug: string; designVersion: string; sha256: string }[];
};
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outputs = historical.previousOutputs.map(row => {
    const bundle = createFirstPartyCatalogBundle(row.slug, row.designVersion === '2.0.0' ? { designVersion: '2.0.0' } : {});
    const sha256 = digest(bundle);
    assert.equal(sha256, row.sha256, row.slug + ':' + row.designVersion);
    return { ...row, actualSha256: sha256, unchanged: true };
});
assert.equal(outputs.length, 20);
const old = createFirstPartyCatalogBundle('letbuyy-bloom', { designVersion: '2.0.0' });
const next = createFirstPartyCatalogBundle('letbuyy-bloom', { designVersion: '2.0.0', playfieldVersion: '2.0.1' });
const paths: string[] = [];
function compare(before: unknown, after: unknown, path = '') {
    if (isDeepStrictEqual(before, after)) return;
    if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
        const a = before as Record<string, unknown>, b = after as Record<string, unknown>;
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) compare(a[key], b[key], path + '/' + key);
    } else paths.push(path);
}
compare(old, next);
assert.deepEqual(paths.sort(), ['/package/version', '/package/version_number', '/sections/product-detail/source']);
assert.deepEqual(next.layout, old.layout);
assert.deepEqual(next.sections['customer-order-detail'], old.sections['customer-order-detail']);
assert.match(next.layout.theme.source, /data-niche-order-presentation="1"/);
assert.match(next.sections['customer-order-detail'].source, /<!-- lb:niche-order-presentation:v1 -->/);
const rawSha256 = digest(next);
assert.equal(rawSha256, '91dd7e6239aefa6a341dfc04ba5d8cc79d8136f1c4d46b48fda66799ecbbe9d7');
const proof = {
    classification: 'IN_MEMORY_BUILDER_DIGEST_AND_SEMANTIC_PROOF_ONLY_NOT_CAPTURE_OR_INSTALLED_ACCEPTANCE',
    priorRawFactorySha256: 'c8a1defdf97a0d8d9bf1060c86d5a1727d458747e56353db88f44b456a8bfc5d',
    revisedRawFactorySha256: rawSha256,
    semanticDifferencePaths: paths,
    wholeLayoutExact: true,
    wholeCustomerOrderSectionExact: true,
    historical20Outputs: outputs,
    immutableCaptureGenerated: false,
    sqlGeneratedOrApplied: false,
};
writeFileSync(output + '/builder-proof.json', JSON.stringify(proof, null, 2) + '\n');
process.stdout.write(JSON.stringify({ rawSha256, historicalOutputsUnchanged: outputs.length, semanticDifferencePaths: paths }) + '\n');
