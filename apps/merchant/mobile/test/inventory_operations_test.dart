import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/inventory_service.dart';
import 'package:letbuyy_store/screens/inventory/inventory_screen.dart';
import 'package:letbuyy_store/screens/inventory/operations_screen.dart';
import 'inventory_workspace_test.dart' as workspace;
import 'inventory_records_scope_test.dart' as fixtures;

JsonMap metric(
  String resource,
  String site, {
  int page = 1,
  int total = 1,
  String? name,
}) {
  final label = name ?? (site == fixtures.siteA ? 'Private A' : 'Current B');
  final meta = {
    'page': page,
    'per_page': 20,
    'total': total,
    'total_pages': (total / 20).ceil(),
    'has_next': page * 20 < total,
    'has_prev': page > 1,
  };
  final length = (total - (page - 1) * 20).clamp(0, 20);
  return {
    'store_id': site,
    ...switch (resource) {
      'supplier-metrics' => {
        'suppliers': List.generate(
          length,
          (i) => {
            'supplier_id':
                '10000000-0000-4000-8000-${i.toString().padLeft(12, '0')}',
            'supplier_name': '$label supplier $i',
            'po_count': 1103,
            'on_time_rate': null,
            'avg_lead_time_days': null,
          },
        ),
        'meta': meta,
      },
      'warehouse-metrics' => {
        'warehouses': List.generate(
          length,
          (i) => {
            'location_id':
                '20000000-0000-4000-8000-${i.toString().padLeft(12, '0')}',
            'location_name': '$label warehouse $i',
            'is_default': i == 0,
            'sku_count': 1100,
            'total_units': 9900,
          },
        ),
        'meta': meta,
      },
      'transfer-metrics' => {
        'by_status': {'shipped': 1100, 'received': 3},
        'in_transit_count': 1100,
        'total_count': 1103,
      },
      _ => {
        'order_count': 0,
        'open_order_count': 0,
        'po_count': 1103,
        'open_po_count': 0,
        'transfer_count': 1103,
        'in_transit_transfer_count': 1100,
        'low_stock_sku_count': 12,
        'total_sku_count': 20,
      },
    },
  };
}

