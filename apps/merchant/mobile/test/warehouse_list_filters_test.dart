import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/screens/inventory/locations_screen.dart';
import 'package:letbuyy_store/screens/inventory/suppliers_screen.dart';
import 'package:letbuyy_store/screens/inventory/purchase_orders_screen.dart';
import 'package:letbuyy_store/screens/inventory/transfers_screen.dart';
import 'inventory_workspace_test.dart' as workspace;
import 'support/warehouse_fixture.dart' as w;

Future<void> tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  for (final surface in [
    (
      name: 'locations',
      screen: const InventoryLocationsScreen(),
      status: 'Inactive',
      wire: 'inactive',
      document: false,
    ),
    (
      name: 'suppliers',
      screen: const InventorySuppliersScreen(),
      status: 'Inactive',
      wire: 'inactive',
      document: false,
    ),
    (
      name: 'purchase-orders',
      screen: const PurchaseOrdersScreen(),
      status: 'Received',
      wire: 'received',
      document: true,
    ),
    (
      name: 'transfers',
      screen: const InventoryTransfersScreen(),
      status: 'Shipped',
      wire: 'shipped',
      document: true,
    ),
  ]) {
    testWidgets(
      '${surface.name} applies full-population server filters and clears them on store switch',
      (tester) async {
        final queries = <Map<String, dynamic>>[];
        final stores = await workspace.mount(tester, surface.screen, (r, h) {
          queries.add(Map<String, dynamic>.from(r.queryParameters));
          final site = r.queryParameters['store_id'].toString(),
              status = r.queryParameters['status'];
          final row = surface.name == 'purchase-orders'
              ? w.warehouseDocument(
                  site: site,
                  received: status == 'received' ? 4 : 0,
                )
              : surface.name == 'transfers'
              ? w.warehouseDocument(site: site, transfer: true)
              : workspace.warehouseRecord(r.path, site);
          if (!surface.document && status != null && status != 'all')
            row['status'] = status;
          workspace.respond(r, h, [row]);
        });
        await tap(tester, find.text('Filter and sort'));
        await tester.enterText(find.byType(TextField), 'SYN_%');
        await tap(tester, find.byType(DropdownButtonFormField<String>).first);
        await tap(tester, find.text(surface.status).last);
        await tap(tester, find.byType(DropdownButtonFormField<String>).last);
        await tap(
          tester,
          find.text(surface.document ? 'Oldest first' : 'Name Z to A').last,
        );
        await tap(tester, find.text('Apply filters'));
        expect(queries.last['search'], 'SYN_%');
        expect(queries.last['status'], surface.wire);
        expect(queries.last['sort'], surface.document ? 'oldest' : 'name_desc');
        expect(queries.last['page'], 1);
        expect(find.text('Filters applied · Edit'), findsOneWidget);
        final change = stores.selectStore(stores.stores.last);
        await tester.pumpAndSettle();
        await change;
        expect(queries.last['search'], isNull);
        expect(queries.last['status'], surface.document ? isNull : 'all');
        expect(queries.last['sort'], surface.document ? 'newest' : 'name_asc');
        expect(find.text('Filter and sort'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
    testWidgets(
      '${surface.name} a denied filtered read cannot become empty success and Clear recovers',
      (tester) async {
        await workspace.mount(tester, surface.screen, (r, h) {
          final blocked = r.queryParameters['search'] == 'Denied query';
          workspace.respond(r, h, [], status: blocked ? 403 : 200);
        });
        await tap(tester, find.text('Filter and sort'));
        await tester.enterText(find.byType(TextField), 'Denied query');
        await tap(tester, find.text('Apply filters'));
        expect(find.text('Page 1 · Count unavailable'), findsOneWidget);
        expect(find.textContaining('No matching'), findsNothing);
        await tap(tester, find.text('Filters applied · Edit'));
        await tap(tester, find.text('Clear filters'));
        expect(find.text('0 matching records · Page 1'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
    testWidgets(
      '${surface.name} Cancel has no read effect and Clear restores the canonical query',
      (tester) async {
        final queries = <Map<String, dynamic>>[];
        await workspace.mount(tester, surface.screen, (r, h) {
          queries.add(Map<String, dynamic>.from(r.queryParameters));
          workspace.respond(r, h, []);
        });
        final initial = queries.length;
        await tap(tester, find.text('Filter and sort'));
        await tester.enterText(
          find.byType(TextField),
          'Private unsubmitted term',
        );
        await tap(tester, find.text('Cancel'));
        expect(queries.length, initial);
        await tap(tester, find.text('Filter and sort'));
        await tester.enterText(find.byType(TextField), 'SYN_%');
        await tap(tester, find.text('Apply filters'));
        await tap(tester, find.text('Filters applied · Edit'));
        await tap(tester, find.text('Clear filters'));
        expect(queries.last['search'], isNull);
        expect(queries.last['page'], 1);
        expect(find.text('Filter and sort'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
