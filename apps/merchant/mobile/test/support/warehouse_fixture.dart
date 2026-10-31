// Synthetic protocol fixtures. These provide no hosted or provider evidence.
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'package:letbuyy_store/services/api_client.dart';

const warehouseActor = '11111111-1111-4111-8111-111111111111',
    warehouseSite = '22222222-2222-4222-8222-222222222222',
    warehouseTarget = '33333333-3333-4333-8333-333333333333',
    warehouseProduct = '44444444-4444-4444-8444-444444444444',
    warehouseLocation = '55555555-5555-4555-8555-555555555555',
    warehouseDestination = '66666666-6666-4666-8666-666666666666',
    warehouseLine = '77777777-7777-4777-8777-777777777777',
    warehouseReceipt = '88888888-8888-4888-8888-888888888888';
JsonMap warehouseCapabilities({
  String actor = warehouseActor,
  String site = warehouseSite,
}) => {
  'store_id': site,
  'actor_id': actor,
  'protocol_version': '1',
  'effect_policy': 'atomic_receipt_or_unavailable',
  'stop_supported': true,
};
PurchaseOrderInput warehousePo({
  String key = 'original-po-create',
  int quantity = 4,
  num cost = 12.25,
}) => PurchaseOrderInput(
  storeId: warehouseSite,
  locationId: warehouseLocation,
  idempotencyKey: key,
  lines: [
    InventoryLineInput(
      productId: warehouseProduct,
      quantity: quantity,
      unitCost: cost,
    ),
  ],
);
InventoryTransferInput warehouseTransfer({
  String key = 'original-transfer-create',
}) => InventoryTransferInput(
  storeId: warehouseSite,
  sourceLocationId: warehouseLocation,
  destinationLocationId: warehouseDestination,
  idempotencyKey: key,
  lines: const [InventoryLineInput(productId: warehouseProduct, quantity: 4)],
);

JsonMap warehouseAck(
  WarehouseCommandIntent intent,
  String key, {
  bool applied = true,
  int received = 0,
  int shipped = 0,
  String? status,
  String actor = warehouseActor,
  String site = warehouseSite,
}) {
  final po = intent.operation.startsWith('purchase_order.'),
      create = intent.operation.endsWith('.create');
  final target = applied
      ? intent.targetId ?? warehouseTarget
      : create
      ? null
      : intent.targetId;
  return {
    'command_receipt': {
      'id': warehouseReceipt,
      'key': key,
      'site_id': site,
      'actor_id': actor,
      'operation': intent.operation,
      'target_id': target,
      'command': intent.command,
      'effective_lines': applied && intent.operation.endsWith('.receive')
          ? intent.command['lines']
          : null,
      'outcome': applied ? 'applied' : 'cancelled',
    },
    if (applied)
      po ? 'purchase_order' : 'transfer': {
        'id': target,
        'site_id': site,
        'status':
            status ??
            (po
                ? received == 4
                      ? 'received'
                      : received > 0
                      ? 'partially_received'
                      : 'ordered'
                : received == 4
                ? 'received'
                : received > 0
                ? 'partially_received'
                : shipped > 0
                ? 'shipped'
                : 'reserved'),
        if (po) 'location_id': warehouseLocation,
        if (!po) 'source_location_id': warehouseLocation,
        if (!po) 'destination_location_id': warehouseDestination,
      },
    'lines': [
      if (applied)
        {
          'id': warehouseLine,
          'site_id': site,
          po ? 'purchase_order_id' : 'transfer_id': target,
          'product_id': warehouseProduct,
          'variant_id': null,
          po ? 'quantity_ordered' : 'quantity_requested': 4,
          if (!po) 'quantity_shipped': shipped,
          'quantity_received': received,
          if (po) 'unit_cost': 12.25,
        },
    ],
  };
}
