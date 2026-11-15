import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/screens/inventory/purchase_orders_screen.dart';
import 'package:letbuyy_store/screens/inventory/transfers_screen.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/widgets/shared/warehouse_document_detail.dart';
import 'inventory_workspace_test.dart' as workspace;
import 'support/warehouse_fixture.dart' as w;

const privateNote = 'Exact saved warehouse note';

Map<String, dynamic> document(bool transfer, {String site = workspace.siteA}) {
  final row = w.warehouseDocument(
    transfer: transfer,
    site: site,
    received: 4,
    shipped: 4,
    lineCount: 4,
  );
  row['notes'] = privateNote;
  final lines = row['lines'] as List;
  for (var i = 1; i < lines.length; i++) {
    (lines[i] as Map)['variant_id'] =
        'aaaaaaaa-aaaa-4aaa-8aaa-${i.toString().padLeft(12, '0')}';
  }
  return row;
}

String entry(bool transfer) =>
    transfer ? 'View transfer' : 'View purchase order';
Finder action(String label) =>
    find.byWidgetPredicate((w) => w is IconButton && w.tooltip == label);
Widget screen(bool transfer) =>
    transfer ? const InventoryTransfersScreen() : const PurchaseOrdersScreen();
Finder note() => find.byWidgetPredicate(
  (w) => w is SelectableText && w.data == 'Notes: $privateNote',
);

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final transfer in [false, true]) {
    testWidgets(
      'document accessibility exposes saved line facts beside selectable IDs transfer=$transfer',
      (tester) async {
        final semantics = tester.ensureSemantics();
        try {
          await workspace.mount(tester, screen(transfer), (r, h) {
            final row = w.warehouseDocument(
              transfer: transfer,
              site: workspace.siteA,
              received: 4,
              shipped: 4,
            );
            workspace.respond(
              r,
              h,
              r.path.endsWith('/${w.warehouseTarget}') ? row : [row],
            );
          });
          await tester.tap(action(entry(transfer)));
          await tester.pumpAndSettle();
          expect(
            find.bySemanticsLabel(
              transfer
                  ? 'Requested: 4 · Shipped: 4 · Received: 4'
                  : 'Ordered: 4 · Received: 4 · Remaining: 0',
            ),
            findsWidgets,
          );
          expect(
            find.bySemanticsLabel(
              transfer ? 'Not yet received: 0' : 'Unit cost: INR 12.25',
            ),
            findsWidgets,
          );
          final product = tester
              .getSemantics(
                find.byWidgetPredicate(
                  (widget) =>
                      widget is SelectableText &&
                      widget.data == 'Product ID: ${w.warehouseProduct}',
                ),
              )
              .getSemanticsData();
          expect(
            '${product.label} ${product.value}',
            contains('Product ID: ${w.warehouseProduct}'),
          );
          expect(
            find.bySemanticsLabel(RegExp('Synthetic product 1')),
            findsWidgets,
          );
          expect(tester.takeException(), isNull);
        } finally {
          semantics.dispose();
        }
      },
    );
    for (final dark in [false, true]) {
      testWidgets(
        'completed document opens every returned line and keeps list context transfer=$transfer dark=$dark',
        (tester) async {
          var reads = 0, listReads = 0, writes = 0;
          await workspace.mount(
            tester,
            screen(transfer),
            (r, h) {
              if (r.method != 'GET') writes++;
              final detail = r.path.endsWith('/${w.warehouseTarget}');
              if (detail) {
                reads++;
                expect(r.queryParameters['store_id'], workspace.siteA);
              } else {
                listReads++;
              }
              workspace.respond(
                r,
                h,
                detail ? document(transfer) : [document(transfer)],
              );
            },
            windowSize: const Size(320, 640),
            textScale: 2.4,
            theme: dark ? StoreTheme.dark() : StoreTheme.light(),
          );
          expect(find.textContaining('Synthetic product 4'), findsNothing);
          await tester.scrollUntilVisible(
            action(entry(transfer)),
            160,
            scrollable: find
                .byWidgetPredicate(
                  (w) =>
                      w is Scrollable && w.axisDirection == AxisDirection.down,
                )
                .first,
          );
          await tester.pumpAndSettle();
          await tester.tap(action(entry(transfer)));
          await tester.pumpAndSettle();
          expect(reads, 1);
          expect(note(), findsOneWidget);
          final fourth = find.textContaining('Synthetic product 4');
          await tester.scrollUntilVisible(
            fourth,
            160,
            scrollable: find
                .byWidgetPredicate(
                  (w) =>
                      w is Scrollable && w.axisDirection == AxisDirection.down,
                )
                .first,
          );
          await tester.pumpAndSettle();
          expect(fourth, findsOneWidget);
          expect(
            find.textContaining(
              transfer
                  ? 'Requested: 4 · Shipped: 4 · Received: 4'
                  : 'Ordered: 4 · Received: 4 · Remaining: 0',
            ),
            findsWidgets,
          );
          if (!transfer)
            expect(find.text('Unit cost: INR 12.25'), findsWidgets);
          expect(tester.takeException(), isNull);
          await tester.binding.handlePopRoute();
          await tester.pumpAndSettle();
          expect(find.byType(WarehouseDocumentDetail), findsNothing);
          expect(action(entry(transfer)), findsOneWidget);
          expect(listReads, 2);
          expect(writes, 0);
          expect(tester.takeException(), isNull);
        },
      );
    }

    for (final status in [401, 403, 404, 503]) {
      testWidgets(
        'document refresh $status retains only a permitted prior read transfer=$transfer',
        (tester) async {
          var detailReads = 0, writes = 0;
          await workspace.mount(tester, screen(transfer), (r, h) {
            if (r.method != 'GET') writes++;
            if (r.path.endsWith('/${w.warehouseTarget}')) {
              detailReads++;
              workspace.respond(
                r,
                h,
                detailReads == 1 ? document(transfer) : <String, Object>{},
                status: detailReads == 1 ? 200 : status,
              );
            } else {
              workspace.respond(r, h, [document(transfer)]);
            }
          });
          await tester.tap(action(entry(transfer)));
          await tester.pumpAndSettle();
          expect(note(), findsOneWidget);
          await tester.tap(action('Refresh document'));
          await tester.pumpAndSettle();
          expect(detailReads, 2);
          expect(note(), status == 503 ? findsOneWidget : findsNothing);
          expect(
            find.text(
              'Showing the last confirmed document. Refresh did not complete.',
            ),
            status == 503 ? findsOneWidget : findsNothing,
          );
          expect(
            find.textContaining('Product ID:'),
            status == 503 ? findsWidgets : findsNothing,
          );
          expect(writes, 0);
          expect(tester.takeException(), isNull);
        },
      );
    }

    testWidgets(
      'held document read retires through store A-B-A transfer=$transfer',
      (tester) async {
        final entered = Completer<void>(), release = Completer<void>();
        var reads = 0, writes = 0;
        final stores = await workspace.mount(tester, screen(transfer), (
          r,
          h,
        ) async {
          if (r.method != 'GET') writes++;
          final site =
              r.queryParameters['store_id'] as String? ?? workspace.siteA;
          if (r.path.endsWith('/${w.warehouseTarget}')) {
            reads++;
            entered.complete();
            await release.future;
            workspace.respond(r, h, document(transfer, site: site));
          } else {
            workspace.respond(r, h, [document(transfer, site: site)]);
          }
        });
        addTearDown(() {
          if (!release.isCompleted) release.complete();
        });
        await tester.tap(action(entry(transfer)));
        await tester.pump();
        for (var i = 0; i < 10 && !entered.isCompleted; i++) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        expect(entered.isCompleted, isTrue);
        expect(
          find.text('Reading the current saved document…'),
          findsOneWidget,
        );
        final b = stores.selectStore(stores.stores.last);
        await tester.pumpAndSettle();
        await b;
        final a = stores.selectStore(stores.stores.first);
        await tester.pumpAndSettle();
        await a;
        release.complete();
        await tester.pumpAndSettle();
        expect(find.text('Store access changed'), findsOneWidget);
        expect(note(), findsNothing);
        expect(reads, 1);
        expect(writes, 0);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets(
      'disposed document and receipt callbacks are inert transfer=$transfer',
      (tester) async {
        var reads = 0;
        await workspace.mount(tester, screen(transfer), (r, h) {
          if (r.path.endsWith('/${w.warehouseTarget}')) reads++;
          workspace.respond(r, h, [document(transfer)]);
        });
        final open = tester
            .widget<IconButton>(action(entry(transfer)))
            .onPressed!;
        final receipts = tester
            .widget<IconButton>(action('View receipts'))
            .onPressed!;
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pumpAndSettle();
        expect(() {
          open();
          receipts();
        }, returnsNormally);
        await tester.pumpAndSettle();
        expect(reads, 0);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets(
      'covered document and receipt callbacks cannot open another route transfer=$transfer',
      (tester) async {
        var reads = 0;
        await workspace.mount(tester, screen(transfer), (r, h) {
          final detail = r.path.endsWith('/${w.warehouseTarget}');
          if (detail) reads++;
          workspace.respond(
            r,
            h,
            detail ? document(transfer) : [document(transfer)],
          );
        });
        final open = tester
            .widget<IconButton>(action(entry(transfer)))
            .onPressed!;
        final receipts = tester
            .widget<IconButton>(action('View receipts'))
            .onPressed!;
        open();
        await tester.pumpAndSettle();
        open();
        receipts();
        await tester.pumpAndSettle();
        expect(find.byType(WarehouseDocumentDetail), findsOneWidget);
        expect(reads, 1);
        expect(note(), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
