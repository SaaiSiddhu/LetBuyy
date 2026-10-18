import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/subscription_service.dart';

// Real SDK header/response processing and client storage lifecycle, with an
// explicit HTTP response seam. No database, device or provider effect proof.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
    'failed checkout survives service restart, isolates actor/store/terms and clears only after verified success',
    () async {
      var actor = 'actor-a', failCreate = true, failVerify = true;
      final requests = <RequestOptions>[], references = <String, String>{};
      final dio = Dio();
      final api = ApiClient(
        baseUrl: 'https://gateway.test/v1',
        dio: dio,
        maxRetries: 0,
        tokenProvider: () => 'synthetic-session-$actor',
      );
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            final verify = options.path.endsWith('/verify');
            final fail = verify ? failVerify : failCreate;
            if (verify) {
              failVerify = false;
            } else {
              failCreate = false;
            }
            final key = options.headers['X-Idempotency-Key'] as String;
            final reference = references.putIfAbsent(
              key,
              () => 'order-synthetic-${references.length}',
            );
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: fail ? 503 : 200,
                data: fail
                    ? {
                        'error': {
                          'code': 'SYNTHETIC_PENDING',
                          'message': 'Synthetic reply unavailable',
                        },
                      }
                    : {
                        'data': verify
                            ? {
                                'subscription': {
                                  'id': 'sub-synthetic',
                                  'status': 'active',
                                },
                              }
                            : {
                                'razorpay_order_id': reference,
                                'amount': 69900,
                                'currency': 'INR',
                              },
                      },
              ),
            );
          },
        ),
      );
      SubscriptionService service() =>
          SubscriptionService(api: api, actorIdProvider: () => actor);
      await expectLater(
        service().createSubscriptionOrder(
          storeId: 'store-a',
          plan: SubscriptionPlan.business,
        ),
        throwsA(isA<ApiException>()),
      );
      final key = requests.last.headers['X-Idempotency-Key'];
      final checkout = await service().createSubscriptionOrder(
        storeId: 'store-a',
        plan: SubscriptionPlan.business,
      );
      expect(requests.last.headers['X-Idempotency-Key'], key);
      await service().createSubscriptionOrder(
        storeId: 'store-b',
        plan: SubscriptionPlan.business,
      );
      final other = requests.last.headers['X-Idempotency-Key'];
      expect(other, isNot(key));
      actor = 'actor-b';
      await service().createSubscriptionOrder(
        storeId: 'store-a',
        plan: SubscriptionPlan.business,
      );
      expect(requests.last.headers['X-Idempotency-Key'], isNot(key));
      actor = 'actor-a';
      await service().createSubscriptionOrder(
        storeId: 'store-a',
        plan: SubscriptionPlan.business,
        billingPeriod: 'yearly',
      );
      expect(requests.last.headers['X-Idempotency-Key'], isNot(key));
      Future<Map<String, dynamic>> verify() =>
          service().verifySubscriptionPayment(
            storeId: 'store-a',
            plan: SubscriptionPlan.business,
            razorpayPaymentId: 'pay-synthetic-a',
            razorpaySignature: 'synthetic-signature',
            razorpayOrderId: checkout['razorpay_order_id'] as String,
          );
      await expectLater(verify(), throwsA(isA<ApiException>()));
      final verifyKey = requests.last.headers['X-Idempotency-Key'];
      await service().createSubscriptionOrder(
        storeId: 'store-a',
        plan: SubscriptionPlan.business,
      );
      expect(requests.last.headers['X-Idempotency-Key'], key);
      await verify();
      expect(requests.last.headers['X-Idempotency-Key'], verifyKey);
      await service().createSubscriptionOrder(
        storeId: 'store-a',
        plan: SubscriptionPlan.business,
      );
      expect(requests.last.headers['X-Idempotency-Key'], isNot(key));
      await service().createSubscriptionOrder(
        storeId: 'store-b',
        plan: SubscriptionPlan.business,
      );
      expect(requests.last.headers['X-Idempotency-Key'], other);
    },
  );
  test(
    'concurrent instances share one retained logical key and require a current account',
    () async {
      final keys = <String>[], dio = Dio();
      final api = ApiClient(
        baseUrl: 'https://gateway.test/v1',
        dio: dio,
        maxRetries: 0,
      );
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            keys.add(options.headers['X-Idempotency-Key'] as String);
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': {'razorpay_order_id': 'order-synthetic-shared'},
                },
              ),
            );
          },
        ),
      );
      SubscriptionService service() =>
          SubscriptionService(api: api, actorIdProvider: () => 'actor-a');
      await Future.wait([
        service().createSubscriptionOrder(
          storeId: 'store-a',
          plan: SubscriptionPlan.business,
        ),
        service().createSubscriptionOrder(
          storeId: 'store-a',
          plan: SubscriptionPlan.business,
        ),
      ]);
      expect(keys.toSet(), hasLength(1));
      await expectLater(
        SubscriptionService(api: api).createSubscriptionOrder(
          storeId: 'store-a',
          plan: SubscriptionPlan.business,
        ),
        throwsStateError,
      );
      expect(keys, hasLength(2));
    },
  );
}
