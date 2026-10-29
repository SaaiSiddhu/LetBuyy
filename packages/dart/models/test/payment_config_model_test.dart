import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

void main() {
  Map<String, dynamic> ready({bool enabled = false}) => {
    'schema_ready': true,
    'online_payment_enabled': enabled,
    'cod_enabled': true,
    'provider_mode': 'sandbox',
    'payment_settings': {
      'mode': 'ownAccount',
      'razorpay': {'key_id': 'masked', 'verified': true, 'test_mode': true},
    },
    'setup': {
      'connection': 'own_account',
      'environment': 'sandbox',
      'can_enable_online': true,
      'online_checkout_available': enabled,
    },
  };
  test('missing or legacy shared configuration cannot grant readiness', () {
    for (final input in <Map<String, dynamic>>[
      {},
      {'mode': 'shared', 'verified': true},
      {'mode': 'ownAccount', 'verified': true},
    ]) {
      final model = PaymentConfigModel.fromMap(input, 'site');
      expect(model.isReady, false);
      expect(model.canEnableOnline, false);
      expect(model.onlineCheckoutAvailable, false);
      expect(model.providerEnvironment, isNull);
    }
    expect(PaymentConfigModel.unavailable('site').verified, false);
    expect(PaymentConfigModel.unavailable('site').isReady, false);
  });
  test('saved credentials and explicit activation are distinct', () {
    final disabled = PaymentConfigModel.fromMap(ready(), 'site');
    expect(disabled.canEnableOnline, true);
    expect(disabled.isReady, false);
    expect(disabled.codEnabled, true);
    expect(disabled.statusText, contains('off'));
    final enabled = PaymentConfigModel.fromMap(ready(enabled: true), 'site');
    expect(enabled.isReady, true);
    expect(enabled.providerEnvironment, 'sandbox');
    expect(enabled.statusText, 'Test checkout enabled');
  });
  test('missing setup conditions never infer checkout readiness', () {
    for (final field in [
      'connection',
      'environment',
      'can_enable_online',
      'online_checkout_available',
    ]) {
      final input = ready(enabled: true);
      (input['setup'] as Map).remove(field);
      expect(
        PaymentConfigModel.fromMap(input, 'site').isReady,
        false,
        reason: field,
      );
    }
    final live = ready(enabled: true);
    (live['setup'] as Map)['environment'] = 'live';
    expect(PaymentConfigModel.fromMap(live, 'site').isReady, false);
  });
  test('public settings never deserialize or serialize secrets', () {
    final input = {
      ...ready(),
      'razorpayKeySecret': 'synthetic-not-retained',
      'webhookSecret': 'synthetic-not-retained',
    };
    final model = PaymentConfigModel.fromMap(input, 'site');
    expect(model.razorpayKeySecret, isNull);
    expect(model.webhookSecret, isNull);
    expect(model.toMap().containsKey('razorpayKeySecret'), false);
    expect(model.toMap().containsKey('webhookSecret'), false);
    expect(model.toString(), isNot(contains('synthetic-not-retained')));
  });
  test(
    'unrecognized provider connection never changes the zero-rake policy',
    () {
      expect(
        PaymentConfigModel.unavailable('site').getCommissionMessage(5),
        contains('0%'),
      );
    },
  );
}
