/// Dart transport mirrors for canonical inventory/warehouse contracts in
/// @letbuyy/shared-types and @letbuyy/commerce-core. The server owns quantities,
/// permissions, totals and lifecycle effects. No SDK or app dependency belongs here.
const inventoryReservationStatuses = [
  'active',
  'hold',
  'committed',
  'released',
  'expired',
  'fulfilled',
  'cancelled',
];

bool _recordId(Object? value) =>
    value is String &&
    RegExp(
      r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    ).hasMatch(value);
DateTime? _recordDate(Object? value) =>
    value is String &&
        RegExp(
          r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$',
        ).hasMatch(value)
    ? DateTime.tryParse(value)
    : null;

class InventoryReservationRecord {
  const InventoryReservationRecord({
    required this.id,
    required this.storeId,
    required this.productId,
    required this.productName,
    required this.variantId,
    required this.locationId,
    required this.orderId,
    required this.quantity,
    required this.status,
    required this.expiresAt,
    required this.createdAt,
    required this.updatedAt,
  });
  factory InventoryReservationRecord.fromJson(Map<String, dynamic> json) {
    final product = _mapValue(json['products']);
    final site = _stringValue(json['store_id']),
        id = _stringValue(json['id']),
        productId = _stringValue(json['product_id']);
    final quantity = _inventoryQuantity(json['quantity']);
    final expires = _recordDate(json['expires_at']),
        created = _recordDate(json['created_at']),
        updated = _recordDate(json['updated_at']);
    if (!_recordId(json['store_id']) ||
        !_recordId(json['id']) ||
        !_recordId(json['product_id']) ||
        !_recordId(json['location_id']) ||
        (json['variant_id'] != null && !_recordId(json['variant_id'])) ||
        (json['order_id'] != null && !_recordId(json['order_id'])) ||
        product['name'] is! String ||
        json['quantity'] is! num ||
        product['store_id'] != site ||
        quantity <= 0 ||
        !inventoryReservationStatuses.contains(json['status']) ||
        expires == null ||
        created == null ||
        updated == null) {
      throw const FormatException(
        'The reservation record could not be confirmed.',
      );
    }
    return InventoryReservationRecord(
      id: id,
      storeId: site,
      productId: productId,
      productName: product['name'] as String,
      variantId: _stringValue(json['variant_id']),
      locationId: _stringValue(json['location_id']),
      orderId: _stringValue(json['order_id']),
      quantity: quantity,
      status: json['status'] as String,
      expiresAt: expires,
      createdAt: created,
      updatedAt: updated,
    );
  }
  final String id,
      storeId,
      productId,
      productName,
      variantId,
      locationId,
      orderId,
      status;
  final int quantity;
  final DateTime expiresAt, createdAt, updatedAt;
}

class InventoryReceiptRecord {
  const InventoryReceiptRecord({
    required this.id,
    required this.storeId,
    required this.parentId,
    required this.receiptType,
    required this.quantityReceived,
    required this.notes,
    required this.receivedAt,
    required this.createdAt,
  });
  factory InventoryReceiptRecord.fromJson(Map<String, dynamic> json) {
    final type = _stringValue(json['receipt_type']);
    if (!const {'purchase_order', 'transfer'}.contains(type))
      throw const FormatException('The receipt type could not be confirmed.');
    final purchase = type == 'purchase_order';
    final parent = _mapValue(
      json[purchase ? 'purchase_orders' : 'inventory_transfers'],
    );
    final site = _stringValue(json['store_id'] ?? parent['site_id']),
        id = _stringValue(json['id']);
    final parentId = _stringValue(
      json[purchase ? 'purchase_order_id' : 'transfer_id'],
    );
    final quantity = _inventoryQuantity(json['quantity_received']);
    final received = _recordDate(json['received_at']),
        created = _recordDate(json['created_at']);
    if (!_recordId(site) ||
        !_recordId(json['id']) ||
        !_recordId(parentId) ||
        parent['site_id'] != site ||
        parent['id'] != parentId ||
        json[purchase ? 'transfer_id' : 'purchase_order_id'] != null ||
        json[purchase ? 'inventory_transfers' : 'purchase_orders'] != null ||
        (json['notes'] != null && json['notes'] is! String) ||
        json['quantity_received'] is! num ||
        quantity <= 0 ||
        received == null ||
        created == null) {
      throw const FormatException('The receipt record could not be confirmed.');
    }
    return InventoryReceiptRecord(
      id: id,
      storeId: site,
      parentId: parentId,
      receiptType: type,
      quantityReceived: quantity,
      notes: _stringValue(json['notes']),
      receivedAt: received,
      createdAt: created,
    );
  }
  final String id, storeId, parentId, receiptType, notes;
  final int quantityReceived;
  final DateTime receivedAt, createdAt;
}

