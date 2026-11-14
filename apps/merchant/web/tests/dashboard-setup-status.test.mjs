import publicUrls from '../src/lib/public-urls.ts'
import { DEFAULT_STOREFRONT_DOMAIN } from '@letbuyy/shared-types'
import assert from 'node:assert/strict'
import test from 'node:test'

import setupStatus from '../src/app/[store]/dashboard/dashboard-setup-status.ts'

const {
  buildPageSetupStatus,
  buildStoreSetupStatus,
  resolveDashboardDomain,
} = setupStatus

test('dashboard cannot infer readiness when the canonical health read is unavailable', () => {
  const status = buildStoreSetupStatus(null)
  assert.equal(status.primaryAvailable, false)
  assert.equal(status.paymentAvailable, false)
  assert.equal(status.shippingAvailable, false)
  assert.equal(status.themeCustomized, false)
})

test('dashboard uses canonical evidence states rather than inferring from counts or payment settings', () => {
  const status = buildStoreSetupStatus({readiness:{checks:[
    {id:'catalog',status:'attention'}, {id:'payments',status:'ready'},
    {id:'shipping',status:'unknown'}, {id:'theme',status:'attention'}, {id:'domain',status:'unknown'},
  ]}})
  assert.equal(status.primaryAvailable, true)
  assert.equal(status.primaryComplete, false)
  assert.equal(status.paymentConfigured, true)
  assert.equal(status.shippingAvailable, false)
  assert.equal(status.themeCustomized, false)
  assert.equal(status.domainConfigured, false)
})

test('a failed page read is unknown while an empty page list is incomplete', () => {
  const failed = buildPageSetupStatus({ pagesTotal: null, themeCustomized: false, domainConfigured: false })
  const empty = buildPageSetupStatus({ pagesTotal: 0, themeCustomized: false, domainConfigured: false })

  assert.equal(failed.primaryAvailable, false)
  assert.equal(empty.primaryAvailable, true)
  assert.equal(empty.primaryComplete, false)
})

test('dashboard domain uses the ready default host until a custom domain is active', () => {
  assert.deepEqual(resolveDashboardDomain({
    subdomain: 'shop-one',
    customDomain: null,
    customDomainStatus: 'none',
  }), { domain: `shop-one.${DEFAULT_STOREFRONT_DOMAIN}`, configured: true })

  assert.deepEqual(resolveDashboardDomain({
    subdomain: 'shop-one',
    customDomain: 'shop.example.test',
    customDomainStatus: 'pending',
  }), { domain: `shop-one.${DEFAULT_STOREFRONT_DOMAIN}`, configured: true })

  assert.deepEqual(resolveDashboardDomain({
    subdomain: 'shop-one',
    customDomain: 'shop.example.test',
    customDomainStatus: 'active',
  }), { domain: 'shop.example.test', configured: true })

  assert.deepEqual(resolveDashboardDomain({
    subdomain: null,
    customDomain: null,
    customDomainStatus: 'none',
  }), { domain: null, configured: false })
})

test('storefront URLs use tenant hosts for the canonical apex and preserve explicit local paths', () => {
  const keys = ['NODE_ENV', 'NEXT_PUBLIC_STORE_ROOT_DOMAIN', 'NEXT_PUBLIC_STOREFRONT_URL']
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  try {
    process.env.NODE_ENV = 'production'
    delete process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN
    delete process.env.NEXT_PUBLIC_STOREFRONT_URL
    assert.equal(publicUrls.getStorefrontStoreUrl('shop-one'), `https://shop-one.${DEFAULT_STOREFRONT_DOMAIN}`)
    process.env.NEXT_PUBLIC_STOREFRONT_URL = `https://${DEFAULT_STOREFRONT_DOMAIN}:4443`
    assert.equal(publicUrls.getStorefrontStoreUrl('shop-one'), `https://shop-one.${DEFAULT_STOREFRONT_DOMAIN}:4443`)
    process.env.NEXT_PUBLIC_STOREFRONT_URL = 'http://localhost:3999'
    assert.equal(publicUrls.getStorefrontStoreUrl('shop-one'), 'http://localhost:3999/store/shop-one')
    process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN = 'stores.example.test'
    assert.equal(resolveDashboardDomain({subdomain:'shop-one'}).domain, 'shop-one.stores.example.test')
    delete process.env.NEXT_PUBLIC_STOREFRONT_URL
    assert.equal(publicUrls.getStorefrontStoreUrl('shop-one'), 'https://shop-one.stores.example.test')
    assert.equal(publicUrls.getAccountsUrl(), 'https://accounts.letbuyy.com')
    assert.equal(publicUrls.getAdminUrl(), 'https://admin.letbuyy.com')
  } finally {
    for(const key of keys) if(previous[key]===undefined) delete process.env[key]; else process.env[key]=previous[key]
  }
})
