import assert from 'node:assert/strict';
import test from 'node:test';
import { ThemeStoreQuerySchema, SaveThemeDraftSchema, PublishThemeSchema, PreviewTokenSchema } from '../src/index.ts';
import { validateTemplateKey } from '../src/template-registry.ts';

const schemas = [ThemeStoreQuerySchema, SaveThemeDraftSchema, PublishThemeSchema, PreviewTokenSchema];
const input = { store_id: '33333333-3333-4333-8333-333333333333', template_config: {}, base_version: 1, idempotency_key: 'synthetic-template-intent', ttl_seconds: 900 };

for (const key of ['index', 'page', 'blog', 'article', 'page.faq', 'product.alternate', 'customers/account', 'customers/addresses']) {
    test(`editor request schemas preserve the canonical template key ${key}`, () => {
        validateTemplateKey(key);
        for (const schema of schemas) {
            const parsed = schema.safeParse({ ...input, template_key: key });
            assert.equal(parsed.success, true, `canonical key rejected: ${key}`);
            if (parsed.success) assert.equal(parsed.data.template_key, key);
        }
    });
}

for (const key of ['../private', '/page', 'page..faq', 'page.faq/other', 'customers//account', '__proto__', 'constructor', 'prototype', 'Page', 'page?token=bad', 'x'.repeat(121)]) {
    test(`editor requests reject unsafe or non-canonical key ${key}`, () => {
        assert.throws(() => validateTemplateKey(key));
        for (const schema of schemas) assert.equal(schema.safeParse({ ...input, template_key: key }).success, false);
    });
}

test('omitted template key defaults to index while explicit empty input is rejected', () => {
    for (const schema of schemas) {
        assert.equal(schema.parse(input).template_key, 'index');
        assert.equal(schema.safeParse({ ...input, template_key: '' }).success, false);
    }
});
