// Actual SDK request preparation with controlled HTTP responses; no provider proof.
import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

void main() {
  test(
    'challenge retries and completion preserve exact command, context and approval headers',
    () async {
      final dio = Dio(), calls = <RequestOptions>[];
      var epoch = 1;
      final api = ApiClient(
        baseUrl: 'https://gateway.test/v1',
        tokenProvider: () => 'synthetic-session-a',
        storeIdProvider: () => 'site-a',
        contextVersionProvider: () => epoch,
        dio: dio,
        maxRetries: 0,
      );
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (request, handler) {
            calls.add(request);
            handler.resolve(
              Response(
                requestOptions: request,
                statusCode: 200,
                data: {
                  'data': {'accepted': true},
                },
              ),
            );
          },
        ),
      );
      final input = {
        'store_id': 'site-a',
        'factor_id': 'factor-a',
        'action': 'refund.approve',
        'code': '123456',
        'idempotency_key': 'synthetic-challenge-key',
      };
      for (var n = 0; n < 2; n++) {
        await api.security.challenge(
          input,
          options: const ApiRequestOptions(
            idempotencyKey: 'synthetic-challenge-key',
            expectedContextVersion: 1,
          ),
        );
      }
      expect(calls.length, 2);
      expect(calls.first.path, endsWith('/v1/security/step-up/challenges'));
      expect(calls.first.data, calls.last.data);
      expect(
        calls.first.headers['X-Idempotency-Key'],
        calls.last.headers['X-Idempotency-Key'],
      );
      await api.orders.completeRefund(
        'order-a',
        {'refund_id': 'refund-a', 'idempotency_key': 'synthetic-complete-key'},
        options: const ApiRequestOptions(
          idempotencyKey: 'synthetic-complete-key',
          expectedContextVersion: 1,
          headers: {
            'X-Step-Up-Token': 'synthetic-proof',
            'X-Step-Up-Verified-At': '2026-10-16T12:00:00Z',
          },
        ),
      );
      expect(calls.last.headers['X-Step-Up-Token'], 'synthetic-proof');
      expect(calls.last.headers['X-Store-ID'], 'site-a');
      expect(calls.last.headers['Authorization'], 'Bearer synthetic-session-a');
      epoch = 2;
      await expectLater(
        api.security.challenge(
          input,
          options: const ApiRequestOptions(
            idempotencyKey: 'synthetic-challenge-key',
            expectedContextVersion: 1,
          ),
        ),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      expect(calls.length, 3);
      api.close();
    },
  );
}
