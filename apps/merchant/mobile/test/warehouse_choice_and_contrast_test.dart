import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/screens/inventory/inventory_screen.dart';
import 'package:letbuyy_store/screens/inventory/purchase_orders_screen.dart';
import 'package:letbuyy_store/screens/inventory/transfers_screen.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/widgets/shared/warehouse_status_chip.dart';
import 'inventory_workspace_test.dart' as workspace;
import 'support/warehouse_fixture.dart' as w;

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final dark in [false, true]) {
    testWidgets('document statuses remain readable in dark=$dark', (
      tester,
    ) async {
      for (final status in [
        'draft',
        'ordered',
        'reserved',
        'shipped',
        'partially_received',
        'received',
        'cancelled',
        'closed',
        'unknown',
      ]) {
        await tester.pumpWidget(
          MaterialApp(
            theme: dark ? StoreTheme.dark() : StoreTheme.light(),
            home: Scaffold(body: WarehouseStatusChip(status: status)),
          ),
        );
        final text = tester.widget<Text>(find.byType(Text).last);
        final decorated = find
            .ancestor(
              of: find.byType(Text).last,
              matching: find.byWidgetPredicate(
                (w) =>
                    w is DecoratedBox && w.decoration is BoxDecoration ||
                    w is Container && w.decoration is BoxDecoration,
              ),
            )
            .first;
        final widget = tester.widget(decorated);
        final decoration =
            (widget is Container
                    ? widget.decoration
                    : (widget as DecoratedBox).decoration)
                as BoxDecoration;
        final surface = dark ? const Color(0xFF1E293B) : Colors.white;
        final background = Color.alphaBlend(decoration.color!, surface);
        final foreground = text.style!.color!;
        final a = foreground.computeLuminance(),
            b = background.computeLuminance();
        final contrast = ((a > b ? a : b) + .05) / ((a > b ? b : a) + .05);
        expect(
          contrast,
          greaterThanOrEqualTo(4.5),
          reason: '$status dark=$dark',
        );
      }
    });

    for (final transfer in [false, true]) {
      testWidgets(
        'receipt quantity accepts an actual pointer before typing transfer=$transfer dark=$dark',
        (tester) async {
          final semantics = tester.ensureSemantics();
          try {
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
                  received: 0,
                  shipped: 4,
                );
                workspace.respond(
                  r,
                  h,
                  r.path.endsWith('/${w.warehouseTarget}') ? row : [row],
                );
              },
              theme: dark ? StoreTheme.dark() : StoreTheme.light(),
            );
            await tester.tap(find.text('Receive'));
            await tester.pumpAndSettle();
            final field = find.descendant(
              of: find.byKey(
                const ValueKey('warehouse-receive-${w.warehouseLine}'),
              ),
              matching: find.byType(EditableText),
            );
            await tester.ensureVisible(field);
            await tester.pumpAndSettle();
            final host = find.byKey(
              const ValueKey('warehouse-receive-${w.warehouseLine}'),
            );
            // The unfocused native target must not absorb the preceding product
            // identity and summary: its reported center would miss the input.
            expect(
              tester.getSemantics(field).rect.height,
              lessThanOrEqualTo(tester.getSize(host).height + 1),
            );
            await tester.tap(host);
            await tester.pumpAndSettle();
            expect(
              tester.widget<EditableText>(field).focusNode.hasFocus,
              isTrue,
            );
            expect(tester.testTextInput.isVisible, isTrue);
            expect(writes, 0);
            expect(tester.takeException(), isNull);
          } finally {
            semantics.dispose();
          }
        },
      );
    }
  }

  testWidgets(
    'stock location choice reaches page2 and binds its exact location to the original adjustment',
    (tester) async {
      const selected = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000021';
      final queries = <Map<String, dynamic>>[],
          writes = <Map<String, dynamic>>[];
      await workspace.mount(tester, const InventoryScreen(), (r, h) {
        if (r.method != 'GET') {
          writes.add(Map<String, dynamic>.from(r.data as Map));
          workspace.respond(r, h, <String, Object>{}, status: 503);
          return;
        }
        if (r.path.endsWith('/locations')) {
          queries.add(Map<String, dynamic>.from(r.queryParameters));
          final page = r.queryParameters['page'] as int;
          workspace.respond(
            r,
            h,
            [
              if (page == 1)
                for (var i = 1; i <= 20; i++)
                  w.warehouseLocationRecord(
                    site: workspace.siteA,
                    id: 'aaaaaaaa-aaaa-4aaa-8aaa-${i.toString().padLeft(12, '0')}',
                    name: 'Warehouse $i',
                  ),
              if (page == 2)
                w.warehouseLocationRecord(
                  site: workspace.siteA,
                  id: selected,
                  name: 'Warehouse 21',
                ),
            ],
            more: page == 1,
            meta: {'total': 21},
          );
        } else {
          workspace.respond(r, h, [
            {
              ...workspace.record(workspace.siteA),
              'location_id': null,
              'location_name': '',
            },
          ]);
        }
      });
      await tester.tap(find.text('Adjust'));
      await tester.pumpAndSettle();
      expect(find.byTooltip('Next choices'), findsOneWidget);
      await tester.tap(find.byTooltip('Next choices'));
      await tester.pumpAndSettle();
      expect(find.text('Warehouse 21'), findsOneWidget);
      expect(find.text('Warehouse 1'), findsNothing);
      await tester.tap(find.text('Warehouse 21'));
      await tester.pumpAndSettle();
      final quantity = find.byWidgetPredicate(
        (w) => w is TextField && w.decoration?.labelText == 'Change quantity',
      );
      await tester.enterText(quantity, '2');
      await tester.tap(find.text('Apply'));
      await tester.pumpAndSettle();
      expect(queries.map((q) => q['page']), [1, 2]);
      expect(
        queries.every(
          (q) =>
              q['status'] == 'all' &&
              q['limit'] == 20 &&
              q['sort'] == 'name_asc' &&
              q['store_id'] == workspace.siteA,
        ),
        isTrue,
      );
      expect(writes, hasLength(1));
      expect(writes.single['location_id'], selected);
      expect(writes.single['adjustment'], 2);
      expect(find.text('A stock change needs confirmation'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
