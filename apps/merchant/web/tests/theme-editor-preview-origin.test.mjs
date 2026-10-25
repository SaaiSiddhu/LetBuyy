import assert from 'node:assert/strict';
import test from 'node:test';
import urls from '../src/lib/public-urls.ts';
import { resolveStorefrontHost } from '@letbuyy/tenant-core';

function withConfig(config, check) {
    const keys = ['NEXT_PUBLIC_STORE_ROOT_DOMAIN', 'NEXT_PUBLIC_STOREFRONT_URL', 'NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES', 'NODE_ENV'];
    const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    try {
        for (const key of keys) config[key] === undefined ? delete process.env[key] : process.env[key] = config[key];
        check();
    } finally {
        for (const key of keys) before[key] === undefined ? delete process.env[key] : process.env[key] = before[key];
    }
}

test('the configured local buyer origin cannot force another store editor through its tenant rewrite', () => {
    withConfig({ NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'localhost', NEXT_PUBLIC_STOREFRONT_URL: 'http://syn-original.localhost:51237', NODE_ENV: 'production' }, () => {
        assert.equal(urls.getStorefrontBaseUrl(), 'http://syn-original.localhost:51237', 'buyer config is unchanged');
        const preview = new URL('/preview?subdomain=syn-editor-new', urls.getEditorPreviewBaseUrl());
        assert.equal(preview.href, 'http://localhost:51237/preview?subdomain=syn-editor-new');
        assert.equal(resolveStorefrontHost(preview.hostname, 'localhost').kind, 'root', 'the real proxy resolver admits the platform preview route');
        assert.equal(resolveStorefrontHost(new URL(urls.getStorefrontBaseUrl()).hostname, 'localhost').kind, 'subdomain');
    });
});

test('production buyer/custom hosts use the configured canonical preview root, retaining listener protocol and port', () => {
    for (const hostname of ['buyer.store.example', 'custom.example']) {
        withConfig({ NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'store.example', NEXT_PUBLIC_STOREFRONT_URL: `https://${hostname}:8443/store/old?ignored=1`, NODE_ENV: 'production' }, () => {
            assert.equal(urls.getEditorPreviewBaseUrl(), 'https://store.example:8443');
        });
    }
});

test('bare local listeners and default local/production origins stay usable', () => {
    for (const origin of ['http://localhost:3003', 'http://127.0.0.1:3003', 'http://[::1]:3003']) {
        withConfig({ NEXT_PUBLIC_STOREFRONT_URL: origin, NODE_ENV: 'development' }, () => assert.equal(urls.getEditorPreviewBaseUrl(), origin));
    }
    withConfig({ NODE_ENV: 'development' }, () => assert.equal(urls.getEditorPreviewBaseUrl(), 'http://localhost:3003'));
    withConfig({ NODE_ENV: 'production', NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'store.example' }, () => assert.equal(urls.getEditorPreviewBaseUrl(), 'https://store.example'));
});

test('preview config rejects credentials and executable URL schemes', () => {
    for (const origin of ['javascript:alert(1)', 'https://user:password@store.example']) {
        withConfig({ NEXT_PUBLIC_STOREFRONT_URL: origin }, () => assert.throws(() => urls.getEditorPreviewBaseUrl()));
    }
});

test('View store resolves the requested local tenant rather than the fixture original tenant', () => {
    withConfig({ NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'localhost', NEXT_PUBLIC_STOREFRONT_URL: 'http://syn-original.localhost:51237', NODE_ENV: 'production' }, () => {
        const destination = new URL(urls.getStorefrontStoreUrl('syn-editor-new'));
        assert.equal(destination.href, 'http://localhost:51237/store/syn-editor-new');
        assert.equal(resolveStorefrontHost(destination.hostname, 'localhost').kind, 'root');
        assert.equal(destination.pathname.split('/')[2], 'syn-editor-new', 'the root access gate receives the intended tenant');
        assert.equal(urls.getEditorPreviewBaseUrl(), 'http://localhost:51237', 'signed previews keep their separate platform route');
    });
});

test('View store normalizes a canonical buyer host while preserving protocol, port and strict URL validation', () => {
    withConfig({ NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'store.example', NEXT_PUBLIC_STOREFRONT_URL: 'https://original.store.example:8443', NODE_ENV: 'production' }, () => {
        const destination = new URL(urls.getStorefrontStoreUrl('syn-editor-new'));
        assert.equal(destination.href, 'https://syn-editor-new.store.example:8443/');
        assert.equal(resolveStorefrontHost(destination.hostname, 'store.example').subdomain, 'syn-editor-new');
        assert.throws(() => urls.getStorefrontStoreUrl('../other'));
    });
    for (const configured of ['javascript:alert(1)', 'https://user:secret@original.store.example', 'https://original.store.example?unexpected=1', 'https://original.store.example#unexpected']) {
        withConfig({ NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'store.example', NEXT_PUBLIC_STOREFRONT_URL: configured }, () => assert.throws(() => urls.getStorefrontStoreUrl('syn-editor-new')));
    }
});

test('View store retains existing bare-listener, custom-base and default production contracts', () => {
    for (const configured of ['http://localhost:3003', 'http://127.0.0.1:3003', 'https://custom.example/shop']) {
        withConfig({ NEXT_PUBLIC_STOREFRONT_URL: configured, NODE_ENV: 'development' }, () => assert.equal(urls.getStorefrontStoreUrl('syn-editor-new'), `${configured}/store/syn-editor-new`));
    }
    withConfig({ NODE_ENV: 'production', NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'store.example' }, () => assert.equal(urls.getStorefrontStoreUrl('syn-editor-new'), 'https://syn-editor-new.store.example'));
});


test('a configured platform alias hosts signed previews while View store stays on the requested tenant',()=>{
 withConfig({NEXT_PUBLIC_STORE_ROOT_DOMAIN:'stores.example.test',NEXT_PUBLIC_STOREFRONT_URL:'https://storefront.stores.example.test',NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES:'storefront.stores.example.test',NODE_ENV:'production'},()=>{
  assert.equal(urls.getEditorPreviewBaseUrl(),'https://storefront.stores.example.test');
  assert.equal(urls.getStorefrontStoreUrl('syn-new'),'https://syn-new.stores.example.test');
  assert.equal(resolveStorefrontHost(new URL(urls.getEditorPreviewBaseUrl()).hostname,'stores.example.test','storefront.stores.example.test').kind,'root');
 });
});
