import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTenantStorefrontUrl } from '@letbuyy/tenant-core';
import { threadlineFixtureOrigins, threadlineFixturePaths, threadlineFixtureLogPath, threadlineFixtureProfile, threadlineFixtureMarketplacePort } from './owned-db/threadline-browser-fixture';
import { themeEditorFixtureProductCommands } from './owned-db/threadline-qa-fixture';

const input = { runId: 'a1b2c3d4e5f6', subdomain: 'syn-threadline-ui-a1b2c3d4', identityPort: 4101, merchantPort: 4102, commercePort: 4103 };

test('fixture platform SSO is scoped to one run and the canonical buyer host stays outside it', () => {
  const origins = threadlineFixtureOrigins(input);
  assert.equal(origins.identityOrigin, 'http://accounts.threadline-a1b2c3d4e5f6.localhost:4101');
  assert.equal(origins.merchantOrigin, 'http://admin.threadline-a1b2c3d4e5f6.localhost:4102');
  assert.equal(origins.commerceOrigin, 'http://syn-threadline-ui-a1b2c3d4.localhost:4103');
  assert.equal(origins.platformCookieDomain, 'threadline-a1b2c3d4e5f6.localhost');
  assert.notEqual(origins.platformCookieDomain, 'localhost');
  for (const origin of [origins.identityOrigin, origins.merchantOrigin]) {
    assert.ok(new URL(origin).hostname.endsWith(`.${origins.platformCookieDomain}`));
  }
  assert.equal(new URL(origins.commerceOrigin).hostname.endsWith(`.${origins.platformCookieDomain}`), false);
  assert.equal(buildTenantStorefrontUrl(input.subdomain, { rootDomain: origins.storeRootDomain, baseUrl: origins.commerceOrigin }), `${origins.commerceOrigin}/store/${input.subdomain}`);
  assert.ok(Object.isFrozen(origins));
});

test('the actual child environment shares only the run-bound platform parent and issuer', () => {
  const origins = threadlineFixtureOrigins(input);
  assert.deepEqual(origins.sharedEnvironment, {
    NEXT_PUBLIC_ACCOUNTS_URL: origins.identityOrigin,
    NEXT_PUBLIC_ADMIN_URL: origins.merchantOrigin,
  });
  assert.deepEqual(origins.identityEnvironment, {
    LETBUYY_IDENTITY_ISSUER: origins.identityOrigin,
    COOKIE_DOMAIN: origins.platformCookieDomain,
  });
  assert.equal('COOKIE_DOMAIN' in origins.sharedEnvironment, false, 'the buyer runtime does not inherit a platform cookie domain');
  assert.ok(Object.isFrozen(origins.sharedEnvironment));
  assert.ok(Object.isFrozen(origins.identityEnvironment));
});

test('a second run cannot reuse the first platform cookie domain or artifact paths', () => {
  const first = threadlineFixtureOrigins(input);
  const second = threadlineFixtureOrigins({ ...input, runId: '123456abcdef', subdomain: 'syn-threadline-ui-123456ab', identityPort: 4201, merchantPort: 4202, commercePort: 4203 });
  assert.notEqual(first.platformCookieDomain, second.platformCookieDomain);
  for (const origin of [second.identityOrigin, second.merchantOrigin, second.commerceOrigin]) {
    assert.equal(new URL(origin).hostname.endsWith(`.${first.platformCookieDomain}`), false);
  }
  assert.notDeepEqual(threadlineFixturePaths(input.runId), threadlineFixturePaths('123456abcdef'));
  assert.notEqual(threadlineFixtureLogPath(input.runId, 'merchant-next-production'), threadlineFixtureLogPath('123456abcdef', 'merchant-next-production'));
});

test('invalid run IDs, real/ambiguous store handles and unbound app ports fail closed', () => {
  for (const runId of ['../owner', 'a1b2c3d4e5f6\n', 'A1B2C3D4E5F6', '123456789abc0', 'not-a-run-id']) {
    assert.throws(() => threadlineFixtureOrigins({ ...input, runId }));
    assert.throws(() => threadlineFixturePaths(runId));
  }
  for (const subdomain of ['merchant', 'syn-a.localhost', 'syn-a/../owner', 'syn-a\n', '-syn-store']) {
    assert.throws(() => threadlineFixtureOrigins({ ...input, subdomain }));
  }
  for (const identityPort of [0, 1023, 65536, 4101.5, Number.NaN, input.merchantPort]) {
    assert.throws(() => threadlineFixtureOrigins({ ...input, identityPort }));
  }
});