class InventoryHistoryEntry {
  const InventoryHistoryEntry({
    required this.id,
    required this.storeId,
    required this.productId,
    required this.productName,
    required this.variantId,
    required this.locationId,
    required this.quantityChange,
    required this.reason,
    required this.note,
    required this.createdAt,
  });
  factory InventoryHistoryEntry.fromJson(Map<String, dynamic> json) {
    final product = _mapValue(json['products']);
    final id = _stringValue(json['id']),
        site = _stringValue(json['store_id']),
        productId = _stringValue(json['product_id']);
    final at = DateTime.tryParse(_stringValue(json['created_at']));
    if (id.isEmpty ||
        site.isEmpty ||
        productId.isEmpty ||
        product['store_id'] != site ||
        at == null ||
        !const {
          'sale',
          'return',
          'adjustment',
          'recount',
          'transfer',
          'damaged',
          'reserved',
          'unreserved',
        }.contains(json['reason'])) {
      throw const FormatException(
        'The stock history record could not be confirmed.',
      );
    }
    return InventoryHistoryEntry(
      id: id,
      storeId: site,
      productId: productId,
      productName: _stringValue(product['name'], fallback: 'Product'),
      variantId: _stringValue(json['variant_id']),
      locationId: _stringValue(json['location_id']),
      quantityChange: _inventoryQuantity(json['quantity_change']),
      reason: json['reason'] as String,
      note: _stringValue(json['note']),
      createdAt: at,
    );
  }
  final String id,
      storeId,
      productId,
      productName,
      variantId,
      locationId,
      reason,
      note;
  final int quantityChange;
  final DateTime createdAt;
}

class InventoryLevel {
  const InventoryLevel({
    required this.id,
    required this.storeId,
    required this.productId,
    required this.variantId,
    required this.sku,
    required this.productName,
    required this.locationId,
    required this.available,
    required this.reserved,
    required this.committed,
    required this.onHand,
    this.variantTitle = '',
    this.locationName = '',
    this.incoming,
    this.sellable,
    this.trackInventory,
  });

  factory InventoryLevel.fromJson(Map<String, dynamic> json) {
    final available = _inventoryQuantity(
      json['available'] ?? json['available_quantity'],
    );
    final reserved = _inventoryQuantity(
      json['reserved'] ?? json['reserved_quantity'],
    );
    final committedValue = json['committed'] ?? json['committed_quantity'];
    final committed = committedValue == null
        ? null
        : _inventoryQuantity(committedValue);
    return InventoryLevel(
      id: _stringValue(json['id']),
      storeId: _stringValue(json['store_id'] ?? json['site_id']),
      productId: _stringValue(json['product_id']),
      variantId: _stringValue(json['variant_id']),
      sku: _stringValue(json['sku']),
      productName: _stringValue(
        json['product_name'] ?? json['name'] ?? json['title'],
        fallback: 'Product',
      ),
      locationId: _stringValue(json['location_id']),
      available: available,
      reserved: reserved,
      committed: committed,
      onHand: _inventoryQuantity(json['on_hand'] ?? json['on_hand_quantity']),
      variantTitle: _stringValue(json['variant_title']),
      locationName: _stringValue(json['location_name']),
      incoming: json['incoming'] == null
          ? null
          : _inventoryQuantity(json['incoming']),
      sellable: json['sellable'] == null
          ? null
          : _inventoryQuantity(json['sellable']),
      trackInventory: json['track_inventory'] is bool
          ? json['track_inventory'] as bool
          : null,
    );
  }

