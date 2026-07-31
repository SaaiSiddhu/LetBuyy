import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveMerchantPricing,
  applyFoundingLockToPlan,
  resolvePlanPublicPricing,
  resolvePlanEntitlementSnapshot,
  getStoreBillingTierDefinition,
  planBillingAmountMinor,
  type BillingPlanCatalogRecord,
  type FoundingLock,
} from '../src/index.ts';

// Prices are INR MINOR (paise): ₹299 = 29900, ₹199 = 19900, ₹999 = 99900, ₹699 = 69900.
function launchPlan(overrides: Partial<BillingPlanCatalogRecord> = {}): BillingPlanCatalogRecord {
  return { id: 'p-launch', slug: 'launch', name: 'Launch', price_monthly_inr: 29900, price_yearly_inr: 29900, founding_price_inr: 19900, status: 'available', purchasable: true, ...overrides };
}
function growthPlan(overrides: Partial<BillingPlanCatalogRecord> = {}): BillingPlanCatalogRecord {
  return { id: 'p-growth', slug: 'growth', name: 'Growth', price_monthly_inr: 99900, price_yearly_inr: 99900, founding_price_inr: 69900, status: 'available', purchasable: true, ...overrides };
}
const founderLock: FoundingLock = { price_lock_enabled: true, is_founding_merchant: true, locked_launch_price: 19900, locked_growth_price: 69900 };
const noLock: FoundingLock = { price_lock_enabled: false };

test('public pricing exposes regular + founding + savings (launch ₹299→₹199)', () => {
  const p = resolvePlanPublicPricing(launchPlan());
  assert.equal(p.regularInr, 299);
  assert.equal(p.foundingInr, 199);
  assert.equal(p.savingsInr, 100);
  assert.equal(p.hasFounding, true);
  assert.equal(p.purchasable, true);
});

test('coming_soon plans are not purchasable', () => {
  const scale = resolvePlanPublicPricing({ id: 'p-scale', slug: 'scale', name: 'Scale', price_monthly_inr: 0, status: 'coming_soon', purchasable: false });
  assert.equal(scale.purchasable, false);
  assert.equal(scale.status, 'coming_soon');
});

test('applyFoundingLockToPlan overrides price for founders, no-op otherwise', () => {
  // Founder launch → locked.
  const locked = applyFoundingLockToPlan(launchPlan(), founderLock);
  assert.equal(locked.price_monthly_inr, 19900);
  assert.equal(locked.promo_price_inr, 0);
  // Non-founder → unchanged.
  const same = applyFoundingLockToPlan(launchPlan(), noLock);
  assert.equal(same.price_monthly_inr, 29900);
  // Founder growth → growth locked price.
  const lockedGrowth = applyFoundingLockToPlan(growthPlan(), founderLock);
  assert.equal(lockedGrowth.price_monthly_inr, 69900);
});

test('I1: a founder is charged the locked price, never catalog', () => {
  const founder = resolveMerchantPricing({ plan: launchPlan(), foundingLock: founderLock });
  assert.equal(founder.isFounding, true);
  assert.equal(founder.amountMinor, 19900); // ₹199 charged
  assert.equal(founder.monthlyInr, 199);
  assert.equal(founder.savingsInr, 100);

  const normal = resolveMerchantPricing({ plan: launchPlan(), foundingLock: noLock });
  assert.equal(normal.isFounding, false);
  assert.equal(normal.amountMinor, 29900); // ₹299 catalog
  assert.equal(normal.monthlyInr, 299);
});

test('I2: a future catalog price change does NOT affect an existing founder', () => {
  // Catalog raised to ₹399 AFTER allocation; founder lock still ₹199.
  const raisedCatalog = launchPlan({ price_monthly_inr: 39900, price_yearly_inr: 39900 });
  const founder = resolveMerchantPricing({ plan: raisedCatalog, foundingLock: founderLock });
  assert.equal(founder.amountMinor, 19900);   // still ₹199 — lock holds
  assert.equal(founder.monthlyInr, 199);
  assert.equal(founder.catalogMonthlyInr, 399);
  assert.equal(founder.savingsInr, 200);      // saves vs the NEW catalog

  // A non-founder pays the new catalog price.
  const normal = resolveMerchantPricing({ plan: raisedCatalog, foundingLock: noLock });
  assert.equal(normal.amountMinor, 39900);
});

test('founder growth pricing is the locked growth price (₹699)', () => {
  const founder = resolveMerchantPricing({ plan: growthPlan(), foundingLock: founderLock });
  assert.equal(founder.amountMinor, 69900);
  assert.equal(founder.monthlyInr, 699);
  assert.equal(founder.savingsInr, 300);
});

test('launch/growth tier definitions + entitlement snapshots exist', () => {
  assert.notEqual(getStoreBillingTierDefinition('launch'), null);
  assert.notEqual(getStoreBillingTierDefinition('growth'), null);
  const growth = resolvePlanEntitlementSnapshot('growth');
  assert.equal(growth.plan, 'growth');
  assert.equal(growth.entitlements.custom_domain, true);
  const launch = resolvePlanEntitlementSnapshot('launch');
  assert.equal(launch.entitlements.custom_domain, false);
});

test('lock-applied plan feeds planBillingAmountMinor to the locked amount', () => {
  // Proves the single-override-point design: the existing amount fn yields the lock.
  const locked = applyFoundingLockToPlan(growthPlan(), founderLock);
  assert.equal(planBillingAmountMinor(locked, 'monthly').amountMinor, 69900);
});
