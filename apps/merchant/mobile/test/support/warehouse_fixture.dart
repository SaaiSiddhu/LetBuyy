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
  'protocol_version': '2',
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
  final metadata =
      intent.operation == 'location.create' ||
      intent.operation == 'supplier.create';
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
    if (applied && metadata)
      intent.operation == 'location.create' ? 'location' : 'supplier': {
        'id': target,
        'name': intent.command['name'],
        'status': 'active',
        'created_at': '2026-11-01T00:00:00Z',
        if (intent.operation == 'location.create') ...{
          'store_id': site,
          'is_default': intent.command['is_default'],
          'address': {
            for (final k in ['address', 'city', 'state', 'country', 'pincode'])
              k: intent.command[k],
          },
        } else ...{
          'site_id': site,
          for (final k in ['contact_name', 'email', 'phone', 'address'])
            k: intent.command[k],
        },
      },
    if (applied && !metadata)
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
      if (applied && !metadata)
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

JsonMap warehouseDocument({
  bool transfer = false,
  String targetId = warehouseTarget,
  String site = warehouseSite,
  int quantity = 4,
  int received = 0,
  int shipped = 4,
  int lineCount = 1,
  String? status,
}) {
  const date = '2026-10-31T00:00:00Z';
  return {
    'id': targetId,
    'site_id': site,
    'notes': null,
    'created_at': date,
    'updated_at': date,
    'status':
        status ??
        (received == quantity
            ? 'received'
            : received > 0
            ? 'partially_received'
            : transfer
            ? 'shipped'
            : 'ordered'),
    if (transfer) ...{
      'transfer_number': 'TR-SYN',
      'source_location_id': warehouseLocation,
      'destination_location_id': warehouseDestination,
      'shipped_at': date,
      'received_at': null,
    } else ...{
      'po_number': 'PO-SYN',
      'supplier_id': null,
      'supplier': null,
      'location_id': warehouseLocation,
      'expected_at': null,
      'subtotal': 12.25 * quantity * lineCount,
      'total': 12.25 * quantity * lineCount,
      'currency': 'INR',
    },
    'lines': List.generate(
      lineCount,
      (index) => {
        'id': index == 0
            ? warehouseLine
            : "99999999-9999-4999-8999-${index.toString().padLeft(12, '0')}",
        'site_id': site,
        transfer ? 'transfer_id' : 'purchase_order_id': targetId,
        'product_id': warehouseProduct,
        'variant_id': index == 0
            ? null
            : 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
        'sku': 'SYN-${index + 1}',
        'product_name': 'Synthetic product ${index + 1}',
        'created_at': date,
        'quantity_received': received,
        if (transfer) ...{
          'quantity_requested': quantity,
          'quantity_shipped': shipped,
        } else ...{
          'quantity_ordered': quantity,
          'unit_cost': 12.25,
        },
      },
    ),
  };
}

JsonMap warehouseLocationRecord({
  String site = warehouseSite,
  String id = warehouseLocation,
  String name = 'Synthetic warehouse',
}) => {
  'id': id,
  'store_id': site,
  'name': name,
  'status': 'active',
  'is_default': false,
  'created_at': '2026-10-31T00:00:00Z',
  'address': {
    'address': 'Synthetic address',
    'city': 'Delhi',
    'state': 'Delhi',
    'country': 'IN',
  },
};
JsonMap warehouseSupplierRecord({
  String site = warehouseSite,
  String id = warehouseDestination,
  String name = 'Synthetic supplier',
}) => {
  'id': id,
  'site_id': site,
  'name': name,
  'status': 'active',
  'created_at': '2026-10-31T00:00:00Z',
  'contact_name': 'Synthetic contact',
  'email': 'synthetic@example.invalid',
  'phone': null,
  'address': <String, dynamic>{},
};
JsonMap warehousePageMeta({
  String site = warehouseSite,
  int page = 1,
  int limit = 20,
  int total = 1,
}) => {
  'store_id': site,
  'page': page,
  'per_page': limit,
  'total': total,
  'total_is_exact': true,
  'has_next': page * limit < total,
};
