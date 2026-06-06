import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

function read(path: string): string {
    assert.equal(existsSync(path), true, `${path} must exist`);
    return readFileSync(path, 'utf8');
}

test('api-gateway crypto module owns route-layer crypto primitives', () => {
    const crypto = read(join(repoRoot, 'services/api-gateway/src/lib/crypto.ts'));

    assert.match(crypto, /export function timingSafeEqualText/);
    assert.match(crypto, /export function timingSafeEqualHex/);
    assert.match(crypto, /export async function hmacSha256Hex/);
    assert.match(crypto, /export async function sha256Hex/);
});

test('storefront route modules import shared crypto helpers instead of declaring local copies', () => {
    const storefrontRoot = read(join(repoRoot, 'services/api-gateway/src/routes/storefront.ts'));
    const publicRoutes = read(join(repoRoot, 'services/api-gateway/src/routes/storefront/public-routes.ts'));
    const customerRoutes = read(join(repoRoot, 'services/api-gateway/src/routes/storefront/customer-engagement-routes.ts'));

    const localCryptoDeclaration = /\b(?:function|async function)\s+(?:hexToBytes|timingSafeEqualHex|timingSafeEqualText|hmacSha256Hex|sha256Hex)\b/;
    assert.doesNotMatch(storefrontRoot, localCryptoDeclaration);
    assert.doesNotMatch(publicRoutes, localCryptoDeclaration);
    assert.doesNotMatch(customerRoutes, localCryptoDeclaration);
    assert.match(publicRoutes, /import \{ sha256Hex \} from '..\/..\/lib\/crypto'/);
    assert.match(customerRoutes, /import \{ hmacSha256Hex \} from '..\/..\/lib\/crypto'/);
});

test('single-source crypto validator is wired into governance', () => {
    const validator = read(join(repoRoot, 'scripts/validators/single-source-crypto-validator.mjs'));
    const governanceRunner = read(join(repoRoot, 'scripts/validate-governance.mjs'));

    assert.match(validator, /routeCryptoDeclarationPattern/);
    assert.match(validator, /services\/api-gateway\/src\/lib\/crypto\.ts/);
    assert.match(governanceRunner, /single-source-crypto-validator\.mjs/);
});