  final String id;
  final String storeId;
  final String productId;
  final String variantId;
  final String sku;
  final String productName;
  final String locationId;
  final int available;
  final int reserved;
  final int? committed;
  final int onHand;
  final String variantTitle, locationName;
  final int? incoming, sellable;
  final bool? trackInventory;
  String get label =>
      variantTitle.isEmpty ? productName : '$productName / $variantTitle';

  bool get isOutOfStock => available <= 0;
  bool get isLowStock => available > 0 && available <= 10;
}

const warehousePurchaseOrderStatuses = [
  'draft',
  'ordered',
  'partially_received',
  'received',
  'cancelled',
  'closed',
];
const warehouseTransferStatuses = [
  'reserved',
  'shipped',
  'partially_received',
  'received',
  'cancelled',
];
const warehouseOptionStatuses = ['active', 'inactive'];

class InventoryBarcodeLookup {
  const InventoryBarcodeLookup({
    required this.storeId,
    required this.barcode,
    required this.productId,
    required this.productName,
    required this.productSku,
    required this.variantId,
    required this.variantTitle,
    required this.variantSku,
    required this.matchedField,
  });

  factory InventoryBarcodeLookup.fromJson(Map<String, dynamic> json) {
    final product = _mapValue(json['product']);
    final variant = _mapValue(json['variant']);
    return InventoryBarcodeLookup(
      storeId: _stringValue(json['store_id'] ?? product['store_id']),
      barcode: _stringValue(json['barcode']),
      productId: _stringValue(product['id']),
      productName: _stringValue(product['name'], fallback: 'Product'),
      productSku: _stringValue(product['sku']),
      variantId: _stringValue(variant['id']),
      variantTitle: _stringValue(variant['title']),
      variantSku: _stringValue(variant['sku']),
      matchedField: _stringValue(json['matched_field']),
    );
  }

  final String storeId;
  final String barcode;
  final String productId;
  final String productName;
  final String productSku;
  final String variantId;
  final String variantTitle;
  final String variantSku;
  final String matchedField;

  String get sku => variantSku.isNotEmpty ? variantSku : productSku;
  String get label =>
      variantTitle.isEmpty ? productName : '$productName / $variantTitle';
}

/// Canonical mirror of the exact warehouse page metadata contract. A page is a
/// current read; this does not claim a snapshot spanning separate page requests.
class WarehousePageContract {
  const WarehousePageContract({
    required this.storeId,
    required this.page,
    required this.limit,
    required this.total,
    required this.hasMore,
  });
  final String storeId;
  final int page, limit, total;
  final bool hasMore;
  factory WarehousePageContract.fromJson(
    Map<String, dynamic> meta, {
    required String storeId,
    required int page,
    required int limit,
    required int rowCount,
  }) {
    final total = meta['total'], more = meta['has_next'];
    if (!_recordId(meta['store_id']) ||
        meta['store_id'] != storeId ||
        meta['page'] != page ||
        meta['per_page'] != limit ||
        page < 1 ||
        page > 1000000 ||
        limit < 1 ||
        limit > 100 ||
        meta['total_is_exact'] != true ||
        total is! int ||
        total < 0 ||
        total > 9007199254740991 ||
        more is! bool ||
        more != (page * limit < total) ||
        rowCount != (total - (page - 1) * limit).clamp(0, limit)) {
      throw const FormatException('The warehouse page could not be confirmed.');
    }
    return WarehousePageContract(
      storeId: storeId,
      page: page,
      limit: limit,
      total: total,
      hasMore: more,
    );
  }
}

