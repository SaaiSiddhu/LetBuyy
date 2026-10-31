import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/inventory_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'support/loyalty_fixture.dart' show MemoryStorage;
import 'support/warehouse_fixture.dart' as w;

const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
JsonMap level({
  String site = a,
  String name = 'Synthetic stock',
  int available = 7,
  bool includeScope = true,
}) => {
  'id': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'product_id': 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'product_name': name,
  'sku': 'SYN-7',
  'location_id': 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'available': available,
  'reserved': 2,
  'incoming': 0,
  'on_hand': available + 2,
  'sellable': available - 2,
  if (includeScope) 'store_id': site,
};
JsonMap historyRow({String site = a, String name = 'Synthetic history'}) => {
  'id': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'store_id': site,
  'product_id': 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'location_id': 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'quantity_change': -2,
  'reason': 'damaged',
  'note': 'Synthetic history note',
  'created_at': '2026-10-01T00:00:00+00:00',
  'products': {'name': name, 'store_id': site},
};
void respond(
  RequestOptions r,
  RequestInterceptorHandler h,
  Object value, {
  int status = 200,
  bool more = false,
  JsonMap meta = const {},
}) => h.resolve(
  Response(
    requestOptions: r,
    statusCode: status,
    data: {
      'data': value,
      'meta': {'has_next': more, 'next_cursor': null, ...meta},
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
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (r, h) {
        if (r.path.endsWith('/command-capabilities'))
          respond(
            r,
            h,
            w.warehouseCapabilities(
              site: r.queryParameters['store_id'].toString(),
            ),
          );
        else
          handler(r, h);
      },
    ),
  );
  addTearDown(result.close);
  return result;
}

