import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/models/store_model.dart';

void main() {
  test('LetBuyy transaction fee is zero across plans and payment modes', () {
    for (final plan in ['trial', 'starter', 'business', 'professional']) {
      for (final mode in ['shared', 'notConnected', 'ownAccount']) {
        final store = StoreModel.fromJson({
          'id': 'synthetic-store',
          'name': 'Synthetic merchant',
          'subdomain': 'synthetic',
          'subscription_plan': plan,
          'payment_mode': mode,
          'commission_percent': 2,
        });
        expect(store.effectiveCommission, 0.0, reason: '$plan / $mode');
      }
    }
  });
}
