import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/inventory_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'support/loyalty_fixture.dart' show MemoryStorage;

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
void respond(
  RequestOptions r,
  RequestInterceptorHandler h,
  Object value, {
  int status = 200,
  bool more = false,
}) => h.resolve(
  Response(
    requestOptions: r,
    statusCode: status,
    data: {
      'data': value,
      'meta': {'has_next': more, 'next_cursor': null},
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
  for (final envelope in ['purchase_order', 'transfer']) {
    for (final foreign in [false, true]) {
      test(
        '$envelope command validates nested receipt scope ($foreign)',
        () async {
          final api = client(
            (r, h) => respond(r, h, {
              envelope: {
                'id': 'synthetic-operation',
                'site_id': foreign ? b : a,
              },
              'lines': [],
            }),
          );
          final service = InventoryService(api: api);
          final result = envelope == 'purchase_order'
              ? service.receivePurchaseOrder(
                  PurchaseOrderContract.fromJson({
                    'id': 'synthetic-operation',
                    'site_id': a,
                  }),
                  idempotencyKey: 'synthetic-command-key',
                )
              : service.shipTransfer(
                  InventoryTransferContract.fromJson({
                    'id': 'synthetic-operation',
                    'site_id': a,
                  }),
                  idempotencyKey: 'synthetic-command-key',
                );
          if (foreign) {
            await expectLater(
              result,
              throwsA(
                isA<ApiException>().having(
                  (e) => e.code,
                  'scope',
                  'INVENTORY_SCOPE_MISMATCH',
                ),
              ),
            );
          } else {
            final value = await result;
            expect(
              value is PurchaseOrderContract
                  ? value.storeId
                  : (value as InventoryTransferContract).storeId,
              a,
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
