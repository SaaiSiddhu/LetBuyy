import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' show LetbuyyEditorScaffold;
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/app/routes.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/inventory_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/screens/products/products_screen.dart';
import 'package:letbuyy_store/screens/inventory/inventory_screen.dart';
import 'package:letbuyy_store/screens/inventory/history_screen.dart';
import 'package:letbuyy_store/screens/inventory/locations_screen.dart';
import 'package:letbuyy_store/screens/inventory/suppliers_screen.dart';
import 'package:letbuyy_store/screens/inventory/purchase_orders_screen.dart';
import 'package:letbuyy_store/screens/inventory/transfers_screen.dart';
import 'support/loyalty_fixture.dart' show MemoryStorage;
import 'support/warehouse_fixture.dart' as w;

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
        'quantity_ordered': 7,
        'quantity_requested': 7,
        'quantity_shipped': 0,
        'quantity_received': 0,
        'unit_cost': 0,
      },
    ],
  };
}

JsonMap warehouseRecord(String path, String site, {String? name, String? id}) {
  final label = name ?? (site == siteA ? 'Private A' : 'Private B');
  if (path.endsWith('/locations'))
    return w.warehouseLocationRecord(
      site: site,
      name: label,
      id: id ?? w.warehouseLocation,
    );
  if (path.endsWith('/suppliers'))
    return w.warehouseSupplierRecord(
      site: site,
      name: label,
      id: id ?? w.warehouseDestination,
    );
  if (path.endsWith('/purchase-orders') || path.endsWith('/transfers'))
    return {
      ...w.warehouseDocument(
        site: site,
        transfer: path.endsWith('/transfers'),
        targetId: id ?? w.warehouseTarget,
      ),
      path.endsWith('/transfers') ? 'transfer_number' : 'po_number': label,
    };
  return record(site, name: name);
}

JsonMap historyRecord(String site) => {
  'id': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'store_id': site,
  'product_id': productId,
  'location_id': locationId,
  'quantity_change': -2,
  'reason': 'damaged',
  'note': site == siteA ? 'Private A note' : 'Private B note',
  'created_at': '2026-10-01T00:00:00+00:00',
  'products': {
    'name': site == siteA ? 'Private A history' : 'Private B history',
    'store_id': site,
  },
};

void respond(
  RequestOptions r,
  RequestInterceptorHandler h,
  Object data, {
  int status = 200,
  bool more = false,
  JsonMap meta = const {},
}) => h.resolve(
  Response(
    requestOptions: r,
    statusCode: status,
    data: {
      'data': data,
      'meta': {
        'has_next': more,
        if (RegExp(
              r'/inventory/(purchase-orders|transfers|locations|suppliers)$',
            ).hasMatch(r.path) &&
            data is List) ...{
          'store_id': r.queryParameters['store_id'],
          'page': r.queryParameters['page'] ?? 1,
          'per_page': r.queryParameters['limit'] ?? 20,
          'total': data.length,
          'total_is_exact': true,
        },
        ...meta,
      },
    },
  ),
);

Future<StoreContext> mount(
  WidgetTester tester,
  Widget screen,
  void Function(RequestOptions, RequestInterceptorHandler) handler, {
  bool settle = true,
  MemoryStorage? storage,
  String actor = w.warehouseActor,
  bool protocolAvailable = true,
  Size windowSize = const Size(390, 844),
  ThemeData? theme,
  double textScale = 1,
  StoreService Function(ApiClient)? storeFactory,
}) async {
  SharedPreferences.setMockInitialValues({});
  tester.view.physicalSize = windowSize;
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
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (r, h) {
        if (r.path.endsWith('/command-capabilities')) {
          respond(
            r,
            h,
            protocolAvailable
                ? w.warehouseCapabilities(
                    actor: actor,
                    site: r.queryParameters['store_id'].toString(),
                  )
                : {},
            status: protocolAvailable ? 200 : 404,
          );
        } else {
          handler(r, h);
        }
      },
    ),
  );
  addTearDown(api.close);
  stores = StoreContext(
    storeService: storeFactory?.call(api) ?? _FixedStores(api),
  );
  final inventory = InventoryService(
    api: api,
    actorIdProvider: () => actor,
    storeIdProvider: () => stores.selectedStoreId,
    commands: SecurityCommandStore(storage: storage ?? MemoryStorage()),
  );
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: stores),
        ChangeNotifierProvider.value(value: inventory),
        ChangeNotifierProvider(create: (_) => ProductService(api: api)),
      ],
      child: MaterialApp(
        theme: theme,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
        home: screen,
        onGenerateRoute: AppRoutes.generateRoute,
      ),
    ),
  );
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
  return stores;
}

