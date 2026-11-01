import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/screens/inventory/locations_screen.dart';
import 'package:letbuyy_store/screens/inventory/suppliers_screen.dart';
import 'inventory_workspace_test.dart' as workspace;

void main() {
  for (final supplier in [false, true])
    testWidgets(
      '${supplier ? 'supplier' : 'location'} keeps an invalid form open without dispatch or a false saved-request claim',
      (tester) async {
        var posts = 0;
        await workspace.mount(
          tester,
          supplier
              ? const InventorySuppliersScreen()
              : const InventoryLocationsScreen(),
          (r, h) {
            if (r.method == 'POST') posts++;
            workspace.respond(r, h, []);
          },
        );
        await tester.tap(find.text(supplier ? 'New supplier' : 'New location'));
        await tester.pumpAndSettle();
        final fields = find.byType(TextField);
        await tester.enterText(fields.at(0), 'Synthetic creation');
        await tester.enterText(
          fields.at(supplier ? 2 : 4),
          supplier ? 'invalid-email' : 'IND',
        );
        final create = find.text(
          supplier ? 'Create supplier' : 'Create location',
        );
        await tester.ensureVisible(create);
        await tester.tap(create);
        await tester.pumpAndSettle();
        expect(create, findsOneWidget);
        expect(posts, 0);
        expect(
          find.textContaining(supplier ? 'valid email' : 'two-letter country'),
          findsOneWidget,
        );
        expect(
          find.text('Warehouse request awaiting confirmation'),
          findsNothing,
        );
        expect(tester.takeException(), isNull);
      },
    );
}
