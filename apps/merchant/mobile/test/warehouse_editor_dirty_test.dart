import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/screens/inventory/locations_screen.dart';
import 'package:letbuyy_store/screens/inventory/purchase_orders_screen.dart';
import 'inventory_workspace_test.dart' as workspace;
import 'warehouse_create_form_test.dart' as forms;

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final task in [
    (
      name: 'location',
      screen: const InventoryLocationsScreen(),
      open: 'New location',
      field: 'Name',
    ),
    (
      name: 'purchase order',
      screen: const PurchaseOrdersScreen(),
      open: 'New PO',
      field: 'Notes',
    ),
  ]) {
    testWidgets(
      '${task.name} first edit then immediate Back preserves the exact unsaved draft',
      (tester) async {
        var writes = 0;
        await workspace.mount(tester, task.screen, (r, h) {
          if (r.method != 'GET') writes++;
          forms.respond(r, h);
        });
        await forms.tap(tester, find.text(task.open));
        final field = find.byWidgetPredicate(
          (w) => w is TextField && w.decoration?.labelText == task.field,
        );
        await tester.scrollUntilVisible(
          field,
          160,
          scrollable: find
              .byWidgetPredicate(
                (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
              )
              .first,
        );
        await tester.pumpAndSettle();
        await tester.enterText(field, 'Exact unsaved warehouse draft');
        await tester.binding.handlePopRoute();
        await tester.pumpAndSettle();
        expect(find.text('Discard changes?'), findsOneWidget);
        await tester.tap(
          find.descendant(
            of: find.byType(AlertDialog),
            matching: find.text('Cancel'),
          ),
        );
        await tester.pumpAndSettle();
        expect(
          tester.widget<TextField>(field).controller!.text,
          'Exact unsaved warehouse draft',
        );
        expect(writes, 0);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
