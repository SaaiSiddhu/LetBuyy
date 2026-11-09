import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/screens/inventory/inventory_screen.dart';
import 'package:letbuyy_store/screens/inventory/purchase_orders_screen.dart';
import 'package:letbuyy_store/screens/inventory/transfers_screen.dart';
import 'inventory_workspace_test.dart' as workspace;
import 'warehouse_create_form_test.dart' as forms;
import 'support/warehouse_fixture.dart' as w;

void main() {
  for (final surface in [
    (name: 'stock', screen: const InventoryScreen(), button: 'Adjust'),
    (
      name: 'purchase order',
      screen: const PurchaseOrdersScreen(),
      button: 'Receive',
    ),
    (
      name: 'transfer',
      screen: const InventoryTransfersScreen(),
      button: 'Ship',
    ),
  ]) {
    for (final removed in [false, true]) {
      testWidgets(
        'captured ${surface.name} action cannot run after ${removed ? 'disposal' : 'covering navigation'}',
        (tester) async {
          var reads = 0, writes = 0;
          await workspace.mount(tester, surface.screen, (r, h) {
            if (r.method == 'GET') {
              reads++;
            } else {
              writes++;
            }
            final row = surface.name == 'stock'
                ? workspace.record(workspace.siteA)
                : w.warehouseDocument(
                    site: workspace.siteA,
                    transfer: surface.name == 'transfer',
                    shipped: 0,
                    status: surface.name == 'transfer' ? 'reserved' : 'ordered',
                  );
            workspace.respond(
              r,
              h,
              r.path.endsWith('/${w.warehouseTarget}') ? row : [row],
            );
          });
          final button = find.widgetWithText(OutlinedButton, surface.button);
          await tester.ensureVisible(button);
          await tester.pumpAndSettle();
          final action = tester.widget<OutlinedButton>(button).onPressed;
          expect(action, isNotNull);
          if (removed) {
            await tester.pumpWidget(
              const MaterialApp(home: Scaffold(body: Text('Destination'))),
            );
          } else {
            final context = tester.element(find.byWidget(surface.screen));
            unawaited(
              Navigator.of(context).push<void>(
                MaterialPageRoute(
                  builder: (_) => const Scaffold(body: Text('Destination')),
                ),
              ),
            );
            await tester.pumpAndSettle();
          }
          final before = reads;
          action!();
          await tester.pumpAndSettle();
          expect(reads, before);
          expect(writes, 0);
          expect(find.text('Destination'), findsOneWidget);
          expect(find.textContaining('Change quantity'), findsNothing);
          expect(find.text('Review stock shipment'), findsNothing);
          expect(find.text('Review stock receipt'), findsNothing);
          expect(tester.takeException(), isNull);
        },
      );
    }
  }
  testWidgets(
    'repeated option selection keeps the creation draft open without dispatch',
    (tester) async {
      var writes = 0;
      await workspace.mount(tester, const PurchaseOrdersScreen(), (r, h) {
        if (r.method != 'GET') writes++;
        forms.respond(r, h);
      });
      await forms.tap(tester, find.text('New PO'));
      await forms.tap(tester, find.text('Choose receiving location'));
      final choose = tester
          .widget<ListTile>(
            find.widgetWithText(ListTile, 'Receiving warehouse'),
          )
          .onTap!;
      choose();
      choose();
      await tester.pumpAndSettle();
      expect(find.text('New purchase order'), findsOneWidget);
      expect(find.text('Receiving warehouse'), findsOneWidget);
      expect(writes, 0);
      expect(tester.takeException(), isNull);
    },
  );
}
