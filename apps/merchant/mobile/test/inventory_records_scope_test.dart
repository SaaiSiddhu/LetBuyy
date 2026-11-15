import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/inventory_service.dart';

const siteA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    siteB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const productId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    parentId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
JsonMap reservation({
  String site = siteA,
  String status = 'active',
  String name = 'Synthetic held stock',
}) => {
  'id': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'store_id': site,
  'product_id': productId,
  'location_id': 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'quantity': 2,
  'status': status,
  'created_at': '2026-10-01T00:00:00Z',
  'updated_at': '2026-10-01T00:00:00Z',
  'expires_at': '2026-11-01T00:00:00Z',
  'products': {'name': name, 'store_id': site},
};
JsonMap receipt({
  String site = siteA,
  String type = 'purchase_order',
  String parent = parentId,
}) => {
  'id': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'receipt_type': type,
  'quantity_received': 3,
  'created_at': '2026-10-01T00:00:00Z',
  'received_at': '2026-10-01T00:00:00Z',
  'notes': 'Synthetic receipt note',
  'purchase_order_id': type == 'purchase_order' ? parent : null,
  'transfer_id': type == 'transfer' ? parent : null,
  'purchase_orders': type == 'purchase_order'
      ? {'id': parent, 'site_id': site}
      : null,
  'inventory_transfers': type == 'transfer'
      ? {'id': parent, 'site_id': site}
      : null,
};
void respond(
  RequestOptions r,
  RequestInterceptorHandler h,
  Object data, {
  int status = 200,
  JsonMap meta = const {},
}) => h.resolve(
  Response(
    requestOptions: r,
    statusCode: status,
    data: {
      'data': data,
      'meta': {
        'store_id': r.queryParameters['store_id'],
        'page': r.queryParameters['page'] ?? 1,
        'per_page': r.queryParameters['limit'] ?? 20,
        'total': 1,
        'has_next': false,
        ...meta,
      },
    },
  ),
);
ApiClient client(
  void Function(RequestOptions, RequestInterceptorHandler) handler, {
  Object? Function()? context,
}) {
  final dio = Dio();
  final api = ApiClient(
    baseUrl: 'https://gateway.test/v1',
    dio: dio,
    maxRetries: 0,
    contextVersionProvider: context,
  );
  dio.interceptors.add(InterceptorsWrapper(onRequest: handler));
  addTearDown(api.close);
  return api;
}

