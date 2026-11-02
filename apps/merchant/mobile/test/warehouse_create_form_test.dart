import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/screens/inventory/purchase_orders_screen.dart';
import 'package:letbuyy_store/screens/inventory/transfers_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/inventory_service.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'inventory_workspace_test.dart' as workspace;
import 'inventory_scope_boundary_test.dart' as scope;
import 'support/warehouse_fixture.dart' as w;

const small = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
    large = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002';
JsonMap product() => {
  'id': w.warehouseProduct,
  'store_id': workspace.siteA,
  'name': 'Synthetic shirt',
  'price': 12.25,
  'status': 'active',
  'version': 1,
  'variants': [
    for (final pair in [(small, 'Small', 'SYN-S'), (large, 'Large', 'SYN-L')])
      {
        'id': pair.$1,
        'product_id': w.warehouseProduct,
        'title': pair.$2,
        'sku': pair.$3,
      },
  ],
};
void respond(
  RequestOptions r,
  RequestInterceptorHandler h, {
  bool failOptions = false,
  List<JsonMap>? writes,
}) {
  final site = r.queryParameters['store_id']?.toString() ?? workspace.siteA;
  if (r.method == 'POST') {
    final body = Map<String, dynamic>.from(r.data as Map);
    writes?.add(body);
    final command = {...body}
      ..remove('store_id')
      ..remove('idempotency_key');
    final po = r.path.endsWith('/purchase-orders');
    command.putIfAbsent('notes', () => null);
    if (po) {
      command.putIfAbsent('supplier_id', () => null);
      command.putIfAbsent('expected_at', () => null);
    }
    final intent = WarehouseCommandIntent.fromJson({
      'operation': po ? 'purchase_order.create' : 'transfer.create',
      'target_id': null,
      'command': command,
    });
    final ack = w.warehouseAck(intent, body['idempotency_key'], site: site);
    ack['lines'] = [
      for (var i = 0; i < (command['lines'] as List).length; i++)
        {
          'id': '77777777-7777-4777-8777-${i.toString().padLeft(12, '0')}',
          'site_id': site,
          po ? 'purchase_order_id' : 'transfer_id': w.warehouseTarget,
          'product_id': w.warehouseProduct,
          'variant_id': (command['lines'] as List)[i]['variant_id'],
          po ? 'quantity_ordered' : 'quantity_requested':
              (command['lines'] as List)[i]['quantity'],
          'quantity_received': 0,
          if (po)
            'unit_cost': (command['lines'] as List)[i]['unit_cost']
          else
            'quantity_shipped': 0,
        },
    ];
    workspace.respond(r, h, ack, status: 201);
    return;
  }
  if (r.path.endsWith('/locations')) {
    workspace.respond(
      r,
      h,
      failOptions
          ? []
          : [
              w.warehouseLocationRecord(
                site: site,
                name: 'Receiving warehouse',
              ),
              w.warehouseLocationRecord(
                site: site,
                id: w.warehouseDestination,
                name: 'Destination warehouse',
              ),
            ],
      status: failOptions ? 403 : 200,
    );
    return;
  }
  if (r.path.endsWith('/suppliers')) {
    workspace.respond(r, h, [
      w.warehouseSupplierRecord(site: site, name: 'Synthetic supplier'),
    ]);
    return;
  }
  if (r.path.endsWith('/products')) {
    h.resolve(
      Response(
        requestOptions: r,
        statusCode: 200,
        data: {
          'data': [product()],
          'meta': {
            'page': 1,
            'per_page': 20,
            'has_next': false,
            'total': 1,
            'total_is_exact': false,
          },
        },
      ),
    );
    return;
  }
  if (r.path.endsWith('/products/${w.warehouseProduct}')) {
    workspace.respond(r, h, product());
    return;
  }
  workspace.respond(r, h, []);
}

