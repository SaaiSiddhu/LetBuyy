import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/services/subscription_service.dart';

class PaymentTransport extends ApiClient {
  PaymentTransport() : super(baseUrl: 'https://gateway.test/v1');
  JsonMap? captured;
  bool fail = false;
  Completer<void>? hold;
  String? requestKey;
  String? capturedPath;
  HttpMethod? capturedMethod;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    expect(path, startsWith('/stores/synthetic-store'));
    capturedPath = path; capturedMethod = options?.method;
    captured = Map<String, dynamic>.from(options!.body as Map);
    requestKey = options.idempotencyKey;
    await hold?.future;
    if (fail) throw const ApiException(message: 'Synthetic unavailable', statusCode: 503, code: 'SYNTHETIC_UNAVAILABLE');
    return {'id': 'synthetic-store', 'name': 'Synthetic store', 'subdomain': 'synthetic-store', ...captured!};
  }
}
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('payment methods use canonical top-level fields and confirmed readback', () async {
    final api = PaymentTransport(); addTearDown(api.close);
    final service = StoreService(api: api);
    final saved = await service.updatePaymentSettings('synthetic-store', {'online_payment_enabled': false, 'cod_enabled': true});
    expect(api.capturedPath, '/stores/synthetic-store/payment-config');
    expect(api.capturedMethod, HttpMethod.patch);
    expect(api.captured, {'online_payment_enabled': false, 'cod_enabled': true});
    expect(api.captured!.containsKey('payment_settings'), false);
    expect(saved.onlineRequested, false); expect(saved.codEnabled, true);
  });
  test('method retry forwards the same key and exact revision to the canonical configuration command', () async {
    final api = PaymentTransport(); addTearDown(api.close);
    final service = StoreService(api: api);
    const revision = '2026-10-29T00:00:00Z';
    await service.updatePaymentSettings('synthetic-store', {'cod_enabled': true},
      expectedRevision: revision, idempotencyKey: 'synthetic-same-method-operation');
    expect(api.captured, {'cod_enabled': true, 'expected_revision': revision});
    expect(api.requestKey, 'synthetic-same-method-operation');
    expect(service.currentStore, isNull, reason: 'a partial payment config must not replace cached StoreModel');
  });
  test('unsupported or non-boolean payment data never reaches transport', () async {
    final api = PaymentTransport(); addTearDown(api.close);
    final service = StoreService(api: api);
    for (final invalid in <JsonMap>[{}, {'online_payment_enabled': 'false'}, {'mode': 'shared'}, {'key_secret': 'synthetic'}]) {
      await expectLater(service.updatePaymentSettings('synthetic-store', invalid), throwsFormatException);
      expect(api.captured, isNull);
    }
  });
  test('failed payment mutation does not invent a saved store', () async {
    final api = PaymentTransport()..fail = true; addTearDown(api.close);
    final service = StoreService(api: api);
    await expectLater(service.updatePaymentSettings('synthetic-store', {'cod_enabled': false}), throwsA(isA<ApiException>()));
    expect(service.currentStore, isNull);
  });
  test('late method response after account change cannot become a saved store', () async {
    final api = PaymentTransport()..hold = Completer<void>(); addTearDown(api.close);
    final service = StoreService(api: api);
    final pending = service.updatePaymentSettings('synthetic-store', {'cod_enabled': false});
    await Future<void>.delayed(Duration.zero);
    await service.clearSessionStores(); api.hold!.complete();
    await expectLater(pending, throwsA(isA<ApiException>().having((error) => error.code, 'code', 'SESSION_CONTEXT_CHANGED')));
    expect(service.currentStore, isNull); expect(service.stores, isEmpty);
  });
  test('credential save forwards original retry key and expected revision without enabling methods', () async {
    final api = PaymentTransport(); addTearDown(api.close);
    final service = SubscriptionService(api: api);
    final revision = DateTime.utc(2026, 10, 28).toIso8601String();
    await service.connectOwnRazorpay(storeId: 'synthetic-store', keyId: ['rzp','test','synthetic123'].join('_'),
        keySecret: List.filled(24, 's').join(), idempotencyKey: 'synthetic-same-save-operation', expectedRevision: revision);
    expect(api.requestKey, 'synthetic-same-save-operation'); expect(api.captured!['expected_revision'], revision);
    expect(api.captured!['test_mode'], true); expect(api.captured!.containsKey('online_payment_enabled'), false);
  });
}