void _verifyWarehouseOption(
  Map<String, dynamic> json, {
  required bool supplier,
}) {
  final site = json[supplier ? 'site_id' : 'store_id'],
      name = json['name'],
      address = json['address'];
  if (!_recordId(json['id']) ||
      !_recordId(site) ||
      name is! String ||
      name.trim().isEmpty ||
      name.trim().length > 200 ||
      !warehouseOptionStatuses.contains(json['status']) ||
      _recordDate(json['created_at']) == null ||
      (json[supplier ? 'store_id' : 'site_id'] != null &&
          json[supplier ? 'store_id' : 'site_id'] != site) ||
      !json.containsKey('address') ||
      json['deleted_at'] != null ||
      (supplier ? address is! Map : address != null && address is! Map) ||
      (!supplier && json['is_default'] is! bool)) {
    throw const FormatException('The warehouse choice could not be confirmed.');
  }
  if (supplier)
    for (final key in ['contact_name', 'email', 'phone']) {
      if (!json.containsKey(key) || (json[key] != null && json[key] is! String))
        throw const FormatException(
          'The supplier contact could not be confirmed.',
        );
    }
}

class InventoryLocationContract {
  const InventoryLocationContract({
    required this.id,
    required this.storeId,
    required this.name,
    required this.address,
    required this.city,
    required this.state,
    required this.country,
    required this.isDefault,
    required this.status,
  });

  factory InventoryLocationContract.fromVerifiedJson(
    Map<String, dynamic> json,
  ) {
    _verifyWarehouseOption(json, supplier: false);
    return InventoryLocationContract.fromJson(json);
  }
  factory InventoryLocationContract.fromJson(Map<String, dynamic> json) {
    final address = _mapValue(json['address']);
    return InventoryLocationContract(
      id: _stringValue(json['id']),
      storeId: _stringValue(json['store_id'] ?? json['site_id']),
      name: _stringValue(json['name'], fallback: 'Location'),
      address: _stringValue(
        address.isEmpty ? json['address'] : address['address'],
      ),
      city: _stringValue(json['city'] ?? address['city']),
      state: _stringValue(json['state'] ?? address['state']),
      country: _stringValue(json['country'] ?? address['country']),
      isDefault: _boolValue(json['is_default']),
      status: _stringValue(json['status'], fallback: 'active'),
    );
  }

  final String id;
  final String storeId;
  final String name;
  final String address;
  final String city;
  final String state;
  final String country;
  final bool isDefault;
  final String status;

  String get locality {
    final parts = [city, state, country].where((part) => part.isNotEmpty);
    return parts.isEmpty ? 'No address' : parts.join(', ');
  }
}

class InventoryLocationInput {
  const InventoryLocationInput({
    required this.storeId,
    required this.name,
    this.address = '',
    this.city = '',
    this.state = '',
    this.country = 'IN',
    this.isDefault = false,
  });

  final String storeId;
  final String name;
  final String address;
  final String city;
  final String state;
  final String country;
  final bool isDefault;

  Map<String, dynamic> toJson() => {
    'store_id': storeId,
    'name': name.trim(),
    if (address.trim().isNotEmpty) 'address': address.trim(),
    if (city.trim().isNotEmpty) 'city': city.trim(),
    if (state.trim().isNotEmpty) 'state': state.trim(),
    'country': country.trim().isEmpty ? 'IN' : country.trim().toUpperCase(),
    'is_default': isDefault,
  };
}

class InventorySupplierContract {
  const InventorySupplierContract({
    required this.id,
    required this.status,
    required this.storeId,
    required this.name,
    required this.contactName,
    required this.email,
    required this.phone,
    required this.address,
  });