test('capture, state and client logs have strict run-scoped temporary paths', () => {
  assert.deepEqual(threadlineFixturePaths(input.runId), {
    statePath: '/private/tmp/threadline-a1b2c3d4e5f6-state.json',
    capturedMailPath: '/private/tmp/threadline-a1b2c3d4e5f6-captured-mail.json',
  });
  for (const role of ['identity', 'merchant', 'commerce']) {
    for (const mode of ['next', 'next-production']) {
      const kind = `${role}-${mode}`;
      assert.equal(threadlineFixtureLogPath(input.runId, kind), `/private/tmp/threadline-${input.runId}-${kind}.log`);
    }
  }
  for (const kind of ['../owner', 'merchant-next\n', 'console-next', 'merchant-next/../../owner']) {
    assert.throws(() => threadlineFixtureLogPath(input.runId, kind));
  }
});

test('Editor data setup requires the exact opt-in and refuses simultaneous Threadline QA', () => {
  assert.equal(threadlineFixtureProfile({}), 'threadline');
  assert.equal(threadlineFixtureProfile({ threadlineQa: '1' }), 'threadline-qa');
  assert.equal(threadlineFixtureProfile({ editorHold: '1' }), 'editor');
  for (const flag of ['true', 'yes', '0', '1\n', '']) assert.equal(threadlineFixtureProfile({ editorHold: flag }), 'threadline');
  assert.throws(() => threadlineFixtureProfile({ editorHold: '1', threadlineQa: '1' }), /cannot run together/);
});

test('manual marketplace opt-in binds only its exact run-scoped origin to the existing shared client environment', () => {
  const origins = threadlineFixtureOrigins({ ...input, marketplacePort: 9015 });
  assert.deepEqual(origins.sharedEnvironment, {
    NEXT_PUBLIC_ACCOUNTS_URL: origins.identityOrigin,
    NEXT_PUBLIC_ADMIN_URL: origins.merchantOrigin,
    NEXT_PUBLIC_THEME_MARKETPLACE_URL: 'http://themes.threadline-a1b2c3d4e5f6.localhost:9015',
  });
  assert.equal('COOKIE_DOMAIN' in origins.sharedEnvironment, false);
  assert.deepEqual(origins.identityEnvironment, threadlineFixtureOrigins(input).identityEnvironment);
  const other = threadlineFixtureOrigins({ ...input, runId: '123456abcdef', marketplacePort: 9015 });
  assert.notEqual(other.sharedEnvironment.NEXT_PUBLIC_THEME_MARKETPLACE_URL, origins.sharedEnvironment.NEXT_PUBLIC_THEME_MARKETPLACE_URL);
  for (const marketplacePort of [0, 1023, 65536, 9015.5, Number.NaN, input.identityPort, input.merchantPort, input.commercePort]) {
    assert.throws(() => threadlineFixtureOrigins({ ...input, marketplacePort }));
  }
});

test('manual marketplace port parsing keeps all default profiles unchanged and refuses QA or Editor opt-ins', () => {
  for (const profile of ['threadline', 'threadline-qa', 'editor'] as const) {
    assert.equal(threadlineFixtureMarketplacePort(profile, undefined), undefined);
  }
  for (const port of ['1024', '9015', '65535']) assert.equal(threadlineFixtureMarketplacePort('threadline', port), Number(port));
  for (const port of ['', '0', '1023', '65536', '9015.5', '09015', '9015\n', ' 9015', 'NaN', 'http://localhost:9015']) {
    assert.throws(() => threadlineFixtureMarketplacePort('threadline', port));
  }
  for (const profile of ['threadline-qa', 'editor'] as const) assert.throws(() => threadlineFixtureMarketplacePort(profile, '9015'));
});

const editorData = { runId: input.runId, storeId: '11111111-1111-4111-8111-111111111111', commerceOrigin: 'http://syn-editor-new.localhost:4103' };

test('actual Editor fixture commands cover all nine common and exactly five supported inline variant fact namespaces', () => {
  const prepared = themeEditorFixtureProductCommands(editorData);
  assert.equal(prepared.length, 14);
  assert.equal(new Set(prepared.map(row => row.key)).size, 14);
  const common = new Set(prepared.flatMap(row => Object.keys(row.command.metadata)));
  for (const key of ['toys','electronics','food','furniture','gifts','personalization','beauty','sports','books']) assert.ok(common.has(key));
  const variants = new Set(prepared.flatMap(row => row.command.variants.flatMap(variant => Object.keys(variant.metadata || {}))));
  assert.deepEqual([...variants].sort(), ['books','food','furniture','sports','toys']);
  for (const { command } of prepared) {
    assert.equal(command.store_id, editorData.storeId);
    assert.equal(command.charge_tax, false);
    for (const image of command.images) assert.equal(new URL(image).origin, editorData.commerceOrigin);
    for (const variant of command.variants) assert.equal('id' in variant, false, 'creation never guesses a durable variant UUID');
  }
});

