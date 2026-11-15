import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/screens/inventory/inventory_screen.dart';
import 'package:letbuyy_store/screens/inventory/locations_screen.dart';
import 'package:letbuyy_store/screens/inventory/suppliers_screen.dart';
import 'package:letbuyy_store/screens/inventory/purchase_orders_screen.dart';
import 'package:letbuyy_store/screens/inventory/transfers_screen.dart';
import 'package:letbuyy_store/screens/inventory/records_screen.dart';
import 'inventory_workspace_test.dart' as workspace;
import 'inventory_records_scope_test.dart' as records;

class _Discovery extends StoreService {
  _Discovery(ApiClient api) : super(api: api);
  bool unavailable = true;
  int reads = 0;
  @override
  Future<List<StoreModel>> fetchStores() async {
    reads++;
    if (unavailable) throw StateError('Synthetic first store discovery outage');
    return [
      StoreModel.fromJson({
        'id': workspace.siteA,
        'name': 'Current synthetic store',
        'site_type': 'store',
        'subdomain': 'synthetic',
      }),
    ];
  }
}

void main() {
  for (final surface in [
    (
      name: 'inventory',
      screen: const InventoryScreen(),
      label: 'Recovered current stock',
    ),
    (
      name: 'locations',
      screen: const InventoryLocationsScreen(),
      label: 'Recovered current location',
    ),
    (
      name: 'suppliers',
      screen: const InventorySuppliersScreen(),
      label: 'Recovered current supplier',
    ),
    (
      name: 'purchase orders',
      screen: const PurchaseOrdersScreen(),
      label: 'Recovered current PO',
    ),
    (
      name: 'transfers',
      screen: const InventoryTransfersScreen(),
      label: 'Recovered current transfer',
    ),
    (
      name: 'stock history',
      screen: const InventoryRecordsScreen(kind: InventoryRecordKind.history),
      label: 'Private A history',
    ),
    (
      name: 'reservations',
      screen: const InventoryRecordsScreen(
        kind: InventoryRecordKind.reservations,
      ),
      label: 'Synthetic held stock',
    ),
    (
      name: 'receipts',
      screen: const InventoryRecordsScreen(kind: InventoryRecordKind.receipts),
      label: 'Purchase order receipt',
    ),
  ]) {
    testWidgets(
      '${surface.name} can retry first discovery without an existing selected store',
      (tester) async {
        late _Discovery discovery;
        var writes = 0;
        await workspace.mount(tester, surface.screen, (r, h) {
          if (r.method != 'GET') writes++;
          if (r.path.endsWith('/history'))
            records.respond(r, h, [workspace.historyRecord(workspace.siteA)]);
          else if (r.path.endsWith('/reservations'))
            records.respond(r, h, [records.reservation()]);
          else if (r.path.endsWith('/receipts'))
            records.respond(r, h, [records.receipt()]);
          else
            workspace.respond(r, h, [
              workspace.warehouseRecord(
                r.path,
                workspace.siteA,
                name: surface.label,
              ),
            ]);
        }, storeFactory: (api) => discovery = _Discovery(api));
        expect(discovery.reads, 1);
        expect(find.text(surface.label), findsNothing);
        discovery.unavailable = false;
        await tester.tap(find.byTooltip('Refresh ${surface.name}'));
        await tester.pumpAndSettle();
        expect(discovery.reads, 2);
        expect(find.textContaining(surface.label), findsOneWidget);
        expect(writes, 0);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