  factory InventorySupplierContract.fromVerifiedJson(
    Map<String, dynamic> json,
  ) {
    _verifyWarehouseOption(json, supplier: true);
    return InventorySupplierContract.fromJson(json);
  }
  factory InventorySupplierContract.fromJson(Map<String, dynamic> json) {
    return InventorySupplierContract(
      id: _stringValue(json['id']),
      status: _stringValue(json['status']),
      storeId: _stringValue(json['store_id'] ?? json['site_id']),
      name: _stringValue(json['name'], fallback: 'Supplier'),
      contactName: _stringValue(json['contact_name']),
      email: _stringValue(json['email']),
      phone: _stringValue(json['phone']),
      address: _stringValue(
        json['address_text'] ??
            (json['address'] is Map
                ? (_mapValue(json['address'])['address'] ??
                      _mapValue(json['address'])['line1'])
                : json['address']),
      ),
    );
  }

  final String id;
  final String status;
  final String storeId;
  final String name;
  final String contactName;
  final String email;
  final String phone;
  final String address;
}

class InventorySupplierInput {
  const InventorySupplierInput({
    required this.storeId,
    required this.name,
    this.contactName = '',
    this.email = '',
    this.phone = '',
    this.address = '',
  });

  final String storeId;
  final String name;
  final String contactName;
  final String email;
  final String phone;
  final String address;

  Map<String, dynamic> toJson() => {
    'store_id': storeId,
    'name': name.trim(),
    if (contactName.trim().isNotEmpty) 'contact_name': contactName.trim(),
    if (email.trim().isNotEmpty) 'email': email.trim(),
    if (phone.trim().isNotEmpty) 'phone': phone.trim(),
    if (address.trim().isNotEmpty) 'address': {'line1': address.trim()},
  };
}

class InventoryLineInput {
  const InventoryLineInput({
    required this.productId,
    required this.quantity,
    this.variantId,
    this.unitCost = 0,
  });

  final String productId;
  final String? variantId;
  final int quantity;
  final num unitCost;

  Map<String, dynamic> toPurchaseOrderJson() => {
    'product_id': productId.trim(),
    if (variantId != null && variantId!.trim().isNotEmpty)
      'variant_id': variantId!.trim(),
    'quantity': quantity,
    'unit_cost': unitCost,
  };

  Map<String, dynamic> toTransferJson() => {
    'product_id': productId.trim(),
    if (variantId != null && variantId!.trim().isNotEmpty)
      'variant_id': variantId!.trim(),
    'quantity': quantity,
  };
}

int _warehouseCount(Object? value, {int minimum = 0, int maximum = 999999}) {
  if (value is! num ||
      !value.isFinite ||
      value != value.roundToDouble() ||
      value < minimum ||
      value > maximum) {
    throw const FormatException(
      'The warehouse quantities could not be confirmed.',
    );
  }
  return value.toInt();
}

class PurchaseOrderLineContract {
  const PurchaseOrderLineContract({
    required this.id,
    required this.productId,
    required this.variantId,
    required this.sku,
    required this.productName,
    required this.quantity,
    required this.receivedQuantity,
    required this.unitCost,
  });

  factory PurchaseOrderLineContract.fromJson(Map<String, dynamic> json) {
    final product = json['product'];
    final quantity = _warehouseCount(json['quantity_ordered'], minimum: 1);
    final received = _warehouseCount(
      json['quantity_received'],
      maximum: quantity,
    );
    final cost = json['unit_cost'];
    if (cost is! num || !cost.isFinite || cost < 0)
      throw const FormatException('The purchase cost could not be confirmed.');
    return PurchaseOrderLineContract(
      id: _stringValue(json['id']),
      productId: _stringValue(json['product_id']),
      variantId: _stringValue(json['variant_id']),
      sku: _stringValue(
        json['sku'] ?? (product is Map ? product['sku'] : null),
      ),
      productName: _stringValue(
        json['product_name'] ?? (product is Map ? product['name'] : null),
        fallback: 'Product',
      ),
      quantity: quantity,
      receivedQuantity: received,
      unitCost: cost,
    );
  }