void main() {
  for (final transfer in [false, true])
    testWidgets(
      '${transfer ? 'transfer' : 'PO'} renders scoped product and warehouse names',
      (tester) async {
        await mount(
          tester,
          transfer
              ? const InventoryTransfersScreen()
              : const PurchaseOrdersScreen(),
          (r, h) {
            final row = warehouseRecord(r.path, siteA),
                child = (row['lines'] as List).first as Map<String, dynamic>;
            child['product'] = {
              'id': child['product_id'],
              'store_id': siteA,
              'name': 'Synthetic cotton tote',
              'sku': 'SYN-TOTE',
              'deleted_at': null,
            };
            row[transfer ? 'source_location' : 'location'] = {
              'id': row[transfer ? 'source_location_id' : 'location_id'],
              'store_id': siteA,
              'name': 'Synthetic origin',
              'deleted_at': null,
            };
            if (transfer)
              row['destination_location'] = {
                'id': row['destination_location_id'],
                'store_id': siteA,
                'name': 'Synthetic destination',
                'deleted_at': null,
              };
            respond(r, h, [row]);
          },
        );
        expect(find.textContaining('Synthetic cotton tote'), findsOneWidget);
        expect(find.textContaining('Synthetic origin'), findsOneWidget);
        if (transfer)
          expect(find.textContaining('Synthetic destination'), findsOneWidget);
        expect(find.textContaining(w.warehouseLocation), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );

  for (final transfer in [false, true]) {
    testWidgets(
      '${transfer ? 'transfer' : 'purchase order'} quantity accessibility focus stays inside its input',
      (tester) async {
        final semantics = tester.ensureSemantics();
        try {
          await mount(
            tester,
            transfer
                ? const InventoryTransfersScreen()
                : const PurchaseOrdersScreen(),
            (r, h) {
              respond(r, h, [
                warehouseRecord(
                  r.path,
                  r.queryParameters['store_id'].toString(),
                ),
              ]);
            },
          );
          await tester.tap(
            find.text(transfer ? 'New transfer' : 'New PO').first,
          );
          await tester.pumpAndSettle();
          final field = find.byKey(const ValueKey('warehouse-quantity-0'));
          await tester.ensureVisible(field);
          await tester.pumpAndSettle();
          // A lone editable node must not absorb the complete product card: its
          // reported center previously hit the adjacent scanner button on Android.
          final editable = tester.getSemantics(field);
          expect(
            editable.rect.height,
            lessThanOrEqualTo(tester.getSize(field).height + 1),
          );
          expect(tester.takeException(), isNull);
        } finally {
          semantics.dispose();
        }
      },
    );
  }

  for (final screen in [
    const PurchaseOrdersScreen(),
    const InventoryTransfersScreen(),
  ]) {
    testWidgets(
      '${screen.runtimeType} refuses an older server before opening a new warehouse command',
      (tester) async {
        final writes = <RequestOptions>[];
        await mount(tester, screen, (r, h) {
          if (r.method != 'GET') writes.add(r);
          respond(r, h, [record(siteA)]);
        }, protocolAvailable: false);
        expect(find.text('Warehouse actions unavailable'), findsOneWidget);
        await tester.tap(
          find.text(screen is PurchaseOrdersScreen ? 'New PO' : 'New transfer'),
        );
        await tester.pumpAndSettle();
        expect(find.text('Create purchase order'), findsNothing);
        expect(find.text('Create transfer'), findsNothing);
        expect(writes, isEmpty);
      },
    );
    testWidgets(
      '${screen.runtimeType} retains original recovery while protocol support is unavailable',
      (tester) async {
        final storage = MemoryStorage(),
            journal = SecurityCommandStore(storage: storage);
        final saved = await journal.prepare(
          (actorId: w.warehouseActor, storeId: siteA, version: null),
          'inventory-warehouse',
          WarehouseCommandIntent.ship(w.warehouseTarget).toJson(),
          check: () {},
        );
        final writes = <RequestOptions>[];
        await mount(
          tester,
          screen,
          (r, h) {
            if (r.method != 'GET') writes.add(r);
            respond(r, h, []);
          },
          storage: storage,
          protocolAvailable: false,
        );
        expect(
          find.text('Warehouse request awaiting confirmation'),
          findsOneWidget,
        );
        await tester.tap(find.text('Retry original'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Stop original'));
        await tester.pumpAndSettle();
        expect(find.text('Stop the original request?'), findsNothing);
        expect(writes, isEmpty);
        expect(
          (await journal.read(
            (actorId: w.warehouseActor, storeId: siteA, version: null),
            'inventory-warehouse',
            check: () {},
          ))!.key,
          saved.key,
        );
        expect(find.text('Check again'), findsOneWidget);
      },
    );
  }
  for (final surface in [
    const PurchaseOrdersScreen(),
    const InventoryTransfersScreen(),
  ]) {
    testWidgets(
      '${surface.runtimeType} keeps recovery available when the list is unavailable and confirms stop',
      (tester) async {
        final storage = MemoryStorage(),
            journal = SecurityCommandStore(storage: storage),
            intent = WarehouseCommandIntent.ship(w.warehouseTarget);
        final pending = await journal.prepare(
          (actorId: w.warehouseActor, storeId: siteA, version: null),
          'inventory-warehouse',
          intent.toJson(),
          check: () {},
          proposedKey: 'pending-ship-original',
        );
        final writes = <RequestOptions>[];
        await mount(
          tester,
          surface,
          (r, h) {
            if (r.method == 'GET') {
              respond(r, h, {}, status: 503);
              return;
            }
            writes.add(r);
            expect(r.path, endsWith('/inventory/commands/stop'));
            expect((r.data as Map)['idempotency_key'], pending.key);
            expect((r.data as Map)['command'], intent.command);
            respond(
              r,
              h,
              w.warehouseAck(intent, pending.key, site: siteA, applied: false),
            );
          },
          storage: storage,
          actor: w.warehouseActor,
        );
        expect(
          find.text('Warehouse request awaiting confirmation'),
          findsOneWidget,
        );
        expect(find.textContaining('Could not load'), findsOneWidget);
        await tester.tap(find.text('Stop original'));
        await tester.pumpAndSettle();
        expect(find.text('Stop the original request?'), findsOneWidget);
        await tester.tap(find.text('Confirm stop'));
        await tester.pumpAndSettle();
        expect(writes.length, 1);
        expect(
          find.text('Warehouse request awaiting confirmation'),
          findsNothing,
        );
        expect(
          find.text('Original warehouse request stopped before it applied.'),
          findsOneWidget,
        );
        expect(
          await journal.read(
            (actorId: w.warehouseActor, storeId: siteA, version: null),
            'inventory-warehouse',
            check: () {},
          ),
          isNull,
        );
        expect(tester.takeException(), isNull);
      },
    );
    testWidgets(
      '${surface.runtimeType} retires pending details and an open stop dialog on A-B-A',
      (tester) async {
        final storage = MemoryStorage(),
            journal = SecurityCommandStore(storage: storage);
        await journal.prepare(
          (actorId: w.warehouseActor, storeId: siteA, version: null),
          'inventory-warehouse',
          WarehouseCommandIntent.ship(w.warehouseTarget).toJson(),
          check: () {},
        );
        final writes = <RequestOptions>[];
        final stores = await mount(
          tester,
          surface,
          (r, h) {
            if (r.method != 'GET') writes.add(r);
            respond(r, h, []);
          },
          storage: storage,
          actor: w.warehouseActor,
        );
        await tester.tap(find.text('Stop original'));
        await tester.pumpAndSettle();
        await stores.selectStore(
          stores.stores.firstWhere((store) => store.id == siteB),
        );
        await tester.pumpAndSettle();
        await stores.selectStore(
          stores.stores.firstWhere((store) => store.id == siteA),
        );
        await tester.pumpAndSettle();
        expect(find.text('Confirm stop'), findsNothing);
        expect(find.text('Store access changed'), findsOneWidget);
        expect(writes, isEmpty);
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets(
    'history clears private rows and expanded notes on store switch and recovers a failed later page',
    (tester) async {
      final stores = await mount(tester, const InventoryHistoryScreen(), (
        r,
        h,
      ) {
        final site = r.queryParameters['store_id'].toString(),
            page = r.queryParameters['page'];
        respond(
          r,
          h,
          page == 2 ? {} : [historyRecord(site)],
          status: page == 2 ? 503 : 200,
          more: true,
          meta: {'store_id': site, 'total': 2, 'page': page},
        );
      });
      expect(find.text('Private A history'), findsOneWidget);
      expect(find.textContaining('05:30 AM IST'), findsOneWidget);
      await tester.tap(find.text('Private A history'));
      await tester.pumpAndSettle();
      expect(find.text('Private A note'), findsOneWidget);
      final change = stores.selectStore(stores.stores.last);
      await tester.pumpAndSettle();
      await change;
      expect(find.text('Private A history'), findsNothing);
      expect(find.text('Private A note'), findsNothing);
      expect(find.text('Private B history'), findsOneWidget);
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();
      expect(find.text('Private B history'), findsNothing);
      expect(find.text('Page 2'), findsOneWidget);
      expect(find.text('2 matching stock changes'), findsNothing);
      await tester.tap(find.text('Previous'));
      await tester.pumpAndSettle();
      expect(find.text('Private B history'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'stock history is reachable from a row with a server product filter and clear-filter recovery',
    (tester) async {
      final queries = <Map<String, dynamic>>[];
      await mount(tester, const InventoryScreen(), (r, h) {
        if (r.path.endsWith('/history')) {
          queries.add(Map<String, dynamic>.from(r.queryParameters));
          respond(
            r,
            h,
            [historyRecord(siteA)],
            meta: {'store_id': siteA, 'total': 1, 'page': 1},
          );
        } else {
          respond(r, h, [record(siteA)]);
        }
      });
      await tester.ensureVisible(find.byTooltip('View stock history'));
      await tester.tap(find.byTooltip('View stock history'));
      await tester.pumpAndSettle();
      expect(find.byType(InventoryHistoryScreen), findsOneWidget);
      expect(queries.single['product_id'], productId);
      expect(find.text('Private A • all variants'), findsOneWidget);
      await tester.tap(find.byTooltip('Show all products'));
      await tester.pumpAndSettle();
      expect(queries.last['product_id'], isNull);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'older history readers without a store acknowledgement show unavailable instead of zero or private rows',
    (tester) async {
      await mount(
        tester,
        const InventoryHistoryScreen(),
        (r, h) => respond(
          r,
          h,
          [historyRecord(siteA)],
          meta: {'total': 1, 'page': 1},
        ),
      );
      expect(
        find.text(
          'History is not available for this store yet. Try again later.',
        ),
        findsOneWidget,
      );
      expect(find.text('0 matching stock changes'), findsNothing);
      expect(find.text('Private A history'), findsNothing);
      expect(find.text('Retry history'), findsOneWidget);
    },
  );
  for (final changeStore in [false, true]) {
    testWidgets(
      'Products menu reaches the registered inventory route only in its opening store ($changeStore)',
      (tester) async {
        var levelReads = 0;
        final stores = await mount(tester, const ProductsScreen(), (r, h) {
          if (r.path.endsWith('/inventory/levels')) levelReads++;
          final site = r.queryParameters['store_id'].toString();
          respond(r, h, [
            {
              ...record(site),
              'name': 'Synthetic catalog item',
              'price': 1.25,
              'stock': 7,
              'images': <String>[],
            },
          ]);
        });
        await tester.tap(find.byType(PopupMenuButton<String>));
        await tester.pumpAndSettle();
        if (changeStore) {
          final change = stores.selectStore(stores.stores.last);
          await tester.pumpAndSettle();
          await change;
        }
        await tester.tap(find.text('Inventory').last);
        await tester.pumpAndSettle();
        expect(levelReads, changeStore ? 0 : greaterThan(0));
        expect(
          find.byType(InventoryScreen),
          changeStore ? findsNothing : findsOneWidget,
        );
        expect(tester.takeException(), isNull);
      },
    );
  }
  for (final surface in [
    (name: 'purchase orders', screen: const PurchaseOrdersScreen()),
    (name: 'transfers', screen: const InventoryTransfersScreen()),
  ])
    testWidgets(
      '${surface.name} pages show exact counts and retain a previous-page recovery after denial',
      (tester) async {
        final pages = <int>[];
        final stores = await mount(tester, surface.screen, (r, h) {
          final page = r.queryParameters['page'] as int? ?? 1;
          pages.add(page);
          if (page == 2) {
            respond(r, h, [], status: 403);
            return;
          }
          respond(
            r,
            h,
            List.generate(
              20,
              (index) => warehouseRecord(
                r.path,
                r.queryParameters['store_id'].toString(),
                name: 'SYN page one $index',
                id: 'cccccccc-cccc-4ccc-8ccc-${index.toString().padLeft(12, '0')}',
              ),
            ),
            more: true,
            meta: {'total': 21},
          );
        });
        expect(find.text('21 matching records · Page 1'), findsOneWidget);
        await tester.tap(find.byTooltip('Next page'));
        await tester.pumpAndSettle();
        expect(pages.last, 2);
        expect(find.text('Page 2 · Count unavailable'), findsOneWidget);
        expect(find.textContaining('SYN page one'), findsNothing);
        await tester.tap(find.byTooltip('Previous page'));
        await tester.pumpAndSettle();
        expect(pages.last, 1);
        expect(find.text('21 matching records · Page 1'), findsOneWidget);
        final change = stores.selectStore(stores.stores.last);
        await tester.pumpAndSettle();
        await change;
        expect(pages.last, 1);
        expect(tester.takeException(), isNull);
      },
    );
  for (final transfer in [false, true]) {
    testWidgets(
      '${transfer ? 'transfer' : 'PO'} reviews fresh partial lines and recovers a committed lost reply with the original key',
      (tester) async {
        final writes = <JsonMap>[], storage = MemoryStorage();
        JsonMap? receipt;
        var effects = 0, detailReads = 0;
        final fresh = w.warehouseDocument(
          transfer: transfer,
          site: siteA,
          received: 2,
          shipped: 3,
          lineCount: 2,
        );
        await mount(
          tester,
          transfer
              ? const InventoryTransfersScreen()
              : const PurchaseOrdersScreen(),
          (r, h) {
            if (r.method == 'GET') {
              if (r.path.endsWith('/${w.warehouseTarget}')) {
                detailReads++;
                respond(r, h, fresh);
              } else {
                final row = w.warehouseDocument(
                  transfer: transfer,
                  site: siteA,
                  received: effects == 0 ? 0 : 2,
                  shipped: 3,
                  lineCount: 2,
                );
                if (effects > 0)
                  (row['lines'] as List)[0]['quantity_received'] = 3;
                respond(r, h, [row]);
              }
              return;
            }
            final body = Map<String, dynamic>.from(r.data as Map);
            writes.add(body);
            if (receipt == null) {
              effects++;
              final intent = transfer
                  ? WarehouseCommandIntent.receiveTransfer(
                      InventoryTransferContract.fromVerifiedJson(fresh),
                      quantities: {w.warehouseLine: 1},
                    )
                  : WarehouseCommandIntent.receivePurchaseOrder(
                      PurchaseOrderContract.fromVerifiedJson(fresh),
                      quantities: {w.warehouseLine: 1},
                    );
              receipt = w.warehouseAck(
                intent,
                body['idempotency_key'],
                site: siteA,
                received: 3,
                shipped: 3,
              );
              (receipt!['lines'] as List).add((fresh['lines'] as List)[1]);
              h.reject(
                DioException(
                  requestOptions: r,
                  type: DioExceptionType.connectionError,
                ),
              );
              return;
            }
            respond(r, h, receipt!);
          },
          storage: storage,
        );
        await tester.tap(find.text('Receive'));
        await tester.pumpAndSettle();
        expect(detailReads, 1);
        expect(find.text('Review stock receipt'), findsOneWidget);
        expect(
          find.descendant(
            of: find.byType(LetbuyyEditorScaffold),
            matching: find.textContaining('SYN-2'),
          ),
          findsOneWidget,
        );
        expect(
          find.textContaining('Variant aaaaaaaa-aaaa-4aaa-8aaa-000000000001'),
          findsOneWidget,
        );
        expect(
          find.textContaining(transfer ? 'Remaining: 1' : 'Remaining: 2'),
          findsWidgets,
        );
        final first = find.byKey(
          const ValueKey('warehouse-receive-${w.warehouseLine}'),
        );
        final second = find.byKey(
          const ValueKey(
            'warehouse-receive-99999999-9999-4999-8999-000000000001',
          ),
        );
        await tester.enterText(first, '0');
        await tester.enterText(second, '0');
        await tester.tap(find.text('Confirm receipt'));
        await tester.pumpAndSettle();
        expect(
          find.text('Choose at least one unit to receive.'),
          findsOneWidget,
        );
        expect(writes, isEmpty);
        await tester.enterText(first, '1.5');
        await tester.tap(find.text('Confirm receipt'));
        await tester.pumpAndSettle();
        expect(
          find.textContaining('Enter whole units between'),
          findsOneWidget,
        );
        expect(writes, isEmpty);
        await tester.enterText(first, '1');
        await tester.tap(find.text('Confirm receipt'));
        await tester.pumpAndSettle();
        expect(effects, 1);
        expect(writes.single['lines'], [
          {
            transfer ? 'transfer_line_id' : 'purchase_order_line_id':
                w.warehouseLine,
            'quantity': 1,
          },
        ]);
        expect(
          find.text('Warehouse request awaiting confirmation'),
          findsOneWidget,
        );
        await tester.tap(find.text('Retry original'));
        await tester.pumpAndSettle();
        expect(effects, 1);
        expect(writes, hasLength(2));
        expect(writes[1], writes[0]);
        expect(
          find.text('Warehouse request awaiting confirmation'),
          findsNothing,
        );
        expect(tester.takeException(), isNull);
      },
    );
    testWidgets(
      '${transfer ? 'transfer' : 'PO'} fresh detail denial cannot dispatch a receipt',
      (tester) async {
        var writes = 0;
        await mount(
          tester,
          transfer
              ? const InventoryTransfersScreen()
              : const PurchaseOrdersScreen(),
          (r, h) {
            if (r.method != 'GET') {
              writes++;
              respond(r, h, {}, status: 503);
              return;
            }
            if (r.path.endsWith('/${w.warehouseTarget}')) {
              respond(r, h, {}, status: 403);
              return;
            }
            respond(r, h, [
              w.warehouseDocument(transfer: transfer, site: siteA),
            ]);
          },
        );
        await tester.tap(find.text('Receive'));
        await tester.pumpAndSettle();
        expect(
          find.textContaining('current warehouse record could not be loaded'),
          findsOneWidget,
        );
        expect(find.text('Review stock receipt'), findsNothing);
        expect(writes, 0);
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets(
    'reserved transfers require a fresh reviewed shipment before receiving',
    (tester) async {
      var writes = 0, details = 0;
      final row = w.warehouseDocument(
        transfer: true,
        site: siteA,
        status: 'reserved',
        shipped: 0,
      );
      await mount(tester, const InventoryTransfersScreen(), (r, h) {
        if (r.method != 'GET') {
          writes++;
          respond(r, h, {}, status: 503);
          return;
        }
        if (r.path.endsWith('/${w.warehouseTarget}')) {
          details++;
          respond(r, h, row);
        } else {
          respond(r, h, [row]);
        }
      });
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, 'Receive'))
            .onPressed,
        isNull,
      );
      await tester.tap(find.text('Ship'));
      await tester.pumpAndSettle();
      expect(details, 1);
      expect(find.text('Review stock shipment'), findsOneWidget);
      expect(writes, 0);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(writes, 0);
      expect(tester.takeException(), isNull);
    },
  );
  for (final transfer in [false, true])
    testWidgets(
      '${transfer ? 'transfer' : 'PO'} receipt review retires across store A-B-A without saving or dispatching',
      (tester) async {
        var writes = 0, details = 0;
        final storage = MemoryStorage();
        final stores = await mount(
          tester,
          transfer
              ? const InventoryTransfersScreen()
              : const PurchaseOrdersScreen(),
          (r, h) {
            final site = r.queryParameters['store_id'].toString(),
                row = w.warehouseDocument(
                  transfer: transfer,
                  site: site,
                  received: 1,
                );
            if (r.method != 'GET') {
              writes++;
              respond(r, h, {}, status: 503);
              return;
            }
            if (r.path.endsWith('/${w.warehouseTarget}')) details++;
            respond(
              r,
              h,
              r.path.endsWith('/${w.warehouseTarget}') ? row : [row],
            );
          },
          storage: storage,
        );
        if (transfer) {
          final service = tester
              .element(find.byType(InventoryTransfersScreen))
              .read<InventoryService>();
          expect(service.transfers.single.lines.single.shippedQuantity, 4);
          expect(
            tester
                .widget<FilledButton>(
                  find.widgetWithText(FilledButton, 'Receive'),
                )
                .onPressed,
            isNotNull,
          );
        }
        await tester.tap(find.text('Receive'));
        await tester.pumpAndSettle();
        expect(
          details,
          1,
          reason: tester.allWidgets
              .whereType<Text>()
              .map((text) => text.data ?? '')
              .join(' | '),
        );
        expect(
          find.text('Review stock receipt'),
          findsOneWidget,
          reason: tester.allWidgets
              .whereType<Text>()
              .map((text) => text.data ?? '')
              .join(' | '),
        );
        await tester.enterText(
          find.byKey(const ValueKey('warehouse-receive-${w.warehouseLine}')),
          '1',
        );
        final toB = stores.selectStore(stores.stores.last);
        await tester.pumpAndSettle();
        await toB;
        expect(find.text('Store access changed'), findsOneWidget);
        expect(find.text('Confirm receipt'), findsNothing);
        final toA = stores.selectStore(stores.stores.first);
        await tester.pumpAndSettle();
        await toA;
        expect(find.text('Store access changed'), findsOneWidget);
        await tester.tap(find.text('Close'));
        await tester.pumpAndSettle();
        expect(writes, 0);
        expect(storage.data, isEmpty);
        expect(tester.takeException(), isNull);
      },
    );
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
          respond(r, h, [
            warehouseRecord(r.path, r.queryParameters['store_id'].toString()),
          ]);
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
          await tester.tap(
            surface.name == 'suppliers'
                ? find.byTooltip('Close')
                : find.text('Close'),
          );
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
      respond(r, h, [
        warehouseRecord(r.path, r.queryParameters['store_id'].toString()),
      ]);
    });
    await tester.ensureVisible(find.text('Adjust'));
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
      await tester.ensureVisible(find.text('Adjust'));
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
    'an older refresh cannot repaint a newer same-store low-stock query',
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
      await tester.tap(find.widgetWithText(FilterChip, 'Low'));
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
