import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

Map<String, dynamic> po() => {
  'id': 'synthetic-line',
  'product_id': 'synthetic-product',
  'quantity_ordered': 4,
  'quantity_received': 1,
  'unit_cost': 12.25,
};
Map<String, dynamic> transfer() => {
  'id': 'synthetic-line',
  'product_id': 'synthetic-product',
  'quantity_requested': 4,
  'quantity_shipped': 4,
  'quantity_received': 2,
};
void main() {
  test(
    'PO quantities use the actual server ordered/received fields and preserve cost',
    () {
      final row = PurchaseOrderLineContract.fromJson(po());
      expect(row.quantity, 4);
      expect(row.receivedQuantity, 1);
      expect(row.remainingQuantity, 3);
      expect(row.unitCost, 12.25);
    },
  );
  test('transfer quantities use actual requested/shipped/received fields', () {
    final row = InventoryTransferLineContract.fromJson(transfer());
    expect(row.quantity, 4);
    expect(row.receivedQuantity, 2);
    expect(row.remainingQuantity, 2);
  });
  test(
    'missing fractional or negative warehouse counters cannot become zero',
    () {
      for (final value in [null, 1.5, -1, '4']) {
        final p = po()..['quantity_ordered'] = value,
            t = transfer()..['quantity_requested'] = value;
        expect(
          () => PurchaseOrderLineContract.fromJson(p),
          throwsFormatException,
        );
        expect(
          () => InventoryTransferLineContract.fromJson(t),
          throwsFormatException,
        );
      }
    },
  );
  test('received counts cannot exceed ordered or shipped quantities', () {
    expect(
      () => PurchaseOrderLineContract.fromJson(po()..['quantity_received'] = 5),
      throwsFormatException,
    );
    expect(
      () => InventoryTransferLineContract.fromJson(
        transfer()..['quantity_shipped'] = 1,
      ),
      throwsFormatException,
    );
  });
}