  final String id;
  final String productId;
  final String variantId;
  final String sku;
  final String productName;
  final int quantity;
  final int receivedQuantity;
  final num unitCost;

  int get remainingQuantity => (quantity - receivedQuantity).clamp(0, quantity);
}

// Strict read boundary for the canonical warehouse document DTO. Command receipts
// retain their separate acknowledgement validator and do not supply read authority.
void _verifyWarehouseDocument(
  Map<String, dynamic> json, {
  required bool transfer,
}) {
  Never invalid() => throw const FormatException(
    'The warehouse document could not be confirmed.',
  );
  bool nullableId(Object? value) => value == null || _recordId(value);
  bool money(Object? value) =>
      value is num &&
      value.isFinite &&
      value >= 0 &&
      (value * 100).round() / 100 == value;
  bool dateField(String key) =>
      json.containsKey(key) &&
      (json[key] == null || _recordDate(json[key]) != null);
  final site = json['site_id'], target = json['id'], lines = json['lines'];
  if (!_recordId(site) ||
      !_recordId(target) ||
      _recordDate(json['created_at']) == null ||
      (json['store_id'] != null && json['store_id'] != site) ||
      !json.containsKey('notes') ||
      (json['notes'] != null && json['notes'] is! String) ||
      (json['updated_at'] != null && _recordDate(json['updated_at']) == null) ||
      lines is! List ||
      lines.isEmpty ||
      lines.length > 200)
    invalid();
  if (transfer) {
    if (!warehouseTransferStatuses.contains(json['status']) ||
        json['transfer_number'] is! String ||
        (json['transfer_number'] as String).isEmpty ||
        !_recordId(json['source_location_id']) ||
        !_recordId(json['destination_location_id']) ||
        json['source_location_id'] == json['destination_location_id'] ||
        !dateField('shipped_at') ||
        !dateField('received_at'))
      invalid();
  } else {
    if (!warehousePurchaseOrderStatuses.contains(json['status']) ||
        json['po_number'] is! String ||
        (json['po_number'] as String).isEmpty ||
        !json.containsKey('supplier_id') ||
        !nullableId(json['supplier_id']) ||
        !json.containsKey('location_id') ||
        !nullableId(json['location_id']) ||
        !dateField('expected_at') ||
        json['currency'] != 'INR' ||
        !money(json['subtotal']) ||
        !money(json['total']))
      invalid();
    final supplier = json['supplier'];
    if (supplier != null &&
        (supplier is! Map ||
            supplier['id'] != json['supplier_id'] ||
            supplier['site_id'] != site ||
            supplier['name'] is! String))
      invalid();
  }
  final ids = <String>{};
  for (final raw in lines) {
    if (raw is! Map) invalid();
    final line = Map<String, dynamic>.from(raw);
    if (!_recordId(line['id']) ||
        !ids.add(line['id'] as String) ||
        line['site_id'] != site ||
        line[transfer ? 'transfer_id' : 'purchase_order_id'] != target ||
        !_recordId(line['product_id']) ||
        !line.containsKey('variant_id') ||
        !nullableId(line['variant_id']) ||
        _recordDate(line['created_at']) == null ||
        (line['updated_at'] != null && _recordDate(line['updated_at']) == null))
      invalid();
    if (transfer) {
      InventoryTransferLineContract.fromJson(line);
    } else {
      if (!money(line['unit_cost'])) invalid();
      PurchaseOrderLineContract.fromJson(line);
    }
  }
}

class PurchaseOrderContract {
  const PurchaseOrderContract({
    required this.id,
    this.poNumber = '',
    required this.storeId,
    required this.supplierId,
    required this.supplierName,
    required this.locationId,
    required this.status,
    required this.expectedAt,
    required this.notes,
    required this.lines,
  });