typedef Resource = ({
  String name,
  Future<List<Object>> Function(InventoryService, String) load,
  List<Object> Function(InventoryService) rows,
  int? Function(InventoryService) total,
  JsonMap Function(String) row,
});
final resources = <Resource>[
  (
    name: 'reservations',
    load: (s, id) => s.fetchReservations(id),
    rows: (s) => s.reservations,
    total: (s) => s.reservationTotal,
    row: (site) => reservation(site: site),
  ),
  (
    name: 'receipts',
    load: (s, id) => s.fetchReceipts(id),
    rows: (s) => s.receipts,
    total: (s) => s.receiptTotal,
    row: (site) => receipt(site: site),
  ),
];
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final resource in resources) {
    test(
      '${resource.name} retires rows and counts across actor/store context changes',
      () async {
        var epoch = 1;
        final api = client(
          (r, h) => respond(r, h, [
            resource.row(r.queryParameters['store_id'].toString()),
          ]),
          context: () => epoch,
        );
        final service = InventoryService(api: api);
        expect(await resource.load(service, siteA), hasLength(1));
        expect(resource.total(service), 1);
        epoch++;
        expect(resource.rows(service), isEmpty);
        expect(resource.total(service), isNull);
        await resource.load(service, siteB);
        expect(resource.rows(service), hasLength(1));
        epoch++;
        expect(resource.rows(service), isEmpty);
      },
    );
    for (final status in [401, 403, 503]) {
      test(
        '${resource.name} $status never reuses a prior successful page',
        () async {
          var fail = false;
          final api = client(
            (r, h) => respond(
              r,
              h,
              fail ? {} : [resource.row(siteA)],
              status: fail ? status : 200,
            ),
          );
          final service = InventoryService(api: api);
          await resource.load(service, siteA);
          fail = true;
          await expectLater(
            resource.load(service, siteA),
            throwsA(isA<ApiException>()),
          );
          expect(resource.rows(service), isEmpty);
          expect(resource.total(service), isNull);
        },
      );
    }
    test(
      '${resource.name} rejects unknown scope, count, page and next-state metadata',
      () async {
        for (final bad in <JsonMap>[
          {'store_id': null},
          {'store_id': siteB},
          {'total': null},
          {'total': -1},
          {'page': 2},
          {'per_page': 1},
          {'has_next': 'false'},
        ]) {
          final api = client(
            (r, h) => respond(r, h, [resource.row(siteA)], meta: bad),
          );
          final service = InventoryService(api: api);
          await expectLater(
            resource.load(service, siteA),
            throwsA(
              isA<ApiException>().having(
                (e) => e.code,
                'read contract',
                'INVENTORY_${resource.name.toUpperCase()}_SCOPE_UNSUPPORTED',
              ),
            ),
          );
          expect(resource.rows(service), isEmpty);
          expect(resource.total(service), isNull);
        }
      },
    );
    test(
      '${resource.name} rejects a declared foreign row/parent without publishing private data',
      () async {
        final api = client((r, h) => respond(r, h, [resource.row(siteB)]));
        final service = InventoryService(api: api);
        await expectLater(
          resource.load(service, siteA),
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'scope',
              'INVENTORY_SCOPE_MISMATCH',
            ),
          ),
        );
        expect(resource.rows(service), isEmpty);
      },
    );
    test(
      '${resource.name} retires an in-flight result across A-B-A even with the same final store',
      () async {
        var epoch = 1;
        final started = Completer<void>(), release = Completer<void>();
        final api = client((r, h) async {
          started.complete();
          await release.future;
          respond(r, h, [resource.row(siteA)]);
        }, context: () => epoch);
        final service = InventoryService(api: api);
        final pending = resource.load(service, siteA),
            outcome = expectLater(pending, throwsA(isA<ApiException>()));
        await started.future;
        epoch += 2;
        release.complete();
        await outcome;
        expect(resource.rows(service), isEmpty);
        expect(resource.total(service), isNull);
      },
    );
    test(
      '${resource.name} genuine empty activity preserves observed zero count',
      () async {
        final api = client((r, h) => respond(r, h, [], meta: {'total': 0}));
        final service = InventoryService(api: api);
        expect(await resource.load(service, siteA), isEmpty);
        expect(resource.total(service), 0);
      },
    );
  }
  test(
    'all seven server reservation statuses parse without local lifecycle guesses',
    () {
      for (final status in inventoryReservationStatuses) {
        final row = InventoryReservationRecord.fromJson(
          reservation(status: status),
        );
        expect(row.status, status);
        expect(row.quantity, 2);
      }
      for (final row in [
        {...reservation(), 'quantity': 0},
        {...reservation(), 'quantity': 1.5},
        {...reservation(), 'status': 'invented'},
        {...reservation(), 'expires_at': null},
        {...reservation(), 'expires_at': '2026-10-01T00:00:00'},
        {...reservation(), 'location_id': null},
        {...reservation(), 'quantity': '2'},
        {
          ...reservation(),
          'products': {'name': 17, 'store_id': siteA},
        },
      ]) {
        expect(
          () => InventoryReservationRecord.fromJson(row),
          throwsFormatException,
        );
      }
    },
  );
  test('receipt type, parent identity and observed quantity must agree', () {
    expect(InventoryReceiptRecord.fromJson(receipt()).storeId, siteA);
    expect(
      InventoryReceiptRecord.fromJson(receipt(type: 'transfer')).receiptType,
      'transfer',
    );
    for (final row in [
      {...receipt(), 'receipt_type': 'invented'},
      {...receipt(), 'quantity_received': null},
      {...receipt(), 'quantity_received': 0},
      {...receipt(), 'received_at': null},
      {...receipt(), 'purchase_order_id': 'other-parent'},
      {...receipt(), 'received_at': '2026-10-01T00:00:00'},
      {
        ...receipt(),
        'inventory_transfers': {'id': parentId, 'site_id': siteA},
      },
      {...receipt(), 'quantity_received': '3'},
    ]) {
      expect(() => InventoryReceiptRecord.fromJson(row), throwsFormatException);
    }
  });
  test(
    'reservation filter changes retire an older same-store page and pin the applied query',
    () async {
      final started = Completer<void>(), release = Completer<void>();
      final calls = <RequestOptions>[];
      final api = client((r, h) async {
        calls.add(r);
        if (r.queryParameters['status'] == 'active') {
          started.complete();
          await release.future;
        }
        respond(r, h, [
          reservation(status: r.queryParameters['status'].toString()),
        ]);
      });
      final service = InventoryService(api: api);
      final old = service.fetchReservations(siteA, status: 'active'),
          outcome = expectLater(old, throwsA(isA<ApiException>()));
      await started.future;
      await service.fetchReservations(
        siteA,
        status: 'hold',
        productId: productId,
      );
      release.complete();
      await outcome;
      expect(service.reservations.single.status, 'hold');
      expect(calls.last.headers['X-Store-ID'], siteA);
      expect(calls.last.queryParameters['product_id'], productId);
    },
  );
  test(
    'receipt parent filters never accept another purchase order or receipt family',
    () async {
      final api = client((r, h) => respond(r, h, [receipt(type: 'transfer')]));
      final service = InventoryService(api: api);
      await expectLater(
        service.fetchReceipts(siteA, purchaseOrderId: parentId),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'filter',
            'INVENTORY_SCOPE_MISMATCH',
          ),
        ),
      );
      expect(service.receipts, isEmpty);
      expect(service.receiptTotal, isNull);
    },
  );
}
