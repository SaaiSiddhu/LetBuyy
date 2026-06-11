import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    DEFAULT_CREDENTIAL_ORIGIN,
    parseCredentialOrigins,
    resolveCredentialedCorsOrigin,
} from '../../services/api-gateway/src/lib/cors';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');
const indexPath = join(repoRoot, 'services/api-gateway/src/index.ts');
const workerTemplatePath = join(repoRoot, 'config/env/templates/worker.env.example');
const workerSchemaPath = join(repoRoot, 'config/env/schemas/worker.schema.json');
const securityGovernancePath = join(repoRoot, 'docs/governance/security-operations-governance.md');

function read(path: string): string {
    assert.equal(existsSync(path), true, `${path} must exist`);
    return readFileSync(path, 'utf8');
}

test('credentialed CORS reflects only exact platform or configured tenant origins', () => {
    assert.equal(
        resolveCredentialedCorsOrigin('https://accounts.letbuyy.com', {}),
        'https://accounts.letbuyy.com',
    );
    assert.equal(
        resolveCredentialedCorsOrigin('https://merchant.example.com', {
            CORS_CREDENTIAL_ORIGINS: 'https://merchant.example.com, https://tenant.letbuyy.com/',
        }),
        'https://merchant.example.com',
    );
    assert.equal(
        resolveCredentialedCorsOrigin('https://accounts-staging.letbuyy.com', {}),
        DEFAULT_CREDENTIAL_ORIGIN,
        'staging origins must be configured by environment, not hardcoded into production source',
    );
    assert.equal(
        resolveCredentialedCorsOrigin('https://accounts-staging.letbuyy.com', {
            CORS_CREDENTIAL_ORIGINS: 'https://accounts-staging.letbuyy.com',
        }),
        'https://accounts-staging.letbuyy.com',
    );
    assert.equal(
        resolveCredentialedCorsOrigin('https://random-store.letbuyy.com', {}),
        DEFAULT_CREDENTIAL_ORIGIN,
        'unconfigured tenant subdomains must not receive credentialed CORS reflection',
    );
    assert.equal(
        resolveCredentialedCorsOrigin('http://merchant.example.com', {
            CORS_CREDENTIAL_ORIGINS: 'http://merchant.example.com',
        }),
        DEFAULT_CREDENTIAL_ORIGIN,
        'configured origins must be HTTPS browser origins',
    );
    assert.deepEqual(parseCredentialOrigins(' https://tenant.letbuyy.com/ , javascript:alert(1), https://store.example.com/path '), [
        'https://tenant.letbuyy.com',
    ]);
});

test('api gateway CORS middleware uses the resolver and has no wildcard subdomain allow branch', () => {
    const source = read(indexPath);

    assert.match(source, /resolveCredentialedCorsOrigin\(origin,\s*c\.env\)/);
    assert.doesNotMatch(source, /Allow all \*\.letbuyy\.store subdomains/);
    assert.doesNotMatch(source, /\[a-z0-9-\]\+\\\.letbuyy\\\.store/);
});

test('credentialed CORS configuration is present in env contracts and governance docs', () => {
    const template = read(workerTemplatePath);
    const schema = read(workerSchemaPath);
    const governance = read(securityGovernancePath);

    assert.match(template, /CORS_CREDENTIAL_ORIGINS=https:\/\/accounts-staging\.letbuyy\.com,https:\/\/admin-staging\.letbuyy\.com,https:\/\/store-staging\.letbuyy\.com/);
    assert.match(schema, /"CORS_CREDENTIAL_ORIGINS"/);
    assert.match(governance, /CORS_CREDENTIAL_ORIGINS/);
    assert.match(governance, /credentialed CORS/i);
});
