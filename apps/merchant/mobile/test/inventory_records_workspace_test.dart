import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/screens/inventory/records_screen.dart';
import 'package:letbuyy_store/screens/inventory/inventory_screen.dart';
import 'package:letbuyy_store/screens/inventory/purchase_orders_screen.dart';
import 'package:letbuyy_store/screens/inventory/transfers_screen.dart';
import 'inventory_workspace_test.dart' as workspace;
import 'inventory_records_scope_test.dart' as fixtures;

void main() {
  testWidgets(
    'reservation filters use all seven server states and retire on a store switch',
    (tester) async {
      final queries = <Map<String, dynamic>>[];
      final stores = await workspace.mount(
        tester,
        const InventoryRecordsScreen(
          kind: InventoryRecordKind.reservations,
          productId: fixtures.productId,
          productName: 'Private selected product',
        ),
        (r, h) {
          queries.add(Map<String, dynamic>.from(r.queryParameters));
          fixtures.respond(r, h, [
            fixtures.reservation(
              site: r.queryParameters['store_id'],
              status: r.queryParameters['status'] ?? 'active',
              name: r.queryParameters['store_id'] == fixtures.siteA
                  ? 'Private A reserved'
                  : 'Current B reserved',
            ),
          ]);
        },
      );
      expect(queries.single['product_id'], fixtures.productId);
      for (final status in [
        'hold',
        'committed',
        'released',
        'expired',
        'fulfilled',
        'cancelled',
        'active',
      ]) {
        await tester.tap(find.byType(DropdownButtonFormField<String>));
        await tester.pumpAndSettle();
        await tester.ensureVisible(
          find.text('${status[0].toUpperCase()}${status.substring(1)}').last,
        );
        await tester.tap(
          find.text('${status[0].toUpperCase()}${status.substring(1)}').last,
        );
        await tester.pumpAndSettle();
        expect(queries.last['status'], status);
      }
      final change = stores.selectStore(stores.stores.last);
      await tester.pumpAndSettle();
      await change;
      expect(find.text('Private A reserved'), findsNothing);
      expect(find.textContaining('Private selected product'), findsNothing);
      expect(find.text('Current B reserved'), findsOneWidget);
      expect(queries.last['status'], isNull);
      expect(queries.last['product_id'], isNull);
      expect(
        tester
            .widget<DropdownButtonFormField<String>>(
              find.byType(DropdownButtonFormField<String>),
            )
            .initialValue,
        '',
      );
      expect(tester.takeException(), isNull);
    },
  );

  for (final kind in [
    InventoryRecordKind.reservations,
    InventoryRecordKind.receipts,
  ]) {
    testWidgets(
      '${kind.name} clears rows and count on page failure with Previous recovery',
      (tester) async {
        await workspace.mount(tester, InventoryRecordsScreen(kind: kind), (
          r,
          h,
        ) {
          fixtures.respond(
            r,
            h,
            r.queryParameters['page'] == 2
                ? {}
                : [
                    kind == InventoryRecordKind.reservations
                        ? fixtures.reservation()
                        : fixtures.receipt(),
                  ],
            status: r.queryParameters['page'] == 2 ? 503 : 200,
            meta: {'has_next': true, 'total': 21},
          );
        });
        final label = kind == InventoryRecordKind.reservations
            ? 'Synthetic held stock'
            : 'Purchase order receipt';
        expect(find.text(label), findsOneWidget);
        await tester.tap(find.text('Next'));
        await tester.pumpAndSettle();
        expect(find.text(label), findsNothing);
        expect(find.text('21 matching ${kind.name}'), findsNothing);
        expect(find.text('Page 2'), findsOneWidget);
        await tester.tap(find.text('Previous'));
        await tester.pumpAndSettle();
        expect(find.text(label), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets(
    'receipt families, observed quantities and expanded notes stay private across store changes',
    (tester) async {
      final stores = await workspace.mount(
        tester,
        const InventoryRecordsScreen(kind: InventoryRecordKind.receipts),
        (r, h) {
          final site = r.queryParameters['store_id'] as String;
          fixtures.respond(
            r,
            h,
            [
              {
                ...fixtures.receipt(site: site),
                'notes': site == fixtures.siteA
                    ? 'Private A receiving note'
                    : 'Current B note',
              },
              {
                ...fixtures.receipt(site: site, type: 'transfer'),
                'id': '99999999-9999-4999-8999-999999999999',
              },
            ],
            meta: {'total': 2},
          );
        },
      );
      expect(find.text('Purchase order receipt'), findsOneWidget);
      expect(find.text('Transfer receipt'), findsOneWidget);
      expect(find.textContaining('3 received'), findsNWidgets(2));
      expect(find.textContaining('05:30 AM IST'), findsNWidgets(2));
      await tester.tap(find.text('Purchase order receipt'));
      await tester.pumpAndSettle();
      expect(find.text('Private A receiving note'), findsOneWidget);
      final change = stores.selectStore(stores.stores.last);
      await tester.pumpAndSettle();
      await change;
      expect(find.text('Private A receiving note'), findsNothing);
      expect(find.text('2 matching receipts'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  for (final source in ['purchase_order', 'transfer']) {
    testWidgets(
      '$source card opens its server-filtered receipts and can clear the filter',
      (tester) async {
        final queries = <Map<String, dynamic>>[];
        final methods = <String>[];
        await workspace.mount(
          tester,
          source == 'purchase_order'
              ? const PurchaseOrdersScreen()
              : const InventoryTransfersScreen(),
          (r, h) {
            methods.add(r.method);
            if (r.path.endsWith('/receipts')) {
              queries.add(Map<String, dynamic>.from(r.queryParameters));
              fixtures.respond(r, h, [
                fixtures.receipt(
                  type: source,
                  parent: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
                ),
              ]);
            } else {
              workspace.respond(r, h, [workspace.record(fixtures.siteA)]);
            }
          },
        );
        await tester.tap(find.byTooltip('View receipts'));
        await tester.pumpAndSettle();
        expect(
          queries.single[source == 'purchase_order' ? 'po_id' : 'transfer_id'],
          'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        );
        expect(
          find.text(
            source == 'purchase_order'
                ? 'Purchase order receipts'
                : 'Transfer receipts',
          ),
          findsOneWidget,
        );
        await tester.tap(find.byTooltip('Show all receipts'));
        await tester.pumpAndSettle();
        expect(queries.last['po_id'], isNull);
        expect(queries.last['transfer_id'], isNull);
        expect(methods.every((method) => method == 'GET'), isTrue);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets(
    'a stock row opens product-filtered reservations through the actual named route',
    (tester) async {
      final queries = <Map<String, dynamic>>[];
      await workspace.mount(tester, const InventoryScreen(), (r, h) {
        if (r.path.endsWith('/reservations')) {
          queries.add(Map<String, dynamic>.from(r.queryParameters));
          fixtures.respond(r, h, [fixtures.reservation()]);
        } else {
          workspace.respond(r, h, [workspace.record(fixtures.siteA)]);
        }
      });
      await tester.tap(find.byTooltip('View reservations'));
      await tester.pumpAndSettle();
      expect(queries.single['product_id'], fixtures.productId);
      expect(find.text('Private A • all variants'), findsOneWidget);
      expect(find.text('Synthetic held stock'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  for (final status in [200, 403, 503]) {
    testWidgets(
      'receipt $status malformed or denied reads cannot become a successful empty state',
      (tester) async {
        await workspace.mount(
          tester,
          const InventoryRecordsScreen(kind: InventoryRecordKind.receipts),
          (r, h) {
            fixtures.respond(r, h, [], status: status, meta: {'total': null});
          },
        );
        expect(find.text('No receipts on this page.'), findsNothing);
        expect(find.text('0 matching receipts'), findsNothing);
        expect(find.text('Retry records'), findsOneWidget);
        if (status == 403)
          expect(find.textContaining('You do not have access'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