  factory PurchaseOrderContract.fromVerifiedJson(Map<String, dynamic> json) {
    _verifyWarehouseDocument(json, transfer: false);
    return PurchaseOrderContract.fromJson(json);
  }
  factory PurchaseOrderContract.fromJson(Map<String, dynamic> json) {
    final command = json;
    if (command['purchase_order'] is Map) {
      json = {
        ..._mapValue(command['purchase_order']),
        'lines': command['lines'],
      };
    }
    final supplier = json['supplier'];
    final rawLines = json['lines'];
    return PurchaseOrderContract(
      id: _stringValue(json['id']),
      poNumber: _stringValue(json['po_number']),
      storeId: _stringValue(json['store_id'] ?? json['site_id']),
      supplierId: _stringValue(json['supplier_id']),
      supplierName: _stringValue(
        supplier is Map ? supplier['name'] : json['supplier_name'],
        fallback: 'No supplier',
      ),
      locationId: _stringValue(json['location_id']),
      status: _stringValue(json['status'], fallback: 'draft'),
      expectedAt: _stringValue(json['expected_at']),
      notes: _stringValue(json['notes']),
      lines: rawLines is List
          ? rawLines
                .whereType<Map>()
                .map(
                  (line) => PurchaseOrderLineContract.fromJson(
                    Map<String, dynamic>.from(line),
                  ),
                )
                .toList(growable: false)
          : const [],
    );
  }

  final String id;
  final String poNumber;
  final String storeId;
  final String supplierId;
  final String supplierName;
  final String locationId;
  final String status;
  final String expectedAt;
  final String notes;
  final List<PurchaseOrderLineContract> lines;

  int get totalQuantity => lines.fold(0, (sum, line) => sum + line.quantity);
  int get remainingQuantity =>
      lines.fold(0, (sum, line) => sum + line.remainingQuantity);
}

class PurchaseOrderInput {
  const PurchaseOrderInput({
    required this.storeId,
    required this.locationId,
    required this.lines,
    required this.idempotencyKey,
    this.supplierId,
    this.expectedAt,
    this.notes = '',
  });

  final String storeId;
  final String locationId;
  final String? supplierId;
  final String? expectedAt;
  final String notes;
  final List<InventoryLineInput> lines;
  final String idempotencyKey;

  Map<String, dynamic> toJson() => {
    'store_id': storeId,
    'location_id': locationId.trim(),
    if (supplierId != null && supplierId!.trim().isNotEmpty)
      'supplier_id': supplierId!.trim(),
    if (expectedAt != null && expectedAt!.trim().isNotEmpty)
      'expected_at': expectedAt!.trim(),
    if (notes.trim().isNotEmpty) 'notes': notes.trim(),
    'lines': lines.map((line) => line.toPurchaseOrderJson()).toList(),
    'idempotency_key': idempotencyKey,
  };
}

class InventoryTransferLineContract {
  const InventoryTransferLineContract({
    required this.id,
    required this.productId,
    required this.variantId,
    required this.sku,
    required this.productName,
    required this.quantity,
    required this.receivedQuantity,
    this.shippedQuantity = 0,
  });

  factory InventoryTransferLineContract.fromJson(Map<String, dynamic> json) {
    final product = json['product'];
    final quantity = _warehouseCount(json['quantity_requested'], minimum: 1);
    final shipped = _warehouseCount(
      json['quantity_shipped'],
      maximum: quantity,
    );
    final received = _warehouseCount(
      json['quantity_received'],
      maximum: shipped,
    );
    return InventoryTransferLineContract(
      id: _stringValue(json['id']),
      productId: _stringValue(json['product_id']),
      variantId: _stringValue(json['variant_id']),
      sku: _stringValue(
        json['sku'] ?? (product is Map ? product['sku'] : null),
      ),
      productName: _stringValue(
        json['product_name'] ?? (product is Map ? product['name'] : null),
        fallback: 'Product',
      ),
      quantity: quantity,
      receivedQuantity: received,
      shippedQuantity: shipped,
    );
  }

