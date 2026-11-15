import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

String id(int value) =>
    '00000000-0000-4000-8000-${value.toString().padLeft(12, '0')}';
const date = '2026-11-03T00:00:00Z';
Map<String, dynamic> reservation() => {
  'id': id(1),
  'store_id': id(2),
  'product_id': id(3),
  'location_id': id(4),
  'variant_id': null,
  'order_id': null,
  'quantity': 4,
  'status': 'active',
  'expires_at': null,
  'created_at': date,
  'updated_at': date,
  'products': <String, dynamic>{
    'id': id(3),
    'store_id': id(2),
    'name': 'Synthetic product',
  },
  'transfer': <String, dynamic>{
    'id': id(6),
    'reservation_id': id(1),
    'line_id': id(5),
    'site_id': id(2),
    'product_id': id(3),
    'variant_id': null,
    'source_location_id': id(4),
    'transfer_number': 'TR-SYN',
    'status': 'reserved',
    'quantity_requested': 4,
    'quantity_received': 0,
    'base_received': 0,
  },
};
void main() {
  test(
    'temporary expiry, warehouse hold, shipment and retained receipt lifetimes',
    () {
      final temporary = reservation()
        ..['transfer'] = null
        ..['expires_at'] = date;
      expect(
        InventoryReservationRecord.fromJson(temporary).expiresAt,
        DateTime.parse(date),
      );
      final held = InventoryReservationRecord.fromJson(reservation());
      expect(held.expiresAt, isNull);
      expect(held.transfer?.number, 'TR-SYN');
      final retained = reservation()
        ..['status'] = 'committed'
        ..['quantity'] = 3;
      final transfer = retained['transfer'] as Map<String, dynamic>;
      transfer['status'] = 'partially_received';
      transfer['quantity_received'] = 1;
      transfer['base_received'] = 1;
      final committed = InventoryReservationRecord.fromJson(retained);
      expect(committed.transfer?.baseReceived, 1);
      expect(committed.quantity, 3);
    },
  );
  for (final fault in [
    'unbound',
    'infinity',
    'finite-transfer',
    'missing-expiry',
    'site',
    'reservation',
    'product',
    'variant',
    'location',
    'order',
    'quantity',
    'fractional',
    'received',
    'base',
    'fractional-base',
    'status',
    'draft',
    'cancelled',
    'product-join',
  ]) {
    test('reservation lifetime refuses $fault', () {
      final row = reservation(),
          transfer = row['transfer'] as Map<String, dynamic>;
      if (fault == 'unbound') row['transfer'] = null;
      if (fault == 'infinity') row['expires_at'] = 'infinity';
      if (fault == 'finite-transfer') row['expires_at'] = date;
      if (fault == 'missing-expiry') row.remove('expires_at');
      if (fault == 'site') transfer['site_id'] = id(99);
      if (fault == 'reservation') transfer['reservation_id'] = id(99);
      if (fault == 'product') transfer['product_id'] = id(99);
      if (fault == 'variant') transfer['variant_id'] = id(99);
      if (fault == 'location') transfer['source_location_id'] = id(99);
      if (fault == 'order') row['order_id'] = id(99);
      if (fault == 'quantity') transfer['quantity_requested'] = 5;
      if (fault == 'fractional') row['quantity'] = 4.5;
      if (fault == 'received') transfer['quantity_received'] = 5;
      if (fault == 'base') transfer['base_received'] = 1;
      if (fault == 'fractional-base') transfer['base_received'] = 0.5;
      if (fault == 'status') row['status'] = 'committed';
      if (fault == 'draft' || fault == 'cancelled') transfer['status'] = fault;
      if (fault == 'product-join')
        (row['products'] as Map<String, dynamic>)['id'] = id(99);
      expect(
        () => InventoryReservationRecord.fromJson(row),
        throwsFormatException,
      );
    });
  }
}
