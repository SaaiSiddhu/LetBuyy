import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/screens/inventory/purchase_orders_screen.dart';
import 'package:letbuyy_store/screens/inventory/transfers_screen.dart';
import 'inventory_workspace_test.dart' as workspace;
import 'support/warehouse_fixture.dart' as w;

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final transfer in [false, true]) {
    testWidgets(
      '${transfer ? 'transfer' : 'PO'} receipt Back reviews unsaved quantities without a command',
      (tester) async {
        var writes = 0;
        await workspace.mount(
          tester,
          transfer
              ? const InventoryTransfersScreen()
              : const PurchaseOrdersScreen(),
          (r, h) {
            if (r.method != 'GET') writes++;
            final row = w.warehouseDocument(
              transfer: transfer,
              site: workspace.siteA,
              received: 2,
              shipped: 3,
              lineCount: 2,
            );
            workspace.respond(
              r,
              h,
              r.path.endsWith('/${w.warehouseTarget}') ? row : [row],
            );
          },
        );
        await tester.tap(find.text('Receive'));
        await tester.pumpAndSettle();
        final field = find.byKey(
          const ValueKey('warehouse-receive-${w.warehouseLine}'),
        );
        await tester.enterText(field, '0');
        await tester.binding.handlePopRoute();
        await tester.pumpAndSettle();
        expect(find.text('Discard changes?'), findsOneWidget);
        expect(writes, 0);
        await tester.tap(
          find.descendant(
            of: find.byType(AlertDialog),
            matching: find.text('Cancel'),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Review stock receipt'), findsOneWidget);
        expect(tester.widget<CustomTextField>(field).controller!.text, '0');
        await tester.binding.handlePopRoute();
        await tester.pumpAndSettle();
        await tester.tap(find.text('Discard changes'));
        await tester.pumpAndSettle();
        expect(find.text('Review stock receipt'), findsNothing);
        expect(find.text('Receive'), findsOneWidget);
        expect(writes, 0);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