test('owner Pantry and same-colour Dewdrop fixture identities retain exact distinct prices, stock and unknown facts', () => {
  const prepared = themeEditorFixtureProductCommands(editorData);
  const lentils = prepared.find(row => row.key === 'lentils')!.command;
  assert.deepEqual(lentils.variants.map(row => [row.options.Pack, row.price, row.stock]), [['250 g',180,4],['500 g',340,0],['750 g label only',210,2]]);
  assert.deepEqual(lentils.variants[0].metadata?.food?.netQuantity, { value: 250, unit: 'g' });
  assert.equal(lentils.variants[2].metadata?.food, null);
  assert.equal(prepared.find(row => row.key === 'rice')!.command.stock, 4);
  const tint = prepared.find(row => row.key === 'tint')!.command;
  assert.deepEqual(tint.variants.map(row => [row.options['Shade name'], row.price, row.stock]), [['Rosewater',520,4],['Pink Clay',560,4],['Terracotta',590,0]]);
  assert.ok(tint.variants.every(row => row.options['पैक आकार'] === 'एक इकाई' && !('beauty' in (row.metadata || {}))));
  const beauty = tint.metadata.beauty as { shades: Array<{value: string; color: string; code: string}> };
  assert.equal(beauty.shades[0].color, beauty.shades[1].color);
  assert.notEqual(beauty.shades[0].value, beauty.shades[1].value);
  assert.notEqual(beauty.shades[0].code, beauty.shades[1].code);
  const gift = prepared.find(row => row.key === 'gifts')!.command;
  assert.equal(gift.images.length, 2);
  assert.deepEqual((gift.metadata.gifts as {mediaRoles: unknown}).mediaRoles, { openBox: 0, closedBox: 1 });
});

test('fixture data refuses real or unbound origins/IDs and binds a second run without reusing SKUs or handles', () => {
  for (const commerceOrigin of ['https://real.example','http://localhost:4103','http://syn--.localhost:4103','http://syn-owner.localhost:80','http://syn-owner.localhost:4103/path','http://user:pass@syn-owner.localhost:4103','http://syn-owner.localhost:4103?token=x']) {
    assert.throws(() => themeEditorFixtureProductCommands({ ...editorData, commerceOrigin }));
  }
  assert.throws(() => themeEditorFixtureProductCommands({ ...editorData, runId: '../owner' }));
  assert.throws(() => themeEditorFixtureProductCommands({ ...editorData, storeId: 'unknown' }));
  const first = themeEditorFixtureProductCommands(editorData), next = themeEditorFixtureProductCommands({ ...editorData, runId: '123456abcdef' });
  for (let index = 0; index < first.length; index++) {
    assert.notEqual(first[index].command.sku, next[index].command.sku);
    assert.notEqual(first[index].command.url_handle, next[index].command.url_handle);
  }
});


test('Marginalia stationery stays a separate unvarianted product with actual ruling and no book-only facts', () => {
  const prepared = themeEditorFixtureProductCommands(editorData);
  const paper = prepared.find(row => row.key === 'stationery')!.command;
  const book = prepared.find(row => row.key === 'books')!.command;
  assert.notEqual(paper.url_handle, book.url_handle);
  assert.equal(paper.price, 320); assert.equal(paper.stock, 6);
  assert.deepEqual(paper.variants, []); assert.deepEqual(paper.product_options, []);
  const facts = paper.metadata.books as Record<string, unknown>;
  assert.deepEqual({kind: facts.kind, ruling: facts.ruling, paper_gsm: facts.paper_gsm, page_count: facts.page_count, sheet_count: facts.sheet_count},
    {kind: 'stationery', ruling: 'lined', paper_gsm: 100, page_count: 96, sheet_count: 48});
  assert.deepEqual(facts.dimensions_mm, {width: 148, height: 210});
  for (const key of ['authors','language','format','isbn']) assert.equal(key in facts, false);
  assert.equal((book.metadata.books as {kind: string}).kind, 'book');
  assert.equal(book.variants.length, 2);
  assert.equal(paper.images[0], editorData.commerceOrigin + '/theme-assets/marginalia/v2/notebook.webp');
});