typedef ReadResource = ({
  String path,
  Future<List<Object>> Function(InventoryService, String) load,
  List<Object> Function(InventoryService) values,
});
final resources = <ReadResource>[
  (path: 'levels', load: (s, id) => s.fetchLevels(id), values: (s) => s.levels),
  (
    path: 'locations',
    load: (s, id) => s.fetchLocations(id),
    values: (s) => s.locations,
  ),
  (
    path: 'suppliers',
    load: (s, id) => s.fetchSuppliers(id),
    values: (s) => s.suppliers,
  ),
  (
    path: 'purchase-orders',
    load: (s, id) => s.fetchPurchaseOrders(id),
    values: (s) => s.purchaseOrders,
  ),
  (
    path: 'transfers',
    load: (s, id) => s.fetchTransfers(id),
    values: (s) => s.transfers,
  ),
];
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'history requires the explicit server store acknowledgement and observed count',
    () async {
      for (final meta in <JsonMap>[
        {},
        {'store_id': b, 'total': 1, 'page': 1},
        {'store_id': a, 'page': 1},
      ]) {
        final api = client((r, h) => respond(r, h, [historyRow()], meta: meta));
        final service = InventoryService(api: api);
        await expectLater(
          service.fetchHistory(a),
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'scope acknowledgement',
              'INVENTORY_HISTORY_SCOPE_UNSUPPORTED',
            ),
          ),
        );
        expect(service.history, isEmpty);
        expect(service.historyTotal, isNull);
      }
    },
  );
  test(
    'history preserves signed changes, joins and timestamps while retiring old actor/store context',
    () async {
      var epoch = 1;
      final api = client(
        (r, h) => respond(
          r,
          h,
          [historyRow()],
          meta: {'store_id': a, 'total': 1, 'page': 1},
        ),
        scope: () => epoch,
      );
      final service = InventoryService(api: api);
      final row = (await service.fetchHistory(a)).single;
      expect(row.quantityChange, -2);
      expect(row.productName, 'Synthetic history');
      expect(row.createdAt.toUtc(), DateTime.utc(2026, 10, 1));
      expect(service.historyTotal, 1);
      epoch++;
      expect(service.history, isEmpty);
      expect(service.historyTotal, isNull);
    },
  );
  for (final status in [401, 403, 503]) {
    test(
      'history $status cannot retain a previously observed activity page',
      () async {
        var fail = false;
        final api = client(
          (r, h) => respond(
            r,
            h,
            fail ? {} : [historyRow()],
            status: fail ? status : 200,
            meta: {'store_id': a, 'total': 1, 'page': 1},
          ),
        );
        final service = InventoryService(api: api);
        await service.fetchHistory(a);
        fail = true;
        await expectLater(
          service.fetchHistory(a),
          throwsA(isA<ApiException>()),
        );
        expect(service.history, isEmpty);
        expect(service.historyTotal, isNull);
      },
    );
  }
  test(
    'history refuses foreign joined product scope and a different filtered product',
    () async {
      for (final row in [
        {
          ...historyRow(),
          'products': {'name': 'Foreign synthetic', 'store_id': b},
        },
        {...historyRow(), 'product_id': 'ffffffff-ffff-4fff-8fff-ffffffffffff'},
      ]) {
        final api = client(
          (r, h) => respond(
            r,
            h,
            [row],
            meta: {'store_id': a, 'total': 1, 'page': 1},
          ),
        );
        final service = InventoryService(api: api);
        await expectLater(
          service.fetchHistory(
            a,
            productId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          ),
          throwsA(isA<ApiException>()),
        );
        expect(service.history, isEmpty);
      }
    },
  );
  test(
    'a delayed history page cannot replace a later filter or count',
    () async {
      final started = Completer<void>(), release = Completer<void>();
      final api = client((r, h) async {
        if (r.queryParameters['page'] == 1) {
          started.complete();
          await release.future;
        }
        respond(
          r,
          h,
          [
            historyRow(
              name: r.queryParameters['page'] == 1
                  ? 'Retired history'
                  : 'Current history',
            ),
          ],
          meta: {'store_id': a, 'total': 3, 'page': r.queryParameters['page']},
        );
      });
      final service = InventoryService(api: api);
      final old = service.fetchHistory(a),
          outcome = expectLater(old, throwsA(isA<ApiException>()));
      await started.future;
      await service.fetchHistory(a, page: 2);
      release.complete();
      await outcome;
      expect(service.history.single.productName, 'Current history');
      expect(service.historyTotal, 3);
    },
  );
  test(
    'malformed history quantities and timestamps cannot become zero or a fabricated date',
    () {
      for (final row in [
        {...historyRow()}..remove('quantity_change'),
        {...historyRow(), 'quantity_change': 0.5},
        {...historyRow(), 'created_at': 'not-a-date'},
      ]) {
        expect(
          () => InventoryHistoryEntry.fromJson(row),
          throwsFormatException,
        );
      }
    },
  );
  for (final envelope in ['purchase_order', 'transfer']) {
    for (final foreign in [false, true]) {
      test(
        '$envelope command validates nested receipt scope ($foreign)',
        () async {
          final po = envelope == 'purchase_order',
              key = 'synthetic-command-key';
          final base = WarehouseCommandAcknowledgement.fromJson(
            w.warehouseAck(
              po
                  ? WarehouseCommandIntent.purchaseOrder(w.warehousePo())
                  : WarehouseCommandIntent.transfer(w.warehouseTransfer()),
              key,
            ),
          );
          final intent = po
              ? WarehouseCommandIntent.receivePurchaseOrder(base.purchaseOrder!)
              : WarehouseCommandIntent.ship(base.transfer!.id);
          final ack = w.warehouseAck(
            intent,
            key,
            received: po ? 4 : 0,
            shipped: po ? 0 : 4,
          );
          if (foreign) (ack[envelope] as Map)['site_id'] = b;
          final api = client((r, h) => respond(r, h, ack));
          final service = InventoryService(
            api: api,
            actorIdProvider: () => w.warehouseActor,
            storeIdProvider: () => w.warehouseSite,
            commands: SecurityCommandStore(storage: MemoryStorage()),
          );
          final result = envelope == 'purchase_order'
              ? service.receivePurchaseOrder(
                  base.purchaseOrder!,
                  idempotencyKey: key,
                )
              : service.shipTransfer(base.transfer!, idempotencyKey: key);
          if (foreign) {
            await expectLater(
              result,
              throwsA(
                isA<ApiException>().having(
                  (e) => e.code,
                  'scope',
                  'WAREHOUSE_RECEIPT_INVALID',
                ),
              ),
            );
          } else {
            final value = await result;
            expect(
              value is PurchaseOrderContract
                  ? value.storeId
                  : (value as InventoryTransferContract).storeId,
              w.warehouseSite,
            );
          }
        },
      );
    }
  }
  test(
    'lost stock acknowledgement survives restart with frozen intent and one key',
    () async {
      final storage = MemoryStorage(), calls = <RequestOptions>[];
      var lose = true, actor = 'synthetic-owner', store = a, epoch = 1;
      final api = client((r, h) {
        calls.add(r);
        respond(
          r,
          h,
          lose ? {} : level(available: 8),
          status: lose ? 503 : 200,
        );
      }, scope: () => epoch);
      InventoryService service() => InventoryService(
        api: api,
        actorIdProvider: () => actor,
        storeIdProvider: () => store,
        commands: SecurityCommandStore(storage: storage),
      );
      Future<InventoryLevel> submit(InventoryService s, {int delta = 1}) =>
          s.submitAdjustment(
            storeId: a,
            productId: level()['product_id'],
            locationId: level()['location_id'],
            delta: delta,
            reason: 'correction',
            note: 'Synthetic count',
          );
      await expectLater(submit(service()), throwsA(isA<ApiException>()));
      final key = calls.single.headers['X-Idempotency-Key'];
      expect(key, isNotEmpty);
      final restarted = service();
      expect((await restarted.pendingAdjustment(a))?.key, key);
      await expectLater(
        submit(restarted, delta: 2),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'pending intent',
            'PENDING_SECURITY_COMMAND',
          ),
        ),
      );
      expect(calls, hasLength(1));
      actor = 'different-owner';
      epoch++;
      expect(await restarted.pendingAdjustment(a), isNull);
      actor = 'synthetic-owner';
      store = b;
      epoch++;
      expect(await restarted.pendingAdjustment(b), isNull);
      await expectLater(
        () => restarted.retryPendingAdjustment(a),
        throwsA(isA<ApiException>()),
      );
      actor = 'synthetic-owner';
      store = a;
      epoch++;
      lose = false;
      expect((await restarted.retryPendingAdjustment(a)).available, 8);
      expect(calls.last.headers['X-Idempotency-Key'], key);
      expect(calls.last.data, calls.first.data);
      expect(await restarted.pendingAdjustment(a), isNull);
      await submit(restarted);
      expect(calls.last.headers['X-Idempotency-Key'], isNot(key));
    },
  );
  test(
    'retired or wrong-product stock receipts retain the original recovery key',
    () async {
      final storage = MemoryStorage();
      var epoch = 1, retire = true;
      final api = client((r, h) {
        if (retire) epoch++;
        respond(r, h, {
          ...level(),
          if (!retire) 'product_id': 'foreign-product',
        });
      }, scope: () => epoch);
      final service = InventoryService(
        api: api,
        actorIdProvider: () => 'synthetic-owner',
        storeIdProvider: () => a,
        commands: SecurityCommandStore(storage: storage),
      );
      await expectLater(
        service.submitAdjustment(
          storeId: a,
          productId: level()['product_id'],
          locationId: level()['location_id'],
          delta: 1,
          reason: 'correction',
        ),
        throwsA(isA<ApiException>()),
      );
      final original = (await service.pendingAdjustment(a))!.key;
      retire = false;
      await expectLater(
        service.retryPendingAdjustment(a),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'receipt',
            'INVENTORY_RECEIPT_MISMATCH',
          ),
        ),
      );
      expect((await service.pendingAdjustment(a))!.key, original);
      expect(service.levels, isEmpty);
    },
  );
  for (final resource in resources) {
    test(
      '${resource.path} retires private rows immediately on context change and failed reload',
      () async {
        var version = 1, fail = false;
        final api = client(
          (r, h) => respond(
            r,
            h,
            fail
                ? {}
                : [
                    {...level(), 'site_id': a, 'name': 'Synthetic record'},
                  ],
            status: fail ? 503 : 200,
          ),
          scope: () => version,
        );
        final service = InventoryService(api: api);
        expect(await resource.load(service, a), hasLength(1));
        expect(resource.values(service), hasLength(1));
        version++;
        expect(resource.values(service), isEmpty);
        fail = true;
        await expectLater(
          resource.load(service, b),
          throwsA(isA<ApiException>()),
        );
        expect(resource.values(service), isEmpty);
      },
    );
    test(
      '${resource.path} rejects a declared foreign response instead of publishing it',
      () async {
        final api = client(
          (r, h) => respond(r, h, [
            {...level(site: b), 'site_id': b, 'name': 'Synthetic foreign'},
          ]),
        );
        final service = InventoryService(api: api);
        await expectLater(
          resource.load(service, a),
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'code',
              'INVENTORY_SCOPE_MISMATCH',
            ),
          ),
        );
        expect(resource.values(service), isEmpty);
      },
    );
  }
  test(
    'canonical level projection without store_id retains its explicit authorized query scope',
    () async {
      final api = client((r, h) => respond(r, h, [level(includeScope: false)]));
      final service = InventoryService(api: api);
      final row = (await service.fetchLevels(a)).single;
      expect(row.storeId, a);
      expect(row.available, 7);
      expect(row.onHand, 9);
      expect(
        row.committed,
        isNull,
        reason:
            'the canonical GET projection does not observe committed quantity',
      );
      expect(
        row.isLowStock,
        isTrue,
        reason: 'the server low_stock predicate includes quantities 1–10',
      );
    },
  );
  test(
    'same-store older level filter cannot replace the newer page or loading state',
    () async {
      final started = Completer<void>(), release = Completer<void>();
      final api = client((r, h) async {
        if (r.queryParameters['low_stock'] == true) {
          started.complete();
          await release.future;
          respond(r, h, [level(name: 'Old low stock')]);
        } else {
          respond(r, h, [
            level(name: 'New current page', available: 12),
          ], more: true);
        }
      });
      final service = InventoryService(api: api),
          pending = service.fetchLevels(a, lowStockOnly: true);
      final refused = expectLater(
        pending,
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      await started.future;
      await service.fetchLevels(a, page: 2);
      release.complete();
      await refused;
      expect(service.levels.single.productName, 'New current page');
      expect(service.levelsHasMore, isTrue);
      expect(service.isLoading, isFalse);
    },
  );
  test(
    'an older mutation receipt cannot replace a later inventory read',
    () async {
      final started = Completer<void>(), release = Completer<void>();
      final calls = <RequestOptions>[];
      final api = client((r, h) async {
        calls.add(r);
        if (r.method == 'POST') {
          started.complete();
          await release.future;
          respond(r, h, level(available: 8));
        } else {
          respond(r, h, [level(name: 'Newer server read', available: 10)]);
        }
      });
      final service = InventoryService(api: api);
      final initial = (await service.fetchLevels(a)).single;
      final save = service.adjustStock(
        storeId: a,
        level: initial,
        delta: 1,
        reason: 'correction',
        idempotencyKey: 'synthetic-stable-adjustment-key',
      );
      await started.future;
      await service.fetchLevels(a);
      release.complete();
      expect((await save).available, 8);
      expect(service.levels.single.available, 10);
      final command = calls.singleWhere((r) => r.method == 'POST');
      expect(command.headers['X-Store-ID'], a);
      expect(
        command.headers['X-Idempotency-Key'],
        'synthetic-stable-adjustment-key',
      );
    },
  );
  test(
    'foreign barcode product scope is refused before a stock editor can use it',
    () async {
      final api = client(
        (r, h) => respond(r, h, {
          'product': {'id': 'synthetic-product', 'store_id': b},
          'barcode': 'synthetic-code',
        }),
      );
      await expectLater(
        InventoryService(
          api: api,
        ).lookupBarcode(storeId: a, barcode: 'synthetic-code'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'INVENTORY_SCOPE_MISMATCH',
          ),
        ),
      );
    },
  );
  test(
    'missing or fractional quantity facts are unavailable, not observed zero',
    () {
      for (final broken in [
        {...level()}..remove('available'),
        {...level(), 'reserved': 0.5},
        {...level()}..remove('on_hand'),
      ]) {
        expect(() => InventoryLevel.fromJson(broken), throwsFormatException);
      }
      final row = InventoryLevel.fromJson({
        ...level(),
        'location_id': null,
        'sellable': 0,
        'variant_title': 'Blue M',
        'location_name': 'Central warehouse',
      });
      expect(row.locationId, isEmpty);
      expect(row.sellable, 0);
      expect(row.label, 'Synthetic stock / Blue M');
    },
  );
}
