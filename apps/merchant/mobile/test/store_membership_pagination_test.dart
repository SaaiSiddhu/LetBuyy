// Actual SDK/Dio membership paging. Synthetic responses; no external requests.
import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/config/app_config.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:letbuyy_store/services/store_service.dart';

Map<String, dynamic> member(int n) => {
  'id': '00000000-0000-4000-8000-${n.toString().padLeft(12, '0')}',
  'name': 'Synthetic membership $n',
  'subdomain': 'synthetic-membership-$n',
};

Map<String, dynamic> membershipPage(int number, {int total = 53}) => {
  'data': [
    for (var n = (number - 1) * 50 + 1; n <= total && n <= number * 50; n++)
      member(n),
  ],
  'meta': {
    'page': number,
    'per_page': 50,
    'total': total,
    'total_pages': (total / 50).ceil(),
    'has_next': number * 50 < total,
    'has_prev': number > 1,
  },
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test(
    'complete actor membership discovery includes page two before publication',
    () async {
      final requests = <RequestOptions>[];
      final entered = Completer<void>(), release = Completer<void>();
      final api = ApiClient(
        baseUrl: 'https://gateway.test/v1',
        tokenProvider: () => 'synthetic-token',
        storeIdProvider: () => member(53)['id'] as String,
        contextVersionProvider: () => 7,
        maxRetries: 0,
      );
      addTearDown(api.close);
      api.dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (r, h) async {
            requests.add(r);
            final number = r.queryParameters['page'] as int? ?? 1;
            if (number == 2) {
              entered.complete();
              await release.future;
            }
            h.resolve(
              Response(
                requestOptions: r,
                statusCode: 200,
                data: membershipPage(number),
              ),
            );
          },
        ),
      );
      final cache = CacheService.memory();
      final service = StoreService(api: api, cache: cache);
      addTearDown(service.dispose);
      final result = service.fetchStores();
      await Future.any([entered.future, result]);
      expect(
        entered.isCompleted,
        isTrue,
        reason: 'discovery must request the second canonical page',
      );
      expect(
        service.stores,
        isEmpty,
        reason:
            'a partial first page cannot be published as the complete membership list',
      );
      expect(cache.readJsonList(CacheService.storesKey), isEmpty);
      release.complete();
      expect((await result).map((s) => s.id), [
        for (var n = 1; n <= 53; n++) member(n)['id'],
      ]);
      expect(requests.map((r) => r.queryParameters['page']), [1, 2]);
      for (final r in requests) {
        expect(r.queryParameters['limit'], 50);
        expect(r.headers.containsKey('X-Store-ID'), isFalse);
        expect(r.headers['Authorization'], 'Bearer synthetic-token');
        expect(r.queryParameters.containsKey('actor_id'), isFalse);
      }
    },
  );

  test(
    'saved selection beyond the first page survives normal store restoration',
    () async {
      final last = member(53)['id'] as String;
      final key =
          'letbuyy.selected_store_id.${AppConfig.persistenceNamespace(environmentName: 'local')}';
      SharedPreferences.setMockInitialValues({key: last});
      final api = ApiClient(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
      addTearDown(api.close);
      api.dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (r, h) {
            h.resolve(
              Response(
                requestOptions: r,
                statusCode: 200,
                data: membershipPage(r.queryParameters['page'] as int? ?? 1),
              ),
            );
          },
        ),
      );
      final service = StoreService(api: api);
      final stores = StoreContext(storeService: service, environment: 'local');
      addTearDown(service.dispose);
      addTearDown(stores.dispose);
      expect((await stores.ensureSelectedStore())?.id, last);
      expect(stores.stores.length, 53);
      expect((await SharedPreferences.getInstance()).getString(key), last);
    },
  );

  for (final defect in [
    'duplicate',
    'count-change',
    'missing-tail',
    'incorrect-page',
    'false-end',
    'missing-total',
    'wrong-size',
  ]) {
    test(
      '$defect cannot publish a partial or contradictory complete store list',
      () async {
        final api = ApiClient(
          baseUrl: 'https://gateway.test/v1',
          maxRetries: 0,
        );
        addTearDown(api.close);
        api.dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (r, h) {
              final number = r.queryParameters['page'] as int? ?? 1;
              final body = membershipPage(number);
              if (number == 2) {
                final meta = body['meta'] as Map<String, dynamic>;
                switch (defect) {
                  case 'duplicate':
                    (body['data'] as List)[0] = member(1);
                  case 'count-change':
                    meta['total'] = 54;
                  case 'missing-tail':
                    (body['data'] as List).removeLast();
                  case 'incorrect-page':
                    meta['page'] = 1;
                  case 'false-end':
                    meta['has_next'] = true;
                  case 'missing-total':
                    meta.remove('total');
                  case 'wrong-size':
                    meta['per_page'] = 49;
                }
              }
              h.resolve(
                Response(requestOptions: r, statusCode: 200, data: body),
              );
            },
          ),
        );
        final cache = CacheService.memory();
        final service = StoreService(api: api, cache: cache);
        addTearDown(service.dispose);
        await expectLater(
          service.fetchStores(),
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'unverified population',
              'STORE_LIST_UNVERIFIED',
            ),
          ),
        );
        expect(service.stores, isEmpty);
        expect(cache.readJsonList(CacheService.storesKey), isEmpty);
      },
    );
  }

  for (final retirement in ['store', 'session']) {
    test(
      'retired $retirement in the tail page cannot replace current stores or cache',
      () async {
        final prefs = await SharedPreferences.getInstance();
        late StoreContext stores;
        var session = 0, initial = true;
        final entered = Completer<void>(), release = Completer<void>();
        final api = ApiClient(
          baseUrl: 'https://gateway.test/v1',
          maxRetries: 0,
          storeIdProvider: () => stores.selectedStoreId,
          contextVersionProvider: () => (session, stores.requestContextKey),
        );
        addTearDown(api.close);
        api.dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (r, h) async {
              final number = r.queryParameters['page'] as int;
              if (number == 2) {
                entered.complete();
                await release.future;
              }
              h.resolve(
                Response(
                  requestOptions: r,
                  statusCode: 200,
                  data: membershipPage(number, total: initial ? 2 : 53),
                ),
              );
            },
          ),
        );
        final cache = CacheService.memory();
        final service = StoreService(api: api, cache: cache);
        stores = StoreContext(
          storeService: service,
          prefs: prefs,
          environment: 'local',
        );
        addTearDown(stores.dispose);
        addTearDown(service.dispose);
        await stores.bindActor('synthetic-actor');
        await stores.ensureSelectedStore();
        expect(stores.stores.length, 2);
        initial = false;
        final pending = stores.loadStores(force: true);
        final rejected = expectLater(
          pending,
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'retired',
              'SESSION_CONTEXT_CHANGED',
            ),
          ),
        );
        await entered.future;
        if (retirement == 'store') {
          await stores.selectStoreById(member(2)['id'] as String);
        } else {
          session++;
        }
        release.complete();
        await rejected;
        final expected = member(retirement == 'store' ? 2 : 1)['id'];
        expect(stores.selectedStoreId, expected);
        expect(service.currentStore?.id, expected);
        expect(stores.stores.length, 2);
        expect(service.stores.length, 2);
        expect(cache.readJsonList(CacheService.storesKey).length, 2);
      },
    );
  }

  test(
    'a failed tail request never caches or exposes the first page',
    () async {
      final api = ApiClient(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
      addTearDown(api.close);
      api.dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (r, h) {
            final number = r.queryParameters['page'] as int;
            h.resolve(
              Response(
                requestOptions: r,
                statusCode: number == 1 ? 200 : 503,
                data: number == 1
                    ? membershipPage(number)
                    : {
                        'error': {
                          'code': 'SYNTHETIC_OUTAGE',
                          'message': 'Unavailable',
                        },
                      },
              ),
            );
          },
        ),
      );
      final cache = CacheService.memory();
      final service = StoreService(api: api, cache: cache);
      addTearDown(service.dispose);
      await expectLater(service.fetchStores(), throwsA(isA<ApiException>()));
      expect(service.stores, isEmpty);
      expect(cache.readJsonList(CacheService.storesKey), isEmpty);
    },
  );

  test(
    'confirmed zero memberships stays empty without fabricating a second page',
    () async {
      var calls = 0;
      final api = ApiClient(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
      addTearDown(api.close);
      api.dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (r, h) {
            calls++;
            h.resolve(
              Response(
                requestOptions: r,
                statusCode: 200,
                data: membershipPage(1, total: 0),
              ),
            );
          },
        ),
      );
      final service = StoreService(api: api);
      addTearDown(service.dispose);
      expect(await service.fetchStores(), isEmpty);
      expect(calls, 1);
    },
  );
}