  final String id;
  final String productId;
  final String variantId;
  final String sku;
  final String productName;
  final int quantity;
  final int receivedQuantity;
  final int shippedQuantity;

  int get remainingQuantity => (quantity - receivedQuantity).clamp(0, quantity);
}

class InventoryTransferContract {
  const InventoryTransferContract({
    required this.id,
    this.transferNumber = '',
    required this.storeId,
    required this.sourceLocationId,
    required this.destinationLocationId,
    required this.status,
    required this.notes,
    required this.lines,
  });

  factory InventoryTransferContract.fromVerifiedJson(
    Map<String, dynamic> json,
  ) {
    _verifyWarehouseDocument(json, transfer: true);
    return InventoryTransferContract.fromJson(json);
  }
  factory InventoryTransferContract.fromJson(Map<String, dynamic> json) {
    final command = json;
    if (command['transfer'] is Map) {
      json = {..._mapValue(command['transfer']), 'lines': command['lines']};
    }
    final rawLines = json['lines'];
    return InventoryTransferContract(
      id: _stringValue(json['id']),
      transferNumber: _stringValue(json['transfer_number']),
      storeId: _stringValue(json['store_id'] ?? json['site_id']),
      sourceLocationId: _stringValue(json['source_location_id']),
      destinationLocationId: _stringValue(json['destination_location_id']),
      status: _stringValue(json['status'], fallback: 'draft'),
      notes: _stringValue(json['notes']),
      lines: rawLines is List
          ? rawLines
                .whereType<Map>()
                .map(
                  (line) => InventoryTransferLineContract.fromJson(
                    Map<String, dynamic>.from(line),
                  ),
                )
                .toList(growable: false)
          : const [],
    );
  }

  final String id;
  final String transferNumber;
  final String storeId;
  final String sourceLocationId;
  final String destinationLocationId;
  final String status;
  final String notes;
  final List<InventoryTransferLineContract> lines;

  int get totalQuantity => lines.fold(0, (sum, line) => sum + line.quantity);
  int get remainingQuantity =>
      lines.fold(0, (sum, line) => sum + line.remainingQuantity);
}

class InventoryTransferInput {
  const InventoryTransferInput({
    required this.storeId,
    required this.sourceLocationId,
    required this.destinationLocationId,
    required this.lines,
    required this.idempotencyKey,
    this.notes = '',
  });

  final String storeId;
  final String sourceLocationId;
  final String destinationLocationId;
  final String notes;
  final List<InventoryLineInput> lines;
  final String idempotencyKey;

  Map<String, dynamic> toJson() => {
    'store_id': storeId,
    'source_location_id': sourceLocationId.trim(),
    'destination_location_id': destinationLocationId.trim(),
    if (notes.trim().isNotEmpty) 'notes': notes.trim(),
    'lines': lines.map((line) => line.toTransferJson()).toList(),
    'idempotency_key': idempotencyKey,
  };
}

int _intValue(Object? value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? fallback;
}

num _numValue(Object? value, {num fallback = 0}) {
  if (value is num) return value;
  return num.tryParse(value?.toString() ?? '') ?? fallback;
}

bool _boolValue(Object? value, {bool fallback = false}) {
  if (value is bool) return value;
  if (value is String) return value.toLowerCase() == 'true';
  return fallback;
}

String _stringValue(Object? value, {String fallback = ''}) {
  if (value is Map) {
    return value.entries
        .map((entry) => '${entry.key}: ${entry.value}')
        .join(', ');
  }
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? fallback : text;
}

Map<String, dynamic> _mapValue(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return const {};
}

int _inventoryQuantity(Object? value) {
  if (value is int) return value;
  if (value is num && value.isFinite && value == value.roundToDouble())
    return value.toInt();
  if (value is String && RegExp(r'^-?[0-9]+$').hasMatch(value.trim()))
    return int.parse(value.trim());
  throw const FormatException('Inventory quantity is unavailable.');
}
