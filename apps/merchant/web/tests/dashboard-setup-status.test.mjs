import assert from 'node:assert/strict'
import test from 'node:test'

import setupStatus from '../src/app/[store]/dashboard/dashboard-setup-status.ts'

const {
  buildPageSetupStatus,
  buildStoreSetupStatus,
  isPaymentConfigured,
  resolveDashboardDomain,
} = setupStatus

const paymentConfig = (overrides = {}) => ({
  cod_enabled: false,
  online_payment_enabled: false,
  payment_settings: { mode: 'ownAccount', razorpay: null },
  ...overrides,
})

test('valid empty responses are available and incomplete', () => {
  const status = buildStoreSetupStatus({
    productsTotal: 0,
    shippingZones: [],
    paymentConfig: paymentConfig(),
    themeCustomized: false,
    domainConfigured: false,
  })

  assert.equal(status.primaryAvailable, true)
  assert.equal(status.primaryComplete, false)
  assert.equal(status.shippingAvailable, true)
  assert.equal(status.hasShipping, false)
  assert.equal(status.paymentAvailable, true)
  assert.equal(status.paymentConfigured, false)
})

test('failed product, shipping, and payment reads remain unknown', () => {
  const status = buildStoreSetupStatus({
    productsTotal: null,
    shippingZones: null,
    paymentConfig: null,
    themeCustomized: false,
    domainConfigured: false,
  })

  assert.equal(status.primaryAvailable, false)
  assert.equal(status.primaryComplete, false)
  assert.equal(status.shippingAvailable, false)
  assert.equal(status.hasShipping, false)
  assert.equal(status.paymentAvailable, false)
  assert.equal(status.paymentConfigured, false)
})

test('a failed page read is unknown while an empty page list is incomplete', () => {
  const failed = buildPageSetupStatus({ pagesTotal: null, themeCustomized: false, domainConfigured: false })
  const empty = buildPageSetupStatus({ pagesTotal: 0, themeCustomized: false, domainConfigured: false })

  assert.equal(failed.primaryAvailable, false)
  assert.equal(empty.primaryAvailable, true)
  assert.equal(empty.primaryComplete, false)
})

test('payment readiness follows COD, shared, and verified own-account rules', () => {
  assert.equal(isPaymentConfigured(paymentConfig({ cod_enabled: true })), true)
  assert.equal(isPaymentConfigured(paymentConfig({
    online_payment_enabled: true,
    payment_settings: { mode: 'shared' },
  })), true)
  assert.equal(isPaymentConfigured(paymentConfig({
    online_payment_enabled: true,
    payment_settings: {
      mode: 'ownAccount',
      razorpay: { secret_configured: true, verified: true },
    },
  })), true)
  assert.equal(isPaymentConfigured(paymentConfig({
    online_payment_enabled: true,
    payment_settings: {
      mode: 'ownAccount',
      razorpay: { secret_configured: true, verified: false },
    },
  })), false)
})

test('dashboard domain uses the ready default host until a custom domain is active', () => {
  assert.deepEqual(resolveDashboardDomain({
    subdomain: 'shop-one',
    customDomain: null,
    customDomainStatus: 'none',
  }), { domain: 'shop-one.letbuyy.com', configured: true })

  assert.deepEqual(resolveDashboardDomain({
    subdomain: 'shop-one',
    customDomain: 'shop.example.test',
    customDomainStatus: 'pending',
  }), { domain: 'shop-one.letbuyy.com', configured: true })

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
