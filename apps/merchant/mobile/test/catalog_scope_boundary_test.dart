import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/products/products_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/services/store_service.dart';

Map<String, dynamic> product(String site, String name) => {
  'id': 'product_$name',
  'store_id': site,
  'name': name,
  'price': 129.75,
  'stock': 3,
  'is_active': true,
  'created_at': '2026-10-01T00:00:00Z',
};
void respond(
  RequestOptions r,
  RequestInterceptorHandler h,
  Object data, {
  int status = 200,
  bool more = false,
}) => h.resolve(
  Response(
    requestOptions: r,
    statusCode: status,
    data: {
      'data': data,
      'meta': {'has_next': more, 'next_cursor': more ? 'synthetic-next' : null},
    },
  ),
);
ApiClient client(
  void Function(RequestOptions, RequestInterceptorHandler) handler, {
  Object? Function()? scope,
}) {
  final dio = Dio();
  final result = ApiClient(
    baseUrl: 'https://gateway.test/v1',
    dio: dio,
    maxRetries: 0,
    contextVersionProvider: scope,
  );
  dio.interceptors.add(InterceptorsWrapper(onRequest: handler));
  addTearDown(result.close);
  return result;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'catalog cursor transport trims input, preserves the returned cursor and retires it on a failed different page',
    () async {
      final queries = <Map<String, dynamic>>[];
      final api = client((r, h) {
        queries.add(Map<String, dynamic>.from(r.queryParameters));
        respond(
          r,
          h,
          r.queryParameters['cursor'] == 'unavailable'
              ? {}
              : [product('a', 'Current cursor page')],
          status: r.queryParameters['cursor'] == 'unavailable' ? 503 : 200,
          more: true,
        );
      });
      final service = ProductService(api: api, cache: CacheService.memory());
      await service.fetchProducts('a', cursor: '  opaque-current-cursor  ');
      expect(queries.single['cursor'], 'opaque-current-cursor');
      expect(service.productsNextCursor, 'synthetic-next');
      await expectLater(
        service.fetchProducts('a', cursor: 'unavailable'),
        throwsA(isA<ApiException>()),
      );
      expect(service.productsNextCursor, isNull);
      expect(service.products, isEmpty);
      await service.fetchProducts('a', cursor: '   ');
      expect(queries.last.containsKey('cursor'), isFalse);
    },
  );
  test(
    'new queries and pages never reuse another loaded page on failure',
    () async {
      final api = client(
        (r, h) => respond(
          r,
          h,
          r.queryParameters['page'] == 1 && r.queryParameters['search'] == null
              ? [product('a', 'First')]
              : {},
          status:
              r.queryParameters['page'] == 1 &&
                  r.queryParameters['search'] == null
              ? 200
              : 503,
        ),
      );
      final service = ProductService(api: api, cache: CacheService.memory());
      await service.fetchProducts('a');
      await expectLater(
        service.fetchProducts('a', page: 2),
        throwsA(isA<ApiException>()),
      );
      expect(service.products, isEmpty);
      await service.fetchProducts('a');
      await expectLater(
        service.fetchProducts('a', search: 'Missing'),
        throwsA(isA<ApiException>()),
      );
      expect(service.products, isEmpty);
    },
  );
  test(
    'only the exact actor/site/query/status/order snapshot is available offline',
    () async {
      var offline = false, actor = 'one';
      final api = client(
        (r, h) => respond(
          r,
          h,
          offline ? {} : [product('a', 'First')],
          status: offline ? 503 : 200,
        ),
      );
      final service = ProductService(
        api: api,
        cache: CacheService.memory(actorIdProvider: () => actor),
      );
      await service.fetchProducts(
        'a',
        search: 'First',
        status: 'active',
        sort: 'price',
        order: 'desc',
      );
      offline = true;
      expect(
        await service.fetchProducts(
          'a',
          search: 'First',
          status: 'active',
          sort: 'price',
          order: 'desc',
        ),
        hasLength(1),
      );
      expect(service.productsOffline, isTrue);
      expect(service.productsHasMore, isFalse);
      for (final load in [
        () => service.fetchProducts(
          'a',
          search: 'First',
          status: 'inactive',
          sort: 'price',
          order: 'desc',
        ),
        () => service.fetchProducts(
          'a',
          search: 'First',
          status: 'active',
          sort: 'price',
          order: 'asc',
        ),
        () => service.fetchProducts(
          'b',
          search: 'First',
          status: 'active',
          sort: 'price',
          order: 'desc',
        ),
      ]) {
        await expectLater(load(), throwsA(isA<ApiException>()));
        expect(service.products, isEmpty);
      }
      actor = 'two';
      await expectLater(
        service.fetchProducts(
          'a',
          search: 'First',
          status: 'active',
          sort: 'price',
          order: 'desc',
        ),
        throwsA(isA<ApiException>()),
      );
    },
  );
  for (final denial in [401, 403, 404]) {
    test('detail $denial retires the old private snapshot', () async {
      var denied = false;
      final api = client(
        (r, h) => respond(
          r,
          h,
          denied ? {} : product('a', 'First'),
          status: denied ? denial : 200,
        ),
      );
      final service = ProductService(api: api, cache: CacheService.memory());
      await service.fetchProduct('product_First', storeId: 'a');
      denied = true;
      await expectLater(
        service.fetchProduct('product_First', storeId: 'a'),
        throwsA(isA<ApiException>()),
      );
    });
  }
  test(
    'foreign product responses fail closed and cannot become an offline snapshot',
    () async {
      final cache = CacheService.memory(),
          api = client((r, h) => respond(r, h, [product('b', 'Foreign')]));
      final service = ProductService(api: api, cache: cache);
      await expectLater(
        service.fetchProducts('a'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'PRODUCT_SCOPE_MISMATCH',
          ),
        ),
      );
      expect(service.products, isEmpty);
      expect(cache.readJsonList(CacheService.productsKey('a', 1, 20)), isEmpty);
    },
  );
  test(
    'older same-store query completion cannot replace newer rows or cache',
    () async {
      final started = Completer<void>(), release = Completer<void>();
      final cache = CacheService.memory();
      final api = client((r, h) async {
        if (r.queryParameters['search'] == 'Old') {
          started.complete();
          await release.future;
        }
        respond(r, h, [product('a', r.queryParameters['search'] as String)]);
      });
      final service = ProductService(api: api, cache: cache);
      final old = service.fetchProducts('a', search: 'Old');
      final refused = expectLater(
        old,
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      await started.future;
      await service.fetchProducts('a', search: 'New');
      release.complete();
      await refused;
      expect(service.products.single['name'], 'New');
      expect(
        cache.readJsonList(CacheService.productsKey('a', 1, 20, search: 'Old')),
        isEmpty,
      );
    },
  );
  test(
    'context change immediately hides rows and retires pending detail',
    () async {
      var version = 1, hold = false;
      final started = Completer<void>(), release = Completer<void>();
      final api = client((r, h) async {
        if (hold) {
          started.complete();
          await release.future;
        }
        respond(
          r,
          h,
          r.uri.path.endsWith('/products')
              ? [product('a', 'First')]
              : product('a', 'First'),
        );
      }, scope: () => version);
      final service = ProductService(api: api, cache: CacheService.memory());
      await service.fetchProducts('a');
      version++;
      expect(service.products, isEmpty);
      expect(service.productContracts, isEmpty);
      hold = true;
      final detail = service.fetchProduct('product_First', storeId: 'a');
      final refused = expectLater(detail, throwsA(isA<ApiException>()));
      await started.future;
      version++;
      release.complete();
      await refused;
    },
  );
  test(
    'known denial suppresses other cached catalog queries until current authorized success',
    () async {
      var mode = 200;
      final api = client(
        (r, h) => respond(
          r,
          h,
          mode == 200 ? [product('a', 'First')] : {},
          status: mode,
        ),
      );
      final service = ProductService(api: api, cache: CacheService.memory());
      await service.fetchProducts('a', search: 'First');
      mode = 403;
      await expectLater(
        service.fetchProducts('a'),
        throwsA(isA<ApiException>()),
      );
      mode = 503;
      await expectLater(
        service.fetchProducts('a', search: 'First'),
        throwsA(isA<ApiException>()),
      );
    },
  );
  test(
    'a stock filter requires server confirmation, including after gateway rollback',
    () async {
      var supported = true;
      final api = client(
        (r, h) => h.resolve(
          Response(
            requestOptions: r,
            statusCode: 200,
            data: {
              'data': [product('a', 'First')],
              'meta': {if (supported) 'stock_filter': 'low_stock'},
            },
          ),
        ),
      );
      final service = ProductService(api: api, cache: CacheService.memory());
      expect(
        await service.fetchProducts('a', stockFilter: 'low_stock'),
        hasLength(1),
      );
      supported = false;
      await expectLater(
        service.fetchProducts('a', stockFilter: 'low_stock'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'PRODUCT_FILTER_UNSUPPORTED',
          ),
        ),
      );
      expect(service.products, isEmpty);
      expect(service.productsOffline, isFalse);
    },
  );
  testWidgets(
    'catalog pagination/search/filter/sort use the server and page-labelled counts',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final calls = <Map<String, dynamic>>[];
      final api = client((r, h) {
        if (r.uri.path.endsWith('/stores'))
          return respond(r, h, [
            {'id': 'a', 'name': 'Synthetic store', 'site_type': 'store'},
          ]);
        calls.add(Map<String, dynamic>.from(r.queryParameters));
        respond(r, h, [
          product(
            'a',
            r.queryParameters['page'] == 2 ? 'Second page' : 'First page',
          ),
        ], more: r.queryParameters['page'] == 1);
      });
      final stores = StoreContext(storeService: StoreService(api: api));
      final service = ProductService(api: api);
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<StoreContext>.value(value: stores),
            ChangeNotifierProvider<ProductService>.value(value: service),
          ],
          child: const MaterialApp(home: ProductsScreen()),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('1 On this page'), findsOneWidget);
      expect(find.text('1 Total'), findsNothing);
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();
      expect(calls.last['page'], 2);
      expect(find.text('Second page'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'Across catalog');
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pumpAndSettle();
      expect(calls.last['search'], 'Across catalog');
      expect(calls.last['page'], 1);
      await tester.tap(find.byKey(const ValueKey('product-filter-active')));
      await tester.pumpAndSettle();
      expect(calls.last['status'], 'active');
      await tester.tap(find.byType(DropdownButton<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Price ↑').last);
      await tester.pumpAndSettle();
      expect(calls.last['sort'], 'price');
      expect(calls.last['order'], 'asc');
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'stock filter refusal has direct recovery and catalog money retains paise',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      tester.view.physicalSize = const Size(411, 891);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final calls = <Map<String, dynamic>>[];
      final api = client((r, h) {
        if (r.uri.path.endsWith('/stores'))
          return respond(r, h, [
            {'id': 'a', 'name': 'Synthetic store', 'site_type': 'store'},
          ]);
        calls.add(Map<String, dynamic>.from(r.queryParameters));
        respond(r, h, [
          {...product('a', 'Precise price'), 'compare_price': 150.25},
        ]);
      });
      final stores = StoreContext(storeService: StoreService(api: api)),
          service = ProductService(api: api);
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<StoreContext>.value(value: stores),
            ChangeNotifierProvider<ProductService>.value(value: service),
          ],
          child: const MaterialApp(home: ProductsScreen()),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('₹129.75'), findsOneWidget);
      expect(find.text('₹150.25'), findsOneWidget);
      final filter = find.byKey(const ValueKey('product-filter-out_of_stock'));
      await tester.scrollUntilVisible(
        filter,
        150,
        scrollable: find
            .descendant(
              of: find.byType(ListView),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.tap(filter);
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Stock filters are unavailable on this server. Select All products.',
        ),
        findsOneWidget,
      );
      expect(find.text('Precise price'), findsNothing);
      await tester.tap(find.text('Clear stock filter'));
      await tester.pumpAndSettle();
      expect(calls.last.containsKey('stock_filter'), isFalse);
      expect(calls.last['status'], 'all');
      expect(find.text('Precise price'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('a failed later page keeps a working Previous recovery', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final api = client((r, h) {
      if (r.uri.path.endsWith('/stores'))
        return respond(r, h, [
          {'id': 'a', 'name': 'Synthetic store', 'site_type': 'store'},
        ]);
      final second = r.queryParameters['page'] == 2;
      respond(
        r,
        h,
        second ? {} : [product('a', 'First page')],
        status: second ? 503 : 200,
        more: !second,
      );
    });
    final stores = StoreContext(storeService: StoreService(api: api)),
        service = ProductService(api: api);
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<StoreContext>.value(value: stores),
          ChangeNotifierProvider<ProductService>.value(value: service),
        ],
        child: const MaterialApp(home: ProductsScreen()),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(find.text('Retry products'), findsOneWidget);
    expect(find.text('First page'), findsNothing);
    await tester.tap(find.text('Previous'));
    await tester.pumpAndSettle();
    expect(find.text('First page'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
