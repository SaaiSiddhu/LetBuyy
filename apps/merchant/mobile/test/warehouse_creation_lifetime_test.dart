import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/screens/inventory/purchase_orders_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'inventory_workspace_test.dart' as workspace;
import 'warehouse_create_form_test.dart' as forms;

void main() {
  testWidgets(
    'repeated creation confirmation preserves parent and dispatches one exact draft',
    (tester) async {
      final writes = <JsonMap>[];
      await workspace.mount(
        tester,
        const PurchaseOrdersScreen(),
        (r, h) => forms.respond(r, h, writes: writes),
      );
      await forms.tap(tester, find.text('New PO'));
      await forms.tap(tester, find.text('Choose receiving location'));
      await forms.tap(tester, find.text('Receiving warehouse'));
      await forms.chooseProduct(tester, 0, 'Small · SYN-S');
      await forms.tap(tester, find.text('Create purchase order'));
      final confirm = tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Confirm creation'),
          )
          .onPressed!;
      confirm();
      confirm();
      await tester.pumpAndSettle();
      expect(find.byType(PurchaseOrdersScreen), findsOneWidget);
      expect(find.text('New PO'), findsOneWidget);
      expect(find.text('Purchase order created'), findsOneWidget);
      expect(writes, hasLength(1));
      expect(
        (writes.single['lines'] as List).single['variant_id'],
        forms.small,
      );
      expect((writes.single['lines'] as List).single['quantity'], 1);
      expect((writes.single['lines'] as List).single['unit_cost'], 0);
      expect(tester.takeException(), isNull);
    },
  );
}
