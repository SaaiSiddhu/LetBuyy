import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    c = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    d = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
PurchaseOrderInput input({num cost = 12.25, String? date}) =>
    PurchaseOrderInput(
      storeId: a,
      locationId: ' $b ',
      idempotencyKey: 'synthetic-key',
      notes: '  Synthetic note  ',
      expectedAt: date,
      lines: [
        InventoryLineInput(
          productId: c.toUpperCase(),
          quantity: 4,
          unitCost: cost,
        ),
      ],
    );
Map<String, dynamic> receipt({bool cancelled = false, bool transfer = false}) =>
    {
      'command_receipt': {
        'id': a,
        'key': 'synthetic-key',
        'site_id': a,
        'actor_id': b,
        'operation': transfer ? 'transfer.receive' : 'purchase_order.receive',
        'target_id': c,
        'command': {
          'lines': [
            {
              '${transfer ? 'transfer' : 'purchase_order'}_line_id': d,
              'quantity': 2,
            },
          ],
        },
        'effective_lines': cancelled
            ? null
            : [
                {
                  '${transfer ? 'transfer' : 'purchase_order'}_line_id': d,
                  'quantity': 2,
                },
              ],
        'outcome': cancelled ? 'cancelled' : 'applied',
      },
      if (!cancelled)
        transfer ? 'transfer' : 'purchase_order': {
          'id': c,
          'site_id': a,
          'status': 'partially_received',
        },
      'lines': [
        if (!cancelled)
          {
            'id': d,
            'site_id': a,
            '${transfer ? 'transfer' : 'purchase_order'}_id': c,
            'product_id': b,
            'variant_id': null,
            transfer ? 'quantity_requested' : 'quantity_ordered': 4,
            if (transfer) 'quantity_shipped': 3,
            'quantity_received': 2,
            if (!transfer) 'unit_cost': 12.25,
          },
      ],
    };
