import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createStructuredLogger } from '../../packages/typescript/ui/src/logging';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

function read(relativePath: string): string {
    const absolutePath = join(repoRoot, relativePath);
    assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
    return readFileSync(absolutePath, 'utf8');
}

test('shared structured logger emits marketplace app identity and context', () => {
    const lines: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (line?: unknown) => {
        lines.push(String(line));
    };
    console.error = (line?: unknown) => {
        lines.push(String(line));
    };

    try {
        const logger = createStructuredLogger('app-marketplace');
        logger.info('catalog loaded', { count: 3 });
        logger.error('catalog failed', { code: 'CATALOG_UNAVAILABLE' });
    } finally {
        console.log = originalLog;
        console.error = originalError;
    }

    assert.equal(lines.length, 2);
    assert.deepEqual(
        lines.map((line) => {
            const parsed = JSON.parse(line) as Record<string, unknown>;
            assert.equal(typeof parsed.timestamp, 'string');
            delete parsed.timestamp;
            return parsed;
        }),
        [
            { level: 'info', app: 'app-marketplace', message: 'catalog loaded', count: 3 },
            { level: 'error', app: 'app-marketplace', message: 'catalog failed', code: 'CATALOG_UNAVAILABLE' },
        ],
    );
});

test('marketplace apps wrap shared logger and unavailable component implementations', () => {
    const loggerFiles = [
        'apps/app-marketplace/src/lib/logger.ts',
        'apps/theme-marketplace/src/lib/logger.ts',
    ];
    for (const file of loggerFiles) {
        const source = read(file);
        assert.match(source, /@letbuyy\/ui\/logging/);
        assert.doesNotMatch(source, /\bfunction\s+emit\b/);
        assert.doesNotMatch(source, /console\.(?:log|error|warn|debug|info)/);
    }

    const unavailableFiles = [
        'apps/app-marketplace/src/components/MarketplaceUnavailable.tsx',
        'apps/theme-marketplace/src/components/marketplace-unavailable.tsx',
    ];
    for (const file of unavailableFiles) {
        const source = read(file);
        assert.match(source, /@letbuyy\/ui\/marketplace/);
        assert.doesNotMatch(source, /<div\s+role="alert"/);
    }
});

test('marketplace single-source validator is wired into governance', () => {
    const packageJson = JSON.parse(read('packages/typescript/ui/package.json'));
    const validator = read('scripts/validators/marketplace-single-source-validator.mjs');
    const governanceRunner = read('scripts/validate-governance.mjs');

    assert.equal(packageJson.exports['./logging'], './src/logging.ts');
    assert.equal(packageJson.exports['./marketplace'], './src/marketplace.tsx');
    assert.match(validator, /marketplace logger and unavailable UI implementations/);
    assert.match(governanceRunner, /marketplace-single-source-validator\.mjs/);
});
