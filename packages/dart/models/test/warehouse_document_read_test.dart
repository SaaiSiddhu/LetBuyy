import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

const site = '11111111-1111-4111-8111-111111111111',
    target = '22222222-2222-4222-8222-222222222222',
    line = '33333333-3333-4333-8333-333333333333',
    product = '44444444-4444-4444-8444-444444444444',
    location = '55555555-5555-4555-8555-555555555555',
    other = '66666666-6666-4666-8666-666666666666';
Map<String, dynamic> document(bool transfer) {
  const date = '2026-10-31T00:00:00Z';
  return {
    'id': target,
    'site_id': site,
    'status': 'partially_received',
    'created_at': date,
    'notes': null,
    if (transfer) ...{
      'transfer_number': 'TR-SYN',
      'source_location_id': location,
      'destination_location_id': other,
      'shipped_at': date,
      'received_at': null,
    } else ...{
      'po_number': 'PO-SYN',
      'supplier_id': null,
      'location_id': location,
      'expected_at': null,
      'subtotal': 1.16,
      'total': 1.16,
      'currency': 'INR',
    },
    'lines': [
      {
        'id': line,
        'site_id': site,
        (transfer ? 'transfer_id' : 'purchase_order_id'): target,
        'product_id': product,
        'variant_id': null,
        'created_at': date,
        'quantity_received': 2,
        if (transfer) ...{
          'quantity_requested': 4,
          'quantity_shipped': 3,
        } else ...{
          'quantity_ordered': 4,
          'unit_cost': 0.29,
        },
      },
    ],
  };
}

