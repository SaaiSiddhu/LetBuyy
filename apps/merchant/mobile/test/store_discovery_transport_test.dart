// Actual SDK/Dio headers; controlled responses, no external requests.
import 'dart:async';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uuid/uuid.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/store_service.dart';

const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
Map<String, dynamic> row(String id) => {
  'id': id,
  'name': 'Synthetic store $id',
  'subdomain': 'synthetic-${id.substring(0, 8)}',
};
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final selected in [a, b]) {
    test(
      'actor-wide discovery clears only selected-store hint $selected',
      () async {
        final session = const Uuid().v4();
        final requests = <RequestOptions>[];
        final api = ApiClient(
          baseUrl: 'https://gateway.test/v1',
          tokenProvider: () => session,
          storeIdProvider: () => selected,
          contextVersionProvider: () => 7,
          maxRetries: 0,
        );
        addTearDown(api.close);
        api.dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (request, handler) {
              requests.add(request);
              handler.resolve(
                Response(
                  requestOptions: request,
                  statusCode: 200,
                  data: request.path.endsWith('/stores')
                      ? {
                          'data': [row(a), row(b)],
                          'meta': {
                            'page': 1,
                            'per_page': 50,
                            'total': 2,
                            'total_pages': 1,
                            'has_next': false,
                            'has_prev': false,
                          },
                        }
                      : {'data': row(selected)},
                ),
              );
            },
          ),
        );
        await api.stores.get(selected);
        expect(
          requests.last.headers['X-Store-ID'],
          selected,
          reason: 'positive selected-store control',
        );
        final service = StoreService(api: api);
        addTearDown(service.dispose);
        final stores = await service.fetchStores();
        expect(stores.map((x) => x.id), [a, b]);
        final discovery = requests.last;
        expect(
          discovery.headers.containsKey('X-Store-ID'),
          isFalse,
          reason:
              'discovery must include the current actor accessible population, not only its selected tenant',
        );
        expect(discovery.headers['Authorization'] == 'Bearer $session', isTrue);
        expect(discovery.queryParameters.containsKey('actor_id'), isFalse);
        await api.stores.update(selected, {
          'name': 'Synthetic current-store edit',
        });
        expect(requests.last.method, 'PATCH');
        expect(
          requests.last.headers['X-Store-ID'],
          selected,
          reason: 'global discovery cannot clear scope on later commands',
        );
        expect(
          requests.last.headers['Authorization'] == 'Bearer $session',
          isTrue,
        );
        expect(requests.last.headers['X-Idempotency-Key'] is String, isTrue);
      },
    );
  }
  for (final retirement in ['store', 'session']) {
    test(
      'retired $retirement discovery cannot erase the newer selected store',
      () async {
        SharedPreferences.setMockInitialValues({});
        final prefs = await SharedPreferences.getInstance();
        late StoreContext stores;
        var sessionVersion = 0;
        final entered = Completer<void>(), release = Completer<void>();
        var calls = 0;
        final api = ApiClient(
          baseUrl: 'https://gateway.test/v1',
          maxRetries: 0,
          storeIdProvider: () => stores.selectedStoreId,
          contextVersionProvider: () =>
              (sessionVersion, stores.requestContextKey),
        );
        addTearDown(api.close);
        api.dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (request, handler) async {
              calls++;
              if (calls == 2) {
                entered.complete();
                await release.future;
              }
              handler.resolve(
                Response(
                  requestOptions: request,
                  statusCode: 200,
                  data: {
                    'data': [row(a), row(b)],
                    'meta': {
                      'page': 1,
                      'per_page': 50,
                      'total': 2,
                      'total_pages': 1,
                      'has_next': false,
                      'has_prev': false,
                    },
                  },
                ),
              );
            },
          ),
        );
        final service = StoreService(api: api, cache: CacheService.memory());
        // The explicit service projection below must survive a retired reader.
        stores = StoreContext(
          storeService: service,
          prefs: prefs,
          environment: 'local',
        );
        addTearDown(stores.dispose);
        addTearDown(service.dispose);
        await stores.bindActor('synthetic-owner');
        await stores.ensureSelectedStore();
        expect(stores.selectedStoreId, a);
        expect(service.stores.length, 2);
        final pending = stores.loadStores(force: true);
        final rejected = expectLater(
          pending,
          throwsA(
            isA<ApiException>().having(
              (error) => error.code,
              'retired context',
              'SESSION_CONTEXT_CHANGED',
            ),
          ),
        );
        await entered.future;
        if (retirement == 'store')
          await stores.selectStoreById(b);
        else
          sessionVersion++;
        release.complete();
        await rejected;
        final current = retirement == 'store' ? b : a;
        expect(stores.selectedStoreId, current);
        expect(service.currentStore?.id, current);
        expect(service.stores.length, 2);
        expect(prefs.getKeys().map(prefs.getString), contains(current));
      },
    );
  }
}
