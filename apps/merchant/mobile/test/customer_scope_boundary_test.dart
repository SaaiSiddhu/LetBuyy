import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/screens/customers/customers_screen.dart';
import 'package:letbuyy_store/screens/customers/customer_detail_screen.dart';
import 'package:letbuyy_models/letbuyy_models.dart' show CustomerContract;
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:letbuyy_store/services/customer_service.dart';
import 'package:letbuyy_store/services/order_service.dart';
import 'package:letbuyy_store/services/store_service.dart';

Map<String, dynamic> customer(String site, {String name = 'Private A'}) => {
  'id': 'customer_$site',
  'store_id': site,
  'email': '$site@example.test',
  'display_name': name,
  'first_name': name,
  'status': 'active',
  'total_spent': 120,
  'order_count': 2,
};

void respond(
  RequestOptions r,
  RequestInterceptorHandler h,
  Object data, {
  int status = 200,
}) => h.resolve(
  Response(requestOptions: r, statusCode: status, data: {'data': data}),
);

ApiClient client(
  void Function(RequestOptions, RequestInterceptorHandler) handler, {
  Object? Function()? scope,
}) {
  final dio = Dio();
  final api = ApiClient(
    baseUrl: 'https://gateway.test/v1',
    dio: dio,
    maxRetries: 0,
    contextVersionProvider: scope,
  );
  dio.interceptors.add(InterceptorsWrapper(onRequest: handler));
  addTearDown(api.close);
  return api;
}

class FixedStores extends StoreService {
  FixedStores(ApiClient api) : super(api: api);
  @override
  Future<List<StoreModel>> fetchStores() async => ['a', 'b']
      .map(
        (id) => StoreModel.fromJson({
          'id': id,
          'name': id,
          'site_type': 'store',
          'subdomain': id,
        }),
      )
      .toList();
}

