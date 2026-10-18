import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/subscription_catalog.dart';
import 'package:letbuyy_store/services/subscription_service.dart';

Map<String, dynamic> plan() => {
  'id': 'catalog-growth',
  'slug': 'growth',
  'name': 'Growth',
  'currency': 'INR',
  'is_active': true,
  'purchasable': true,
  'billing_amount_monthly_minor': 69900,
  'billing_amount_yearly_minor': 123400,
  'limits': {'products': null},
  'entitlements': {'custom_domain': true, 'api_access': false},
};
Map<String, dynamic> state(String status) => {
  'store': {'id': 'store-synthetic', 'trial_status': 'paid'},
  'subscription': {
    'id': 'sub-synthetic',
    'plan': 'growth',
    'status': status,
    'billing_period': 'yearly',
    'amount_paid': 123400,
    'products_limit': null,
    'current_period_end': '2027-10-15T00:00:00Z',
  },
};
void main() {
  test('invoice amounts always use minor units, preserve receipt identity and reject malformed money', () {
    final invoice = BillingHistoryEntry.fromJson({
      'id': 'invoice',
      'amount': 9900,
      'amount_paid': 123400,
      'payment_status': 'paid',
      'status': 'cancelled',
      'invoice_number': 'SYN-INVOICE-1',
      'tax_amount': 1782,
      'total_amount': 11682,
    });
    expect(invoice.amountLabel, 'INR 99.00');
    expect(
      () => BillingHistoryEntry.fromJson({
        'id': 'invoice',
        'amount': 9900,
        'currency': 'USD',
      }),
      throwsFormatException,
    );
    expect(invoice.status, 'paid');
    expect(invoice.invoiceNumber, 'SYN-INVOICE-1');
    expect(invoice.taxAmount, 1782);
    expect(invoice.totalAmount, 11682);
    for (final value in [null, -1, 0.1, double.infinity]) {
      expect(
        () => BillingHistoryEntry.fromJson({'id': 'invoice', 'amount': value}),
        throwsFormatException,
      );
    }
  });
  test('usage uses server snapshot and distinguishes unknown limits, zero limits and unlimited', () {
    final base = state('active');
    final s = MerchantBillingState.fromJson({
      ...base,
      'product_usage': {'count': 12, 'limit_known': true, 'limit': 100},
    });
    expect(s.productUsageLabel, '12 / 100 products');
    expect(s.productUsageFraction, 0.12);
    final unlimited = MerchantBillingState.fromJson({
      ...base,
      'product_usage': {'count': 12, 'limit_known': true, 'limit': null},
    });
    expect(unlimited.productUsageLabel, '12 products (Unlimited)');
    expect(unlimited.compactProductUsageLabel, '12 / ∞');
    final missing = MerchantBillingState.fromJson({
      ...base,
      'product_usage': {'count': 12, 'limit_known': false, 'limit': null},
    });
    expect(missing.productUsageLabel, '12 products • limit unavailable');
    expect(missing.productUsageFraction, isNull);
    final zero = MerchantBillingState.fromJson({
      ...base,
      'product_usage': {'count': 12, 'limit_known': true, 'limit': 0},
    });
    expect(zero.productUsageFraction, 1);
  });

  test('native catalog displays the exact server prices and explicit unlimited limit without client rate calculation', () {
    final p = MerchantBillingPlan.fromJson(plan());
    expect(p.slug, 'growth');
    expect(p.priceLabel('monthly'), '₹699');
    expect(p.priceLabel('yearly'), '₹1234');
    expect(p.productLimit, isNull);
    expect(p.features, ['Custom domain']);
    expect(p.purchasable, isTrue);
  });
  test('missing/fractional/foreign pricing and missing limits fail closed rather than using legacy prices or unlimited defaults', () {
    for (final value in [null, -1, 1.25, double.infinity]) {
      final row = plan()..['billing_amount_monthly_minor'] = value;
      expect(() => MerchantBillingPlan.fromJson(row), throwsFormatException);
    }
    expect(
      () => MerchantBillingPlan.fromJson(plan()..['currency'] = 'USD'),
      throwsFormatException,
    );
    expect(
      () => MerchantBillingPlan.fromJson(plan()..remove('limits')),
      throwsFormatException,
    );
  });
  test(
    'coming-soon/contact/inactive plans remain unavailable for checkout',
    () {
      for (final flag in [
        {'status': 'coming_soon'},
        {'requires_contact': true},
        {'purchasable': false},
        {'is_active': false},
      ]) {
        expect(
          MerchantBillingPlan.fromJson({...plan(), ...flag}).purchasable,
          isFalse,
        );
      }
    },
  );
  test('current canonical paid/cancelled/past-due/failed statuses retain their actual slug and amount', () {
    for (final status in ['active', 'cancelled', 'past_due', 'failed']) {
      final s = MerchantBillingState.fromJson(state(status));
      expect(s.planSlug, 'growth');
      expect(s.planName, 'Growth');
      expect(s.status, status);
      expect(s.amountPaidMinor, 123400);
      expect(s.billingPeriod, 'yearly');
      expect(s.active, status == 'active');
      expect(s.recoverable, ['past_due', 'failed'].contains(status));
    }
  });
  test('trial and missing subscription are distinct from a cancelled paid receipt or malformed billing response', () {
    final trial = MerchantBillingState.fromJson({
      'store': {'id': 'store-synthetic', 'trial_status': 'active'},
      'subscription': null,
    });
    expect(trial.planName, 'Trial');
    expect(trial.active, isFalse);
    final noPlan = MerchantBillingState.fromJson({
      'store': {'id': 'store-synthetic', 'trial_status': 'paid'},
      'subscription': null,
    });
    expect(noPlan.planName, 'No active subscription');
    expect(() => MerchantBillingState.fromJson({}), throwsFormatException);
  });
}
