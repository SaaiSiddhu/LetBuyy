import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/inventory_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/screens/inventory/inventory_screen.dart';
import 'package:letbuyy_store/screens/inventory/locations_screen.dart';
import 'package:letbuyy_store/screens/inventory/suppliers_screen.dart';
import 'package:letbuyy_store/screens/inventory/purchase_orders_screen.dart';
import 'package:letbuyy_store/screens/inventory/transfers_screen.dart';
import 'support/loyalty_fixture.dart' show MemoryStorage;

const siteA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const siteB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const productId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const locationId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

class _FixedStores extends StoreService {
  _FixedStores(ApiClient api) : super(api: api);
  @override
  Future<List<StoreModel>> fetchStores() async => [siteA, siteB]
      .map(
        (id) => StoreModel.fromJson({
          'id': id,
          'name': id,
          'site_type': 'store',
          'subdomain': 'synthetic',
        }),
      )
      .toList();
}

JsonMap record(String site, {String? name}) {
  final label = name ?? (site == siteA ? 'Private A' : 'Private B');
  return {
    'id': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'store_id': site,
    'name': label,
    'product_name': label,
    'supplier_name': label,
    'product_id': productId,
    'sku': 'SYN-7',
    'location_id': locationId,
    'location_name': 'Synthetic warehouse',
    'variant_title': 'Synthetic size',
    'source_location_id': locationId,
    'destination_location_id': 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'available': 7,
    'reserved': 2,
    'on_hand': 9,
    'incoming': 3,
    'sellable': 5,
    'track_inventory': true,
    'status': 'draft',
    'lines': [
      {
        'id': 'synthetic-line',
        'product_id': productId,
        'product_name': label,
        'quantity': 7,
        'received_quantity': 0,
      },
    ],
  };
}

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
      'meta': {'has_next': more},
    },
  ),
);

Future<StoreContext> mount(
  WidgetTester tester,
  Widget screen,
  void Function(RequestOptions, RequestInterceptorHandler) handler,
) async {
  SharedPreferences.setMockInitialValues({});
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  late StoreContext stores;
  final dio = Dio();
  final api = ApiClient(
    baseUrl: 'https://gateway.test/v1',
    dio: dio,
    maxRetries: 0,
    contextVersionProvider: () => stores.requestContextKey,
  );
  dio.interceptors.add(InterceptorsWrapper(onRequest: handler));
  addTearDown(api.close);
  stores = StoreContext(storeService: _FixedStores(api));
  final inventory = InventoryService(
    api: api,
    actorIdProvider: () => 'synthetic-owner',
    storeIdProvider: () => stores.selectedStoreId,
    commands: SecurityCommandStore(storage: MemoryStorage()),
  );
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: stores),
        ChangeNotifierProvider.value(value: inventory),
      ],
      child: MaterialApp(home: screen),
    ),
  );
  await tester.pumpAndSettle();
  return stores;
}

