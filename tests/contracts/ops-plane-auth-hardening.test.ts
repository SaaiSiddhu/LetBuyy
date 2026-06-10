import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');
const cryptoPath = join(repoRoot, 'services/api-gateway/src/lib/crypto.ts');
const internalConsolePath = join(repoRoot, 'services/api-gateway/src/routes/internal-console.ts');
const internalSecretPath = join(repoRoot, 'services/api-gateway/src/lib/internal-secret.ts');
const exportRoutePath = join(repoRoot, 'services/api-gateway/src/routes/export.ts');
const appAuthPath = join(repoRoot, 'services/api-gateway/src/middleware/app-auth.ts');
const extensionRoutesPath = join(repoRoot, 'services/api-gateway/src/routes/app-store/extension-routes.ts');
const billingOauthPath = join(repoRoot, 'services/api-gateway/src/routes/app-store/billing-oauth-routes.ts');
const skippedDecisionsPath = join(repoRoot, 'SKIPPED_HUMAN_DECISIONS.md');
const executionLedgerPath = join(repoRoot, 'EXECUTION_LEDGER.md');

function read(path: string): string {
    assert.equal(existsSync(path), true, `${path} must exist`);
    return readFileSync(path, 'utf8');
}

test('internal console and internal API secrets use timing-safe text comparison', () => {
    const crypto = read(cryptoPath);
    const internalConsole = read(internalConsolePath);
    const internalSecret = read(internalSecretPath);
    const exportRoute = read(exportRoutePath);

    assert.match(crypto, /export function timingSafeEqualText/);
    assert.match(internalConsole, /timingSafeEqualText\(token,\s*expectedToken\)/);
    assert.doesNotMatch(internalConsole, /token\s*!==\s*expectedToken/);
    assert.match(internalSecret, /const provided = req\.header\('X-Internal-API-Secret'\)/);
    assert.match(internalSecret, /secrets\.some\(\(secret\) => timingSafeEqualText\(provided,\s*secret\)\)/);
    assert.doesNotMatch(internalSecret, /header\('X-Internal-API-Secret'\)\s*===\s*secret/);
    assert.match(exportRoute, /timingSafeEqualText\(token,\s*expected\)/);
    assert.doesNotMatch(exportRoute, /function safeEqual/);
});

test('stored app OAuth token hashes and authorization-code hashes use timing-safe hex comparison', () => {
    const appAuth = read(appAuthPath);
    const extensionRoutes = read(extensionRoutesPath);
    const billingOauth = read(billingOauthPath);

    assert.match(appAuth, /timingSafeEqualHex/);
    assert.match(appAuth, /timingSafeEqualHex\(stringOrNull\(oauth\.access_token_hash\),\s*input\.tokenHash\)/);
    assert.match(appAuth, /timingSafeEqualHex\(stringOrNull\(oauth\.bridge_token_hash\),\s*input\.tokenHash\)/);
    assert.doesNotMatch(appAuth, /access_token_hash\)\s*===\s*input\.tokenHash/);
    assert.doesNotMatch(appAuth, /bridge_token_hash\)\s*===\s*input\.tokenHash/);

    assert.match(extensionRoutes, /timingSafeEqualHex/);
    assert.match(extensionRoutes, /timingSafeEqualHex\(stringOrNull\(oauth\.bridge_token_hash\),\s*tokenHash\)/);
    assert.match(extensionRoutes, /timingSafeEqualHex\(stringOrNull\(oauth\.access_token_hash\),\s*tokenHash\)/);
    assert.doesNotMatch(extensionRoutes, /bridge_token_hash\)\s*===\s*tokenHash/);
    assert.doesNotMatch(extensionRoutes, /access_token_hash\)\s*===\s*tokenHash/);

    assert.match(billingOauth, /timingSafeEqualHex\(expectedCodeHash,\s*codeHash\)/);
    assert.doesNotMatch(billingOauth, /expectedCodeHash\s*!==\s*codeHash/);
});

test('per-operator ops identity remainder is explicitly human-gated', () => {
    const skipped = read(skippedDecisionsPath);
    const ledger = read(executionLedgerPath);

    assert.match(skipped, /SKIP-OPS-SSO-IDP/);
    assert.match(skipped, /[Pp]er-operator gateway-side ops identity/);
    assert.match(skipped, /static-token path remains timing-safe hardened/);
    assert.match(ledger, /STEPUP-OPS-SSO-IDP-SEAM/);
});