Future<void> tap(WidgetTester tester, Finder finder) async {
  expect(
    finder,
    findsOneWidget,
    reason: tester
        .widgetList<Text>(find.byType(Text))
        .map((text) => text.data)
        .whereType<String>()
        .join(' | '),
  );
  await Scrollable.ensureVisible(tester.element(finder), alignment: .5);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Future<void> chooseProduct(
  WidgetTester tester,
  int index,
  String variant,
) async {
  await tap(tester, find.text('Choose product for line ${index + 1}'));
  await tap(tester, find.text('Synthetic shirt').last);
  await tap(tester, find.byType(DropdownButtonFormField<String>).last);
  await tap(tester, find.text(variant).last);
}

void main() {
  for (final transfer in [false, true])
    testWidgets(
      '${transfer ? 'transfer' : 'PO'} selects current choices, reviews two variants and sends one canonical multi-line command',
      (tester) async {
        final writes = <JsonMap>[];
        await workspace.mount(
          tester,
          transfer
              ? const InventoryTransfersScreen()
              : const PurchaseOrdersScreen(),
          (r, h) => respond(r, h, writes: writes),
        );
        await tap(tester, find.text(transfer ? 'New transfer' : 'New PO'));
        expect(find.text('Supplier ID (optional)'), findsNothing);
        expect(find.text('Product ID or scanned barcode'), findsNothing);
        await tap(
          tester,
          find.text(
            transfer ? 'Choose source location' : 'Choose receiving location',
          ),
        );
        await tap(tester, find.text('Receiving warehouse'));
        if (transfer) {
          await tap(tester, find.text('Choose destination location'));
          await tap(tester, find.text('Destination warehouse'));
        } else {
          await tap(tester, find.text('Choose supplier (optional)'));
          await tap(tester, find.text('Synthetic supplier'));
        }
        await chooseProduct(tester, 0, 'Small · SYN-S');
        await tester.enterText(
          find.byKey(const ValueKey('warehouse-quantity-0')),
          '2',
        );
        if (!transfer)
          await tester.enterText(
            find.byKey(const ValueKey('warehouse-cost-0')),
            '0.29',
          );
        await tap(tester, find.text('Add product line'));
        await chooseProduct(tester, 1, 'Large · SYN-L');
        await tester.enterText(
          find.byKey(const ValueKey('warehouse-quantity-1')),
          '3',
        );
        if (!transfer)
          await tester.enterText(
            find.byKey(const ValueKey('warehouse-cost-1')),
            '12.25',
          );
        if (!transfer) {
          await tester.ensureVisible(
            find.byKey(const ValueKey('warehouse-cost-0')),
          );
          await tester.enterText(
            find.byKey(const ValueKey('warehouse-cost-0')),
            'bad cost',
          );
          await tap(tester, find.text('Create purchase order'));
          expect(find.text('Review purchase order'), findsNothing);
          expect(writes, isEmpty);
          await tester.ensureVisible(
            find.byKey(const ValueKey('warehouse-cost-0')),
          );
          await tester.enterText(
            find.byKey(const ValueKey('warehouse-cost-0')),
            '0.29',
          );
        }
        await tap(
          tester,
          find.text(transfer ? 'Create transfer' : 'Create purchase order'),
        );
        expect(
          find.text(transfer ? 'Review transfer' : 'Review purchase order'),
          findsOneWidget,
        );
        expect(writes, isEmpty);
        await tap(tester, find.text('Back to draft'));
        expect(
          tester
              .widget<TextField>(
                find.byKey(const ValueKey('warehouse-quantity-0')),
              )
              .controller!
              .text,
          '2',
        );
        await tap(
          tester,
          find.text(transfer ? 'Create transfer' : 'Create purchase order'),
        );
        await tap(tester, find.text('Confirm creation'));
        expect(writes, hasLength(1));
        final lines = writes.single['lines'] as List;
        expect(lines, hasLength(2));
        expect(lines[0]['variant_id'], small);
        expect(lines[1]['variant_id'], large);
        expect(lines.map((line) => line['quantity']).toList(), [2, 3]);
        if (!transfer) {
          expect(lines.map((line) => line['unit_cost']).toList(), [
            0.29,
            12.25,
          ]);
          expect(writes.single['supplier_id'], w.warehouseDestination);
        }
        expect(
          find.text(transfer ? 'Transfer created' : 'Purchase order created'),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
      },
    );
  testWidgets(
    'denied warehouse options retain a recoverable selector and cannot create a raw-ID draft',
    (tester) async {
      final writes = <JsonMap>[];
      await workspace.mount(
        tester,
        const PurchaseOrdersScreen(),
        (r, h) => respond(r, h, failOptions: true, writes: writes),
      );
      await tap(tester, find.text('New PO'));
      await tap(tester, find.text('Choose receiving location'));
      expect(find.text('Retry choices'), findsOneWidget);
      expect(find.text('No matching choices on this page.'), findsNothing);
      expect(writes, isEmpty);
      await tap(tester, find.byTooltip('Close choices'));
      await tap(tester, find.text('Create purchase order'));
      expect(
        find.textContaining('Choose the current locations'),
        findsOneWidget,
      );
      expect(find.text('Confirm creation'), findsNothing);
      expect(writes, isEmpty);
    },
  );
  testWidgets(
    'removing a draft line keeps remaining controller values and closes without effects',
    (tester) async {
      await workspace.mount(tester, const PurchaseOrdersScreen(), respond);
      await tap(tester, find.text('New PO'));
      await tap(tester, find.text('Add product line'));
      await tester.ensureVisible(
        find.byKey(const ValueKey('warehouse-quantity-1')),
      );
      await tester.enterText(
        find.byKey(const ValueKey('warehouse-quantity-1')),
        '7',
      );
      await tap(tester, find.byTooltip('Remove line 1'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.byKey(const ValueKey('warehouse-quantity-0')),
        -120,
        scrollable: find.byType(Scrollable).last,
      );
      expect(
        tester
            .widget<TextField>(
              find.byKey(const ValueKey('warehouse-quantity-0')),
            )
            .controller!
            .text,
        '7',
      );
      await tap(tester, find.byTooltip('Close draft'));
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'an open option picker retires across store A-B-A before its delayed private response',
    (tester) async {
      final entered = Completer<void>(), release = Completer<void>();
      final writes = <JsonMap>[];
      final stores = await workspace.mount(
        tester,
        const PurchaseOrdersScreen(),
        (r, h) async {
          if (r.path.endsWith('/locations')) {
            entered.complete();
            await release.future;
          }
          respond(r, h, writes: writes);
        },
      );
      await tap(tester, find.text('New PO'));
      await tester.tap(find.text('Choose receiving location'));
      await tester.pump();
      for (var i = 0; i < 5 && !entered.isCompleted; i++)
        await tester.pump(const Duration(milliseconds: 100));
      expect(
        entered.isCompleted,
        isTrue,
        reason:
            'The current option request must start before switching stores.',
      );
      final toB = stores.selectStore(stores.stores.last);
      await tester.pumpAndSettle();
      await toB;
      final toA = stores.selectStore(stores.stores.first);
      await tester.pumpAndSettle();
      await toA;
      release.complete();
      await tester.pumpAndSettle();
      expect(find.text('Receiving warehouse'), findsNothing);
      expect(find.text('Store access changed'), findsNWidgets(2));
      await tap(tester, find.text('Close').last);
      await tap(tester, find.text('Close'));
      expect(writes, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  for (final fault in [
    'missing-page',
    'page',
    'limit',
    'more',
    'duplicate',
    'foreign',
    'alias',
    'deleted',
  ])
    test('warehouse product options refuse $fault', () async {
      final api = scope.client((r, h) {
        final record = product(),
            rows = [record],
            meta = <String, dynamic>{
              'page': 1,
              'per_page': 20,
              'has_next': false,
            };
        if (fault == 'missing-page') meta.remove('page');
        if (fault == 'page') meta['page'] = 2;
        if (fault == 'limit') meta['per_page'] = 100;
        if (fault == 'more') meta['has_next'] = 'false';
        if (fault == 'duplicate') rows.add(record);
        if (fault == 'foreign') record['store_id'] = scope.b;
        if (fault == 'alias') record['site_id'] = scope.b;
        if (fault == 'deleted') record['deleted_at'] = '2026-11-01T00:00:00Z';
        h.resolve(
          Response(
            requestOptions: r,
            statusCode: 200,
            data: {'data': rows, 'meta': meta},
          ),
        );
      });
      await expectLater(
        ProductService(api: api).readWarehouseProducts(workspace.siteA),
        throwsA(isA<ApiException>()),
      );
    });
  test(
    'warehouse product choices do not replace the main catalog or fabricate an exact population',
    () async {
      final api = scope.client((r, h) {
        h.resolve(
          Response(
            requestOptions: r,
            statusCode: 200,
            data: {
              'data': [product()],
              'meta': {
                'page': r.queryParameters['page'],
                'per_page': 20,
                'has_next': false,
                'total_is_exact': false,
              },
            },
          ),
        );
      });
      final service = ProductService(api: api);
      await service.fetchProducts(workspace.siteA);
      final before = service.products;
      final result = await service.readWarehouseProducts(
        workspace.siteA,
        page: 2,
      );
      expect(result.meta['total_is_exact'], false);
      expect(result.data.single.name, 'Synthetic shirt');
      expect(service.products, before);
    },
  );
  for (final fault in [
    'missing-variants',
    'foreign-variant',
    'duplicate-variant',
    'deleted-variant',
    'empty-title',
  ])
    test('fresh product selection refuses $fault', () async {
      final api = scope.client((r, h) {
        final row = product();
        if (fault == 'missing-variants') row.remove('variants');
        if (fault == 'empty-title')
          (row['variants'] as List).first['title'] = '';
        if (fault == 'foreign-variant')
          (row['variants'] as List).first['product_id'] = w.warehouseTarget;
        if (fault == 'duplicate-variant')
          (row['variants'] as List).add((row['variants'] as List).first);
        if (fault == 'deleted-variant')
          (row['variants'] as List).first['deleted_at'] =
              '2026-11-01T00:00:00Z';
        workspace.respond(r, h, row);
      });
      await expectLater(
        ProductService(
          api: api,
        ).readWarehouseProduct(w.warehouseProduct, workspace.siteA),
        throwsA(isA<ApiException>()),
      );
    });
}