void main() {
  final surfaces = <({String name, Widget screen, String? form, String? save})>[
    (name: 'levels', screen: const InventoryScreen(), form: null, save: null),
    (
      name: 'locations',
      screen: const InventoryLocationsScreen(),
      form: 'New location',
      save: 'Create location',
    ),
    (
      name: 'suppliers',
      screen: const InventorySuppliersScreen(),
      form: 'New supplier',
      save: 'Create supplier',
    ),
    (
      name: 'purchase orders',
      screen: const PurchaseOrdersScreen(),
      form: 'New PO',
      save: 'Create purchase order',
    ),
    (
      name: 'transfers',
      screen: const InventoryTransfersScreen(),
      form: 'New transfer',
      save: 'Create transfer',
    ),
  ];
  for (final surface in surfaces) {
    testWidgets(
      '${surface.name} clears rows and retires an open form on store switch',
      (tester) async {
        final writes = <RequestOptions>[];
        final stores = await mount(tester, surface.screen, (r, h) {
          if (r.method != 'GET') writes.add(r);
          respond(r, h, [record(r.queryParameters['store_id'].toString())]);
        });
        expect(find.textContaining('Private A'), findsWidgets);
        if (surface.form != null) {
          await tester.tap(find.text(surface.form!).first);
          await tester.pumpAndSettle();
          await tester.enterText(
            find.byType(TextField).first,
            'Sensitive draft',
          );
        }
        final change = stores.selectStore(stores.stores.last);
        await tester.pumpAndSettle();
        await change;
        expect(find.textContaining('Private A'), findsNothing);
        expect(find.text('Sensitive draft'), findsNothing);
        if (surface.form != null) {
          expect(find.text(surface.save!), findsNothing);
          expect(find.text('Store access changed'), findsOneWidget);
          await tester.tap(find.text('Close'));
          await tester.pumpAndSettle();
        }
        expect(find.textContaining('Private B'), findsWidgets);
        expect(writes, isEmpty);
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets(
    'inventory shows observed quantities and page recovery after an unavailable next page',
    (tester) async {
      final requests = <RequestOptions>[];
      await mount(tester, const InventoryScreen(), (r, h) {
        requests.add(r);
        final page = r.queryParameters['page'].toString();
        respond(
          r,
          h,
          page == '2' ? {} : [record(siteA)],
          status: page == '2' ? 503 : 200,
          more: page != '2',
        );
      });
      expect(find.text('7 Low'), findsOneWidget);
      expect(find.text('9 on hand'), findsOneWidget);
      expect(find.text('3 incoming'), findsOneWidget);
      expect(find.text('0 committed'), findsNothing);
      expect(find.text('Private A / Synthetic size'), findsOneWidget);
      expect(find.text('Synthetic warehouse'), findsOneWidget);
      expect(
        find.text('Filter this page by product, SKU or location'),
        findsOneWidget,
      );
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();
      expect(find.text('Page 2'), findsOneWidget);
      expect(find.textContaining('Private A'), findsNothing);
      await tester.tap(find.text('Previous'));
      await tester.pumpAndSettle();
      expect(find.text('7 Low'), findsOneWidget);
      expect(
        requests
            .where((r) => r.path.endsWith('/levels'))
            .last
            .queryParameters['page'],
        1,
      );
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('open stock adjustment retires without sending after A-B-A', (
    tester,
  ) async {
    final writes = <RequestOptions>[];
    final stores = await mount(tester, const InventoryScreen(), (r, h) {
      if (r.method == 'POST') writes.add(r);
      respond(r, h, [record(r.queryParameters['store_id'].toString())]);
    });
    await tester.tap(find.text('Adjust'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Change quantity'),
      '2',
    );
    for (final store in [stores.stores.last, stores.stores.first]) {
      final change = stores.selectStore(store);
      await tester.pumpAndSettle();
      await change;
    }
    expect(find.text('Store access changed'), findsOneWidget);
    expect(find.text('Apply'), findsNothing);
    expect(writes, isEmpty);
  });
  testWidgets(
    'unconfirmed stock keeps its original retry even when refreshed quantities changed',
    (tester) async {
      final writes = <RequestOptions>[];
      var quantity = 7;
      await mount(tester, const InventoryScreen(), (r, h) {
        final value = {
          ...record(siteA),
          'available': quantity,
          'on_hand': quantity + 2,
        };
        if (r.method == 'POST') {
          writes.add(r);
          quantity = 8;
          respond(
            r,
            h,
            writes.length == 1
                ? {}
                : {...value, 'available': quantity, 'on_hand': quantity + 2},
            status: writes.length == 1 ? 503 : 200,
          );
        } else {
          respond(r, h, [value]);
        }
      });
      await tester.tap(find.text('Adjust'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.widgetWithText(TextField, 'Change quantity'),
        '1',
      );
      await tester.tap(find.text('Apply'));
      await tester.pumpAndSettle();
      expect(find.text('8 Low'), findsOneWidget);
      expect(find.text('A stock change needs confirmation'), findsOneWidget);
      expect(
        tester
            .widget<OutlinedButton>(
              find.widgetWithText(OutlinedButton, 'Adjust'),
            )
            .onPressed,
        isNull,
      );
      expect(writes, hasLength(1));
      await tester.tap(find.text('Retry original'));
      await tester.pumpAndSettle();
      expect(writes, hasLength(2));
      expect(writes.first.headers['X-Idempotency-Key'], isNotEmpty);
      expect(
        writes.last.headers['X-Idempotency-Key'],
        writes.first.headers['X-Idempotency-Key'],
      );
      expect(writes.last.data, writes.first.data);
      expect(find.text('A stock change needs confirmation'), findsNothing);
      expect(find.text('8 Low'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'an older refresh cannot repaint a newer same-store inventory page',
    (tester) async {
      RequestOptions? delayed;
      RequestInterceptorHandler? delayedHandler;
      var hold = false;
      await mount(tester, const InventoryScreen(), (r, h) {
        if (hold) {
          delayed = r;
          delayedHandler = h;
          return;
        }
        respond(r, h, [record(siteA, name: 'New current stock')], more: true);
      });
      hold = true;
      await tester.tap(find.byTooltip('Refresh inventory'));
      await tester.pump();
      for (var i = 0; delayed == null && i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 10));
      }
      expect(delayed, isNotNull);
      hold = false;
      await tester.tap(find.byTooltip('Refresh inventory'));
      await tester.pumpAndSettle();
      respond(delayed!, delayedHandler!, [
        record(siteA, name: 'Retired private stock'),
      ]);
      await tester.pumpAndSettle();
      expect(find.textContaining('Retired private stock'), findsNothing);
      expect(find.textContaining('New current stock'), findsOneWidget);
    },
  );
}