Future<void> revealCustomer(
  WidgetTester tester,
  String text, {
  double step = 200,
}) async {
  final scrollable = find.byType(Scrollable).first;
  for (var attempt = 0; attempt < 30; attempt++) {
    if (find.text(text).evaluate().isNotEmpty) {
      await tester.ensureVisible(find.text(text).last);
      await tester.pumpAndSettle();
      return;
    }
    await tester.drag(scrollable, Offset(0, -step));
    await tester.pumpAndSettle();
  }
  fail('Customer viewport did not reveal $text after bounded scrolling.');
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('failed store and search requests never reuse another result', () async {
    final api = client(
      (r, h) => respond(
        r,
        h,
        r.queryParameters['store_id'] == 'a' &&
                r.queryParameters['search'] == null
            ? [customer('a')]
            : {},
        status:
            r.queryParameters['store_id'] == 'a' &&
                r.queryParameters['search'] == null
            ? 200
            : 503,
      ),
    );
    final service = CustomerService(api: api, cache: CacheService.memory());
    expect((await service.fetchCustomers('a')).single.storeId, 'a');
    await expectLater(
      service.fetchCustomers('b'),
      throwsA(isA<ApiException>()),
    );
    expect(service.customers, isEmpty);
    await service.fetchCustomers('a');
    await expectLater(
      service.fetchCustomers('a', search: 'someone else'),
      throwsA(isA<ApiException>()),
    );
    expect(service.customers, isEmpty);
  });

  for (final status in [401, 403, 404]) {
    test('detail $status cannot fall back to a private snapshot', () async {
      var denied = false;
      final api = client(
        (r, h) => respond(
          r,
          h,
          denied ? {} : customer('a'),
          status: denied ? status : 200,
        ),
      );
      final service = CustomerService(api: api, cache: CacheService.memory());
      await service.fetchCustomerByEmail('a@example.test', storeId: 'a');
      denied = true;
      await expectLater(
        service.fetchCustomerByEmail('a@example.test', storeId: 'a'),
        throwsA(
          isA<ApiException>().having((e) => e.statusCode, 'status', status),
        ),
      );
      expect(
        service.cachedCustomerByEmail('a@example.test', storeId: 'a'),
        isNull,
      );
    });
  }

  test('offline fallback is exact to actor, site and query', () async {
    var offline = false, actor = 'one';
    final api = client(
      (r, h) => respond(
        r,
        h,
        offline ? {} : [customer('a')],
        status: offline ? 503 : 200,
      ),
    );
    final service = CustomerService(
      api: api,
      cache: CacheService.memory(actorIdProvider: () => actor),
    );
    await service.fetchCustomers('a', search: 'Private');
    offline = true;
    expect(
      (await service.fetchCustomers('a', search: 'Private')).single.storeId,
      'a',
    );
    actor = 'two';
    await expectLater(
      service.fetchCustomers('a', search: 'Private'),
      throwsA(isA<ApiException>()),
    );
    expect(service.customers, isEmpty);
  });

  test(
    'cached detail never finds a same-email row from another store',
    () async {
      final api = client((r, h) => respond(r, h, [customer('a')]));
      final service = CustomerService(api: api, cache: CacheService.memory());
      await service.fetchCustomers('a');
      expect(
        service.cachedCustomerByEmail('a@example.test', storeId: 'b'),
        isNull,
      );
      expect(service.cachedCustomerByEmail('a@example.test'), isNull);
      expect(
        service.cachedCustomerByEmail('a@example.test', storeId: 'a')?.storeId,
        'a',
      );
    },
  );

  test(
    'foreign response rows fail closed instead of becoming offline cache',
    () async {
      final api = client((r, h) => respond(r, h, [customer('b')]));
      final cache = CacheService.memory();
      final service = CustomerService(api: api, cache: cache);
      await expectLater(
        service.fetchCustomers('a'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'CUSTOMER_SCOPE_MISMATCH',
          ),
        ),
      );
      expect(service.customers, isEmpty);
      expect(
        cache.readJsonList(CacheService.customersKey('a', page: 1, limit: 30)),
        isEmpty,
      );
    },
  );

  test(
    'retired response cannot repopulate customer state or cache after A-B-A',
    () async {
      var contextVersion = 1;
      final started = Completer<void>(), release = Completer<void>();
      final api = client((r, h) async {
        started.complete();
        await release.future;
        respond(r, h, [customer('a')]);
      }, scope: () => contextVersion);
      final cache = CacheService.memory(),
          service = CustomerService(api: api, cache: cache);
      final request = service.fetchCustomers('a');
      final outcome = expectLater(
        request,
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      await started.future;
      contextVersion = 3;
      release.complete();
      await outcome;
      expect(service.customers, isEmpty);
      expect(
        cache.readJsonList(CacheService.customersKey('a', page: 1, limit: 30)),
        isEmpty,
      );
    },
  );

  test('older search cannot overwrite newer query in the same store', () async {
    final started = Completer<void>(), release = Completer<void>();
    final api = client((r, h) async {
      if (r.queryParameters['search'] == 'old') {
        started.complete();
        await release.future;
      }
      respond(r, h, [
        customer('a', name: r.queryParameters['search'].toString()),
      ]);
    });
    final service = CustomerService(api: api);
    final old = service.fetchCustomers('a', search: 'old');
    final outcome = expectLater(old, throwsA(isA<ApiException>()));
    await started.future;
    await service.fetchCustomers('a', search: 'new');
    release.complete();
    await outcome;
    expect(service.customers.single.displayName, 'new');
  });

  test('older segment results cannot overwrite another store', () async {
    final started = Completer<void>(), release = Completer<void>();
    final api = client((r, h) async {
      final site = r.queryParameters['store_id'];
      if (site == 'a') {
        started.complete();
        await release.future;
      }
      respond(r, h, [
        {
          'id': 'segment_$site',
          'store_id': site,
          'name': 'Segment $site',
          'rules': {},
        },
      ]);
    });
    final service = CustomerService(api: api);
    final old = service.fetchSegments('a'),
        outcome = expectLater(old, throwsA(isA<ApiException>()));
    await started.future;
    await service.fetchSegments('b');
    release.complete();
    await outcome;
    expect(service.segments.single.storeId, 'b');
  });

  testWidgets(
    'store changes hide customer data and retire an open creation form',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      late StoreContext stores;
      final writes = <RequestOptions>[];
      final api = client((r, h) {
        if (r.method == 'POST') writes.add(r);
        respond(
          r,
          h,
          r.path.endsWith('/segments')
              ? []
              : [
                  customer(
                    r.queryParameters['store_id'].toString(),
                    name: r.queryParameters['store_id'] == 'a'
                        ? 'Private A'
                        : 'Private B',
                  ),
                ],
        );
      }, scope: () => stores.requestContextKey);
      stores = StoreContext(storeService: FixedStores(api));
      await stores.loadStores();
      final service = CustomerService(api: api);
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            Provider<ApiClient>.value(value: api),
            ChangeNotifierProvider.value(value: stores),
            ChangeNotifierProvider.value(value: service),
          ],
          child: const MaterialApp(home: CustomersScreen()),
        ),
      );
      await tester.pumpAndSettle();
      await revealCustomer(tester, 'Private A');
      expect(find.text('Private A'), findsOneWidget);
      await revealCustomer(tester, 'Add customer', step: -200);
      await tester.tap(find.byTooltip('Add customer'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('customer-name-field')),
        'Sensitive draft',
      );
      await stores.selectStore(stores.stores.last);
      await tester.pumpAndSettle();
      expect(find.text('Private A'), findsNothing);
      expect(find.text('Sensitive draft'), findsNothing);
      expect(find.text('Save customer'), findsNothing);
      expect(
        find.text('Close this form and reopen it from the selected store.'),
        findsOneWidget,
      );
      expect(writes, isEmpty);
      await tester.tap(find.text('Close'));
      await tester.pumpAndSettle();
      await revealCustomer(tester, 'Private B');
      expect(find.text('Private B'), findsOneWidget);
    },
  );

  testWidgets('unavailable segments preserve the customer list', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final api = client(
      (r, h) => respond(
        r,
        h,
        r.path.endsWith('/segments') ? {} : [customer('a')],
        status: r.path.endsWith('/segments') ? 503 : 200,
      ),
    );
    final stores = StoreContext(storeService: FixedStores(api));
    await stores.loadStores();
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: stores),
          ChangeNotifierProvider(create: (_) => CustomerService(api: api)),
        ],
        child: const MaterialApp(home: CustomersScreen()),
      ),
    );
    await tester.pumpAndSettle();
    await revealCustomer(tester, 'Private A');
    expect(find.text('Private A'), findsOneWidget);
    expect(
      find.text('Segments could not be loaded. Refresh to retry.'),
      findsOneWidget,
    );
    expect(find.text('Could not load customers'), findsNothing);
  });

  test(
    'access denial disables other cached queries until an authorized read',
    () async {
      var status = 200;
      final api = client(
        (r, h) =>
            respond(r, h, status == 200 ? [customer('a')] : {}, status: status),
      );
      final service = CustomerService(api: api, cache: CacheService.memory());
      await service.fetchCustomers('a', search: 'Private');
      status = 403;
      await expectLater(
        service.fetchCustomers('a'),
        throwsA(isA<ApiException>()),
      );
      status = 503;
      await expectLater(
        service.fetchCustomers('a', search: 'Private'),
        throwsA(isA<ApiException>()),
      );
      expect(service.customers, isEmpty);
      status = 200;
      await service.fetchCustomers('a', search: 'Private');
      status = 503;
      expect(
        (await service.fetchCustomers('a', search: 'Private')).single.storeId,
        'a',
      );
      expect(service.customersOffline, isTrue);
    },
  );

  testWidgets(
    'detail authorization failure never renders its initial private snapshot',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final api = client((r, h) => respond(r, h, {}, status: 403));
      final stores = StoreContext(storeService: FixedStores(api));
      await stores.loadStores();
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: stores),
            ChangeNotifierProvider(create: (_) => CustomerService(api: api)),
          ],
          child: MaterialApp(
            home: CustomerDetailScreen(
              email: 'a@example.test',
              initialCustomer: CustomerContract.fromJson(customer('a')),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Private A'), findsNothing);
      expect(find.byTooltip('Edit customer'), findsNothing);
      expect(find.text('Customer unavailable'), findsOneWidget);
    },
  );

  testWidgets(
    'detail profile editor hides private fields after a store switch',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      late StoreContext stores;
      final writes = <RequestOptions>[];
      final api = client((r, h) {
        if (r.method != 'GET') writes.add(r);
        respond(
          r,
          h,
          r.path.endsWith('/customers/a%40example.test') ? customer('a') : [],
        );
      }, scope: () => stores.requestContextKey);
      stores = StoreContext(storeService: FixedStores(api));
      await stores.loadStores();
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: stores),
            ChangeNotifierProvider(create: (_) => CustomerService(api: api)),
            ChangeNotifierProvider(create: (_) => OrderService(api: api)),
          ],
          child: MaterialApp(
            home: CustomerDetailScreen(
              email: 'a@example.test',
              initialCustomer: CustomerContract.fromJson(customer('a')),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Edit customer'));
      await tester.pumpAndSettle();
      expect(find.text('Private A'), findsOneWidget);
      expect(find.byKey(const Key('customer-task-first_name')), findsOneWidget);
      await stores.selectStore(stores.stores.last);
      await tester.pumpAndSettle();
      expect(find.text('Private'), findsNothing);
      expect(find.text('Private A'), findsNothing);
      expect(find.text('Customer access changed'), findsOneWidget);
      expect(find.byKey(const Key('customer-task-first_name')), findsNothing);
      expect(writes, isEmpty);
    },
  );

  testWidgets(
    'customer browsing follows cursor pages and searches the server',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final reads = <RequestOptions>[];
      final api = client((r, h) {
        if (r.path.endsWith('/segments')) {
          respond(r, h, []);
          return;
        }
        reads.add(r);
        final search = r.queryParameters['search']?.toString();
        final second = r.queryParameters['cursor'] == 'second-page';
        h.resolve(
          Response(
            requestOptions: r,
            statusCode: 200,
            data: {
              'data': [
                customer(
                  'a',
                  name: search ?? (second ? 'Last customer' : 'First customer'),
                ),
              ],
              'meta': {
                'has_next': search == null && !second,
                'next_cursor': search == null && !second ? 'second-page' : null,
              },
            },
          ),
        );
      });
      final stores = StoreContext(storeService: FixedStores(api));
      await stores.loadStores();
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: stores),
            ChangeNotifierProvider(create: (_) => CustomerService(api: api)),
          ],
          child: const MaterialApp(home: CustomersScreen()),
        ),
      );
      await tester.pumpAndSettle();
      await revealCustomer(tester, 'First customer');
      expect(find.text('First customer'), findsOneWidget);
      await revealCustomer(tester, 'Next');
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();
      await revealCustomer(tester, 'Last customer', step: -200);
      expect(find.text('Last customer'), findsOneWidget);
      expect(find.text('Page 2'), findsOneWidget);
      expect(reads.last.queryParameters['cursor'], 'second-page');
      await revealCustomer(tester, 'Previous');
      await tester.tap(find.text('Previous'));
      await tester.pumpAndSettle();
      await revealCustomer(tester, 'First customer');
      expect(find.text('First customer'), findsOneWidget);
      expect(reads.last.queryParameters['cursor'], isNull);
      await revealCustomer(tester, 'Search customers', step: -200);
      await tester.enterText(find.byType(TextField), 'Beyond the first thirty');
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pumpAndSettle();
      expect(reads.last.queryParameters['search'], 'Beyond the first thirty');
      expect(reads.last.queryParameters['page'], 1);
      expect(reads.last.queryParameters['cursor'], isNull);
      await revealCustomer(tester, 'Beyond the first thirty');
      expect(find.text('Beyond the first thirty'), findsNWidgets(2));
    },
  );
  testWidgets('an empty server search is not reported as an empty store', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final api = client(
      (r, h) => respond(
        r,
        h,
        r.path.endsWith('/segments') || r.queryParameters['search'] != null
            ? []
            : [customer('a')],
      ),
    );
    final stores = StoreContext(storeService: FixedStores(api));
    await stores.loadStores();
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: stores),
          ChangeNotifierProvider(create: (_) => CustomerService(api: api)),
        ],
        child: const MaterialApp(home: CustomersScreen()),
      ),
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'no-match');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();
    expect(find.text('No matching customers'), findsOneWidget);
    expect(find.text('No customers yet'), findsNothing);
  });
}