typedef Reader = ({
  String name,
  Future<Object> Function(InventoryService, String) load,
});
final readers = <Reader>[
  (name: 'supplier-metrics', load: (s, site) => s.fetchSupplierMetrics(site)),
  (name: 'warehouse-metrics', load: (s, site) => s.fetchWarehouseMetrics(site)),
  (name: 'transfer-metrics', load: (s, site) => s.fetchTransferMetrics(site)),
  (
    name: 'operations-summary',
    load: (s, site) => s.fetchOperationsSummary(site),
  ),
];
void serve(
  RequestOptions r,
  RequestInterceptorHandler h, {
  int status = 200,
  JsonMap? data,
}) => fixtures.respond(
  r,
  h,
  data ??
      metric(
        r.path.split('/').last,
        r.queryParameters['store_id'],
        page: r.queryParameters['page'] ?? 1,
      ),
  status: status,
);
void main() {
  testWidgets(
    'owner-only operations denial does not display any successful zero metrics',
    (tester) async {
      await workspace.mount(
        tester,
        const InventoryOperationsScreen(),
        (r, h) => serve(r, h, status: 403, data: {}),
      );
      expect(
        find.text('You do not have access to these operations metrics.'),
        findsNWidgets(4),
      );
      expect(find.text('0'), findsNothing);
      expect(find.textContaining('matching suppliers'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  for (final reader in readers) {
    test(
      '${reader.name} pins scope and rejects unacknowledged or foreign metrics',
      () async {
        JsonMap? body;
        final calls = <RequestOptions>[];
        final api = fixtures.client((r, h) {
          calls.add(r);
          serve(r, h, data: body);
        });
        final service = InventoryService(api: api);
        await reader.load(service, fixtures.siteA);
        expect(calls.single.headers['X-Store-ID'], fixtures.siteA);
        expect(calls.single.queryParameters['store_id'], fixtures.siteA);
        for (final store in [null, fixtures.siteB]) {
          body = {...metric(reader.name, fixtures.siteA), 'store_id': store};
          await expectLater(
            reader.load(service, fixtures.siteA),
            throwsA(isA<ApiException>()),
          );
        }
      },
    );
    test(
      '${reader.name} retires a late A-B-A response and never revives the previous actor',
      () async {
        var version = 0;
        final began = Completer<void>(), release = Completer<void>();
        final api = fixtures.client((r, h) async {
          began.complete();
          await release.future;
          serve(r, h);
        }, context: () => version);
        final service = InventoryService(api: api);
        final old = reader.load(service, fixtures.siteA),
            outcome = expectLater(old, throwsA(isA<ApiException>()));
        await began.future;
        version = 1;
        version = 2;
        release.complete();
        await outcome;
      },
    );
    for (final status in [401, 403, 503])
      test(
        '${reader.name} $status never converts into zero or a successful empty metric',
        () async {
          final api = fixtures.client(
            (r, h) => serve(r, h, status: status, data: {}),
          );
          final service = InventoryService(api: api);
          await expectLater(
            reader.load(service, fixtures.siteA),
            throwsA(isA<ApiException>()),
          );
        },
      );
  }
  test(
    'unknown supplier rates remain absent; real zero rates and zero observed counts survive',
    () {
      final data = metric('supplier-metrics', fixtures.siteA),
          rows = data['suppliers'] as List;
      expect(SupplierMetricPage.fromJson(data).rows.single.onTimeRate, isNull);
      (rows.single as JsonMap)['on_time_rate'] = 0;
      expect(SupplierMetricPage.fromJson(data).rows.single.onTimeRate, 0);
      final snapshot = OperationsSnapshot.fromJson({
        'store_id': fixtures.siteA,
        'order_count': 0,
      });
      expect(snapshot.values['order_count'], 0);
      expect(snapshot.values['po_count'], isNull);
      expect(snapshot.isComplete, isFalse);
    },
  );
  test(
    'malformed metrics cannot fabricate counts, rates, page totals or balanced transfer totals',
    () {
      final supplier = metric('supplier-metrics', fixtures.siteA);
      (supplier['suppliers'] as List).first['on_time_rate'] = 2;
      expect(
        () => SupplierMetricPage.fromJson(supplier),
        throwsFormatException,
      );
      final warehouse = metric('warehouse-metrics', fixtures.siteA);
      (warehouse['warehouses'] as List).first.remove('total_units');
      expect(
        () => WarehouseMetricPage.fromJson(warehouse),
        throwsFormatException,
      );
      expect(
        () => TransferMetrics.fromJson({
          ...metric('transfer-metrics', fixtures.siteA),
          'total_count': 1,
        }),
        throwsFormatException,
      );
      expect(
        () => OperationsSnapshot.fromJson({'store_id': fixtures.siteA}),
        throwsFormatException,
      );
      expect(
        () => OperationsSnapshot.fromJson({
          'store_id': fixtures.siteA,
          'po_count': null,
        }),
        throwsFormatException,
      );
    },
  );
  testWidgets(
    'operations panels settle independently while a supplier read is pending',
    (tester) async {
      final release = Completer<void>(), calls = <String>[];
      await workspace.mount(tester, const InventoryOperationsScreen(), (
        r,
        h,
      ) async {
        final resource = r.path.split('/').last;
        calls.add(resource);
        if (resource == 'supplier-metrics') await release.future;
        serve(r, h);
      }, settle: false);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(calls.toSet(), {
        'supplier-metrics',
        'warehouse-metrics',
        'transfer-metrics',
        'operations-summary',
      });
      expect(find.text('Private A warehouse 0'), findsOneWidget);
      expect(find.text('9900'), findsOneWidget);
      expect(find.text('Private A supplier 0'), findsNothing);
      release.complete();
      await tester.pumpAndSettle();
      expect(find.text('Private A supplier 0'), findsOneWidget);
      expect(find.text('Unavailable'), findsNWidgets(2));
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'operations store changes retire private rows and counts in all four panels',
    (tester) async {
      final stores = await workspace.mount(
        tester,
        const InventoryOperationsScreen(),
        serve,
      );
      expect(find.text('Private A supplier 0'), findsOneWidget);
      expect(find.text('Private A warehouse 0'), findsOneWidget);
      final change = stores.selectStore(stores.stores.last);
      await tester.pumpAndSettle();
      await change;
      expect(find.text('Private A supplier 0'), findsNothing);
      expect(find.text('Private A warehouse 0'), findsNothing);
      expect(find.text('Current B supplier 0'), findsOneWidget);
      expect(find.text('Current B warehouse 0'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'warehouse paging changes only its own request and keeps Previous after failure',
    (tester) async {
      final calls = <String>[];
      await workspace.mount(tester, const InventoryOperationsScreen(), (r, h) {
        final resource = r.path.split('/').last;
        calls.add(resource);
        serve(
          r,
          h,
          status:
              resource == 'warehouse-metrics' && r.queryParameters['page'] == 2
              ? 503
              : 200,
          data: metric(
            resource,
            r.queryParameters['store_id'],
            page: r.queryParameters['page'] ?? 1,
            total: resource == 'warehouse-metrics' ? 21 : 1,
          ),
        );
      });
      await tester.ensureVisible(find.text('Next locations'));
      final before = calls.length;
      await tester.tap(find.text('Next locations'));
      await tester.pumpAndSettle();
      expect(calls.length, before + 1);
      expect(calls.last, 'warehouse-metrics');
      expect(find.text('Private A warehouse 0'), findsNothing);
      expect(find.text('21 matching locations'), findsNothing);
      await tester.ensureVisible(find.text('Previous locations'));
      await tester.tap(find.text('Previous locations'));
      await tester.pumpAndSettle();
      expect(find.text('Private A warehouse 0'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'malformed summary is unavailable while genuine zero and absent metrics stay distinct',
    (tester) async {
      await workspace.mount(
        tester,
        const InventoryOperationsScreen(),
        (r, h) => serve(
          r,
          h,
          data: r.path.endsWith('operations-summary')
              ? {'store_id': fixtures.siteA, 'order_count': 0}
              : metric(r.path.split('/').last, fixtures.siteA),
        ),
      );
      expect(
        find.text(
          'Some counts are unavailable. Missing values are shown as —.',
        ),
        findsOneWidget,
      );
      expect(find.text('0'), findsOneWidget);
      expect(find.text('—'), findsNWidgets(7));
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'Operations dashboard is reachable through Inventory without issuing a command',
    (tester) async {
      final methods = <String>[];
      await workspace.mount(tester, const InventoryScreen(), (r, h) {
        methods.add(r.method);
        if (r.path.endsWith('/levels')) {
          workspace.respond(r, h, [workspace.record(fixtures.siteA)]);
        } else {
          serve(r, h);
        }
      });
      await tester.drag(
        find.byWidgetPredicate(
          (w) => w is ListView && w.scrollDirection == Axis.horizontal,
        ),
        const Offset(-1800, 0),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Operations dashboard'));
      await tester.pumpAndSettle();
      expect(find.byType(InventoryOperationsScreen), findsOneWidget);
      expect(find.text('Private A supplier 0'), findsOneWidget);
      expect(methods.every((m) => m == 'GET'), isTrue);
      expect(tester.takeException(), isNull);
    },
  );
}