void main() {
  test('warehouse capability descriptors require exact supported policy and scoped identities',(){
    final good=<String,dynamic>{'store_id':a,'actor_id':b,'protocol_version':'2',
      'effect_policy':'atomic_receipt_or_unavailable','stop_supported':true};
    expect(WarehouseCommandCapabilities.fromJson(good).storeId,a);
    for(final fault in ['actor','site','version','policy','stop','extra']) {
      final row={...good};switch(fault){
        case 'actor':row['actor_id']='unknown';
        case 'site':row['store_id']=null;
        case 'version':row['protocol_version']='0';
        case 'policy':row['effect_policy']='legacy';
        case 'stop':row['stop_supported']=false;
        case 'extra':row['ready']=true;
      }
      expect(()=>WarehouseCommandCapabilities.fromJson(row),throwsFormatException,reason:fault);
    }
  });
  test(
    'PO intent normalizes UUIDs, exact paise, nulls, notes and UTC once',
    () {
      final intent = WarehouseCommandIntent.purchaseOrder(
        input(date: '2026-10-30T10:30:00+05:30'),
      );
      expect(intent.command['expected_at'], '2026-10-30T05:00:00.000Z');
      expect(intent.command['location_id'], b);
      expect(intent.command['notes'], 'Synthetic note');
      expect(intent.command['supplier_id'], isNull);
      expect((intent.command['lines'] as List).single['product_id'], c);
      expect(
        WarehouseCommandIntent.fromJson(intent.toJson()).sameAs(intent),
        isTrue,
      );
    },
  );
  test('invalid calendars and fractional paise cannot be silently rounded', () {
    for (final cost in [0.005, -1, double.nan, double.infinity, 1000000]) {
      expect(
        () => WarehouseCommandIntent.purchaseOrder(input(cost: cost)),
        throwsFormatException,
      );
    }
    for (final date in [
      '2026-02-31',
      '2026-13-01',
      '2026-10-30T25:00:00Z',
      'tomorrow',
    ]) {
      expect(
        () => WarehouseCommandIntent.purchaseOrder(input(date: date)),
        throwsFormatException,
      );
    }
    for (final cost in [0, 0.29, 12.25, 999999]) {
      expect(
        WarehouseCommandIntent.purchaseOrder(input(cost: cost)).command,
        isNotEmpty,
      );
    }
  });
  test(
    'captured nested intent and acknowledgement cannot be changed by callers',
    () {
      final original = WarehouseCommandIntent.purchaseOrder(input()).toJson();
      final frozen = WarehouseCommandIntent.fromJson(original);
      expect(
        () => (frozen.command['lines'] as List).clear(),
        throwsUnsupportedError,
      );
      expect(
        () => (frozen.command['lines'] as List).single['quantity'] = 99,
        throwsUnsupportedError,
      );
      final raw = receipt(),
          ack = WarehouseCommandAcknowledgement.fromJson(raw);
      (raw['lines'] as List).clear();
      expect(ack.purchaseOrder!.lines.single.receivedQuantity, 2);
      expect(() => (ack.data['lines'] as List).clear(), throwsUnsupportedError);
    },
  );
  test(
    'partial receive freezes selected line quantities and rejects unknown lines',
    () {
      final po = WarehouseCommandAcknowledgement.fromJson(
        receipt(),
      ).purchaseOrder!;
      final intent = WarehouseCommandIntent.receivePurchaseOrder(
        po,
        quantities: {d: 1},
      );
      expect(intent.command, {
        'lines': [
          {'purchase_order_line_id': d, 'quantity': 1},
        ],
      });
      expect(
        () =>
            WarehouseCommandIntent.receivePurchaseOrder(po, quantities: {d: 3}),
        throwsFormatException,
      );
      expect(
        () =>
            WarehouseCommandIntent.receivePurchaseOrder(po, quantities: {a: 1}),
        throwsFormatException,
      );
      expect(
        () =>
            WarehouseCommandIntent.receivePurchaseOrder(po, quantities: {d: 0}),
        throwsFormatException,
      );
    },
  );
  test(
    'receive acknowledges only the original operation, target and frozen quantities',
    () {
      final ack = WarehouseCommandAcknowledgement.fromJson(receipt());
      final intent = WarehouseCommandIntent.fromJson({
        'operation': ack.operation,
        'target_id': c,
        'command': ack.command,
      });
      expect(intent.matches(ack), isTrue);
      final changed = WarehouseCommandIntent.fromJson({
        'operation': ack.operation,
        'target_id': c,
        'command': {
          'lines': [
            {'purchase_order_line_id': d, 'quantity': 1},
          ],
        },
      });
      expect(changed.matches(ack), isFalse);
      expect(WarehouseCommandIntent.ship(c).matches(ack), isFalse);
    },
  );
  for (final transfer in [false, true]) {
    test(
      '${transfer ? 'transfer' : 'PO'} rejects impossible scopes, states, counters and effective lines',
      () {
        for (final fault in [
          'site',
          'parent',
          'fraction',
          'missing',
          'over',
          'duplicate',
          'state',
          'effective',
          'unknown-effective',
        ]) {
          final raw = receipt(transfer: transfer),
              row = (raw['lines'] as List).single as Map,
              header = raw[transfer ? 'transfer' : 'purchase_order'] as Map,
              commandReceipt = raw['command_receipt'] as Map;
          switch (fault) {
            case 'site':
              row['site_id'] = b;
            case 'parent':
              row[transfer ? 'transfer_id' : 'purchase_order_id'] = b;
            case 'fraction':
              row['quantity_received'] = 1.5;
            case 'missing':
              row.remove('quantity_received');
            case 'over':
              row['quantity_received'] = 5;
            case 'duplicate':
              (raw['lines'] as List).add(Map<String, Object?>.from(row));
            case 'state':
              header['status'] = 'invented';
            case 'effective':
              (commandReceipt['effective_lines'] as List).single['quantity'] =
                  3;
            case 'unknown-effective':
              (commandReceipt['effective_lines'] as List).single[transfer
                      ? 'transfer_line_id'
                      : 'purchase_order_line_id'] =
                  b;
          }
          expect(
            () => WarehouseCommandAcknowledgement.fromJson(raw),
            throwsFormatException,
            reason: fault,
          );
        }
      },
    );
  }
  test(
    'a cancellation contains no applied header, stock lines or effective receipt',
    () {
      final raw = receipt(cancelled: true),
          ack = WarehouseCommandAcknowledgement.fromJson(raw);
      expect(ack.applied, isFalse);
      expect(ack.purchaseOrder, isNull);
      raw['purchase_order'] = {'id': c, 'site_id': a, 'status': 'received'};
      expect(
        () => WarehouseCommandAcknowledgement.fromJson(raw),
        throwsFormatException,
      );
    },
  );
}