void main() {
  for (final transfer in [false, true]) {
    Map<String, dynamic> enriched() {
      final row = document(transfer),
          child = (row['lines'] as List).first as Map<String, dynamic>;
      child['product'] = <String, dynamic>{
        'id': product,
        'store_id': site,
        'name': 'Synthetic readable product',
        'sku': 'SYN-P',
        'deleted_at': null,
      };
      child['variant_id'] = other;
      child['variant'] = <String, dynamic>{
        'id': other,
        'product_id': product,
        'title': 'Synthetic large',
        'sku': 'SYN-L',
      };
      row[transfer ? 'source_location' : 'location'] = <String, dynamic>{
        'id': location,
        'store_id': site,
        'name': 'Synthetic origin',
        'deleted_at': null,
      };
      if (transfer)
        row['destination_location'] = <String, dynamic>{
          'id': other,
          'store_id': site,
          'name': 'Synthetic destination',
          'deleted_at': null,
        };
      return row;
    }

    Object parse(Map<String, dynamic> row) => transfer
        ? InventoryTransferContract.fromVerifiedJson(row)
        : PurchaseOrderContract.fromVerifiedJson(row);
    test(
      '${transfer ? 'transfer' : 'PO'} readable current labels and historical absence',
      () {
        final row = parse(enriched());
        if (row is PurchaseOrderContract) {
          expect(row.locationLabel, 'Synthetic origin');
          expect(
            row.lines.single.displayName,
            'Synthetic readable product / Synthetic large / SYN-L',
          );
        } else {
          final tr = row as InventoryTransferContract;
          expect(tr.sourceLocationLabel, 'Synthetic origin');
          expect(tr.destinationLocationLabel, 'Synthetic destination');
          expect(
            tr.lines.single.displayName,
            'Synthetic readable product / Synthetic large / SYN-L',
          );
        }
        final historical = enriched(),
            child = (historical['lines'] as List).first as Map<String, dynamic>;
        child['product'] = null;
        child['variant'] = null;
        historical[transfer ? 'source_location' : 'location'] = null;
        final missing = parse(historical);
        if (missing is PurchaseOrderContract) {
          expect(missing.locationLabel, 'Location unavailable');
          expect(
            missing.lines.single.displayName,
            contains('Product unavailable'),
          );
        } else
          expect(
            (missing as InventoryTransferContract).sourceLocationLabel,
            'Location unavailable',
          );
        final deleted = enriched();
        (deleted['lines'] as List).first['product']['deleted_at'] =
            '2026-11-03T00:00:00Z';
        final gone = parse(deleted);
        expect(
          gone is PurchaseOrderContract
              ? gone.lines.single.displayName
              : (gone as InventoryTransferContract).lines.single.displayName,
          contains('(deleted)'),
        );
      },
    );
    for (final fault in [
      'product-id',
      'product-site',
      'product-name',
      'product-sku',
      'product-date',
      'variant-id',
      'variant-parent',
      'variant-title',
      'variant-sku',
      'location-id',
      'location-site',
      'location-name',
      'location-date',
      'destination-site',
    ]) {
      if (!transfer && fault == 'destination-site') continue;
      test(
        '${transfer ? 'transfer' : 'PO'} strict readable relation rejects $fault',
        () {
          final row = enriched(),
              child = (row['lines'] as List).first as Map<String, dynamic>,
              p = child['product'] as Map,
              v = child['variant'] as Map,
              l = row[transfer ? 'source_location' : 'location'] as Map;
          if (fault == 'product-id') p['id'] = other;
          if (fault == 'product-site') p['store_id'] = other;
          if (fault == 'product-name') p['name'] = 42;
          if (fault == 'product-sku') p['sku'] = 42;
          if (fault == 'product-date') p['deleted_at'] = 'unknown';
          if (fault == 'variant-id') v['id'] = product;
          if (fault == 'variant-parent') v['product_id'] = other;
          if (fault == 'variant-title') v['title'] = 42;
          if (fault == 'variant-sku') v['sku'] = 42;
          if (fault == 'location-id') l['id'] = other;
          if (fault == 'location-site') l['store_id'] = other;
          if (fault == 'location-name') l['name'] = 42;
          if (fault == 'location-date') l['deleted_at'] = 'unknown';
          if (fault == 'destination-site')
            (row['destination_location'] as Map)['store_id'] = other;
          expect(() => parse(row), throwsFormatException);
        },
      );
    }
  }

  for (final transfer in [false, true]) {
    Object parse(Map<String, dynamic> row) => transfer
        ? InventoryTransferContract.fromVerifiedJson(row)
        : PurchaseOrderContract.fromVerifiedJson(row);
    test(
      '${transfer ? 'transfer' : 'PO'} strict read preserves canonical counters',
      () {
        final row = parse(document(transfer));
        if (row is PurchaseOrderContract) {
          expect(row.lines.single.receivedQuantity, 2);
          expect(row.lines.single.unitCost, 0.29);
          expect(row.poNumber, 'PO-SYN');
        } else {
          expect(
            (row as InventoryTransferContract).lines.single.shippedQuantity,
            3,
          );
          expect(row.lines.single.receivedQuantity, 2);
          expect(row.transferNumber, 'TR-SYN');
        }
      },
    );
    for (final fault in [
      'id',
      'store',
      'date',
      'status',
      'notes',
      'empty',
      'line-date',
      'line-parent',
      'line-site',
      'line-product',
      'line-variant',
      'duplicate',
      'fraction',
      'over-received',
    ]) {
      test('${transfer ? 'transfer' : 'PO'} strict read rejects $fault', () {
        final row = document(transfer),
            child = (row['lines'] as List).first as Map<String, dynamic>;
        if (fault == 'id') row['id'] = 'unknown';
        if (fault == 'store') row['store_id'] = other;
        if (fault == 'date') row.remove('created_at');
        if (fault == 'status') row['status'] = 'partial';
        if (fault == 'notes') row.remove('notes');
        if (fault == 'empty') row['lines'] = [];
        if (fault == 'line-date') child.remove('created_at');
        if (fault == 'line-parent')
          child[transfer ? 'transfer_id' : 'purchase_order_id'] = other;
        if (fault == 'line-site') child['site_id'] = other;
        if (fault == 'line-product') child['product_id'] = 'unverified';
        if (fault == 'line-variant') child.remove('variant_id');
        if (fault == 'duplicate') (row['lines'] as List).add({...child});
        if (fault == 'fraction') child['quantity_received'] = 1.5;
        if (fault == 'over-received') child['quantity_received'] = 5;
        expect(() => parse(row), throwsFormatException);
      });
    }
  }
  test(
    'strict PO reads refuse unverified cost, total, currency and supplier scope',
    () {
      for (final fault in ['cost', 'total', 'currency', 'supplier']) {
        final row = document(false);
        if (fault == 'cost') (row['lines'] as List).first['unit_cost'] = 0.005;
        if (fault == 'total') row['total'] = -1;
        if (fault == 'currency') row['currency'] = 'USD';
        if (fault == 'supplier')
          row['supplier'] = {
            'id': other,
            'site_id': other,
            'name': 'Synthetic foreign',
          };
        expect(
          () => PurchaseOrderContract.fromVerifiedJson(row),
          throwsFormatException,
        );
      }
    },
  );
}
