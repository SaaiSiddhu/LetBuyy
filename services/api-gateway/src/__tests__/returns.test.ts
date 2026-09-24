import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routeSource = readFileSync(new URL('../routes/returns.ts', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const bffSource = readFileSync(new URL('../../../mobile-bff/src/index.ts', import.meta.url), 'utf8');
const checkoutCoreSource = readFileSync(new URL('../../../../packages/checkout-core/src/index.ts', import.meta.url), 'utf8');
const mobileBlockedSource = readFileSync(new URL('../../../../apps/merchant/mobile/lib/services/platform_blocked_service.dart', import.meta.url), 'utf8');

test('merchant returns route is mounted and mobile allowlisted', () => {
    assert.match(indexSource, /import returnsRouter from '\.\/routes\/returns'/);
    assert.match(indexSource, /api\.route\('\/returns', returnsRouter\)/);
    assert.match(bffSource, /'\/v1\/returns'/);
});

test('merchant returns contract uses checkout-core schemas and existing refund engine', () => {
    assert.match(checkoutCoreSource, /export const CreateReturnSchema/);
    assert.match(checkoutCoreSource, /export const CompleteReturnRefundSchema/);
    assert.match(routeSource, /CreateReturnSchema/);
    assert.match(routeSource, /new OrderExecutionAdapter\(db\)/);
    assert.match(routeSource, /service\.createRefund/);
    assert.match(routeSource, /complete_order_refund/);
});

test('merchant returns route verifies tenant ownership and removes S-022 block', () => {
    assert.match(routeSource, /verifySiteOwnership/);
    assert.match(routeSource, /resolveTenantContextForOrder/);
    assert.doesNotMatch(mobileBlockedSource, /MOBILE_RETURNS/);
    assert.doesNotMatch(mobileBlockedSource, /S-022/);
});
