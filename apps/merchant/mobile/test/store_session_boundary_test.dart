import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:letbuyy_store/services/store_service.dart';

Map<String, dynamic> store(String id) => {
  'id': id,
  'name': 'Synthetic $id',
  'subdomain': id,
};

class StoreTransport extends ApiClient {
  StoreTransport() : super(baseUrl: 'https://gateway.test/v1');
  List<JsonMap> rows = [store('owner-store')];
  bool unavailable = false;
  int calls = 0;
  Completer<void>? hold;
  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    calls++;
    final captured = List<JsonMap>.from(rows);
    await hold?.future;
    if (unavailable)
      throw const ApiException(
        message: 'Synthetic unavailable',
        statusCode: 503,
        code: 'UNAVAILABLE',
      );
    return PaginatedResponse(
      data: captured,
      page: 1,
      limit: 50,
      total: captured.length,
      hasMore: false,
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));
  test('clearing a signed-out store context refetches and selects the signed-in owner store', () async {
    final api = StoreTransport();
    final service = StoreService(api: api);
    final context = StoreContext(storeService: service);
    expect((await context.ensureSelectedStore())?.id, 'owner-store');
    await context.clearSelection();
    expect(context.stores, isEmpty);
    expect(service.stores, isEmpty);
    expect(service.currentStore, isNull);
    expect((await context.ensureSelectedStore())?.id, 'owner-store');
    api.close();
  });
  test(
    'another account outage cannot revive the previous account store cache',
    () async {
      final api = StoreTransport(), cache = CacheService.memory();
      final service = StoreService(api: api, cache: cache);
      final context = StoreContext(storeService: service);
      await context.ensureSelectedStore();
      await context.clearSelection();
      api.unavailable = true;
      await expectLater(
        context.ensureSelectedStore(),
        throwsA(isA<ApiException>()),
      );
      expect(context.stores, isEmpty);
      expect(context.selectedStore, isNull);
      expect(service.currentStore, isNull);
      expect(cache.readJsonList(CacheService.storesKey), isEmpty);
      expect(
        cache.readJsonMap(CacheService.storeDetailKey('owner-store')),
        isNull,
      );
    },
  );
  test('an old delayed store list cannot repopulate context or fallback cache after logout', () async {
    final api = StoreTransport(), cache = CacheService.memory();
    api.hold = Completer<void>();
    final service = StoreService(api: api, cache: cache);
    final actual = StoreContext(storeService: service);
    final request = actual.ensureSelectedStore();
    await Future<void>.delayed(Duration.zero);
    await actual.clearSelection();
    api.hold!.complete();
    await expectLater(request, throwsA(isA<ApiException>()));
    expect(actual.stores, isEmpty);
    expect(actual.selectedStore, isNull);
    expect(service.stores, isEmpty);
    expect(cache.readJsonList(CacheService.storesKey), isEmpty);
  });
  test('direct account changes invalidate the prior picker even without an AuthWrapper route', () async {
    final api = StoreTransport();
    final service = StoreService(api: api);
    final context = StoreContext(storeService: service);
    await context.bindActor('owner-a');
    await context.ensureSelectedStore();
    await context.bindActor('staff-b');
    expect(context.stores, isEmpty);
    expect(context.selectedStore, isNull);
    expect(service.currentStore, isNull);
    // The same actor refreshing its session does not discard a valid selection.
    await context.ensureSelectedStore();
    await context.bindActor('staff-b');
    expect(context.selectedStoreId, 'owner-store');
    api.close();
  });
  test('private projection keys separate accounts and signed-out reads and writes are unavailable', () async {
    String? actor = 'owner-a';
    final cache = CacheService.memory(actorIdProvider: () => actor);
    await cache.writeJson(CacheService.storesKey, [store('private-a')]);
    actor = 'staff-b';
    expect(cache.readJsonList(CacheService.storesKey), isEmpty);
    await cache.writeJson(CacheService.storesKey, [store('private-b')]);
    actor = null;
    expect(cache.readJsonList(CacheService.storesKey), isEmpty);
    await cache.writeJson(CacheService.storesKey, [store('must-not-save')]);
    actor = 'owner-a';
    expect(
      cache.readJsonList(CacheService.storesKey).single['id'],
      'private-a',
    );
    actor = 'staff-b';
    expect(
      cache.readJsonList(CacheService.storesKey).single['id'],
      'private-b',
    );
  });
  test('a copied shared client refuses a late prior-context response before a consumer can cache it', () async {
    var epoch = 0;
    String? actor = 'owner-a';
    final cache = CacheService.memory(actorIdProvider: () => actor);
    final dio = Dio();
    final requestSeen = Completer<void>();
    late RequestInterceptorHandler held;
    late RequestOptions options;
    final root = ApiClient(
      baseUrl: 'https://gateway.test/v1',
      contextVersionProvider: () => epoch,
    );
    final api = root.withOptions(dio: dio, maxRetries: 0);
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (request, handler) {
          options = request;
          held = handler;
          requestSeen.complete();
        },
      ),
    );
    final request = api
        .requestJson('/stores')
        .then((result) => cache.writeJson(CacheService.storesKey, result));
    final failure = expectLater(
      request,
      throwsA(
        isA<ApiException>().having(
          (e) => e.code,
          'code',
          'SESSION_CONTEXT_CHANGED',
        ),
      ),
    );
    await requestSeen.future;
    epoch++;
    actor = 'staff-b';
    held.resolve(
      Response(
        requestOptions: options,
        statusCode: 200,
        data: {
          'data': {'private': 'owner-a'},
        },
      ),
    );
    await failure;
    expect(cache.readJsonMap(CacheService.storesKey), isNull);
  });
  test('the request key changes for store selection without changing the actor epoch', () async {
    final api = StoreTransport();
    api.rows = [store('store-a'), store('store-b')];
    final actual = StoreContext(storeService: StoreService(api: api));
    await actual.bindActor('actor-a');
    await actual.ensureSelectedStore();
    final key = actual.requestContextKey, epoch = actual.requestContextVersion;
    await actual.selectStoreById('store-b');
    expect(actual.requestContextVersion, epoch);
    expect(actual.requestContextKey, isNot(key));
    await actual.bindActor('actor-b');
    expect(actual.requestContextKey, isNot(key));
    api.close();
  });
  test('bootstrap binds and clears the old actor before selecting an existing replacement store', () async {
    final api = StoreTransport(),
        actual = StoreContext(storeService: StoreService(api: api));
    expect(
      (await actual.ensureSelectedStoreForActor('actor-a'))!.id,
      'owner-store',
    );
    api.rows = [store('replacement-store')];
    expect(
      (await actual.ensureSelectedStoreForActor('actor-b'))!.id,
      'replacement-store',
    );
    expect(actual.selectedStoreId, 'replacement-store');
    expect(api.calls, 2);
    api.close();
  });
  test('concurrent auth consumers share one canonical store discovery for the same actor', () async {
    final api = StoreTransport()..hold = Completer<void>(),
        actual = StoreContext(storeService: StoreService(api: api));
    final a = actual.ensureSelectedStoreForActor('actor-a'),
        b = actual.ensureSelectedStoreForActor('actor-a');
    await Future<void>.delayed(Duration.zero);
    expect(api.calls, 1);
    api.hold!.complete();
    expect((await a)!.id, 'owner-store');
    expect((await b)!.id, 'owner-store');
    api.close();
  });
  test('a late old-actor bootstrap cannot replace or clear a successfully loaded new actor', () async {
    final api = StoreTransport()..hold = Completer<void>(),
        actual = StoreContext(storeService: StoreService(api: api));
    final old = expectLater(
      actual.ensureSelectedStoreForActor('actor-a'),
      throwsA(
        isA<ApiException>().having(
          (e) => e.code,
          'code',
          'SESSION_CONTEXT_CHANGED',
        ),
      ),
    );
    await Future<void>.delayed(Duration.zero);
    final hold = api.hold!;
    api.hold = null;
    api.rows = [store('new-owner-store')];
    expect(
      (await actual.ensureSelectedStoreForActor('actor-b'))!.id,
      'new-owner-store',
    );
    hold.complete();
    await old;
    expect(actual.selectedStoreId, 'new-owner-store');
    expect(actual.stores.single.id, 'new-owner-store');
    api.close();
  });
  test('bootstrap failure remains an error; only successful empty discovery means onboarding', () async {
    final api = StoreTransport()..unavailable = true,
        actual = StoreContext(storeService: StoreService(api: api));
    await expectLater(
      actual.ensureSelectedStoreForActor('actor-a'),
      throwsA(isA<ApiException>()),
    );
    api.unavailable = false;
    api.rows = [];
    expect(await actual.ensureSelectedStoreForActor('actor-a'), isNull);
    await expectLater(
      actual.ensureSelectedStoreForActor(''),
      throwsA(
        isA<ApiException>().having(
          (e) => e.code,
          'code',
          'MERCHANT_IDENTITY_REQUIRED',
        ),
      ),
    );
    api.close();
  });
}
