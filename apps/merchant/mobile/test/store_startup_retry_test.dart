import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'store_membership_pagination_test.dart' show membershipPage;

void main() {
  test(
    'startup membership timeout surfaces after one attempt; explicit retry loads both pages',
    () async {
      final calls = <RequestOptions>[];
      var unavailable = true;
      // Use actual SDK defaults, including its two automatic retries.
      final api = ApiClient(baseUrl: 'https://synthetic.invalid/v1');
      addTearDown(api.close);
      api.dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (o, h) {
            calls.add(o);
            if (unavailable) {
              h.reject(
                DioException(
                  requestOptions: o,
                  type: DioExceptionType.receiveTimeout,
                ),
              );
            } else {
              h.resolve(
                Response(
                  requestOptions: o,
                  statusCode: 200,
                  data: membershipPage(o.queryParameters['page'] as int),
                ),
              );
            }
          },
        ),
      );
      final service = StoreService(api: api);
      addTearDown(service.dispose);
      await expectLater(service.fetchStores(), throwsA(isA<ApiException>()));
      expect(
        calls,
        hasLength(1),
        reason: 'Foreground startup must not multiply each transport timeout.',
      );
      expect(service.isLoading, isFalse);
      expect(service.stores, isEmpty);
      unavailable = false;
      final stores = await service.fetchStores();
      expect(stores, hasLength(53));
      expect(calls.skip(1).map((o) => o.queryParameters['page']), [1, 2]);
      expect(calls.every((o) => !o.headers.containsKey('X-Store-ID')), isTrue);
    },
  );
}
