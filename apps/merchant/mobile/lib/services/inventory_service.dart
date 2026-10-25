import 'package:flutter/foundation.dart';

import 'api_client.dart';

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
  });

  factory InventoryLevel.fromJson(Map<String, dynamic> json) {
    final available = _intValue(
      json['available'] ?? json['available_quantity'],
    );
    final reserved = _intValue(json['reserved'] ?? json['reserved_quantity']);
    final committed = _intValue(
      json['committed'] ?? json['committed_quantity'],
    );
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
      locationId: _stringValue(json['location_id'], fallback: 'default'),
      available: available,
      reserved: reserved,
      committed: committed,
      onHand: _intValue(json['on_hand'] ?? json['stock'], fallback: available),
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
  final int committed;
  final int onHand;

  bool get isOutOfStock => available <= 0;
  bool get isLowStock => available > 0 && available <= 5;
}

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
      country: _stringValue(
        json['country'] ?? address['country'],
        fallback: 'IN',
      ),
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
    required this.storeId,
    required this.name,
    required this.contactName,
    required this.email,
    required this.phone,
    required this.address,
  });

  factory InventorySupplierContract.fromJson(Map<String, dynamic> json) {
    return InventorySupplierContract(
      id: _stringValue(json['id']),
      storeId: _stringValue(json['store_id'] ?? json['site_id']),
      name: _stringValue(json['name'], fallback: 'Supplier'),
      contactName: _stringValue(json['contact_name']),
      email: _stringValue(json['email']),
      phone: _stringValue(json['phone']),
      address: _stringValue(json['address_text'] ?? json['address']),
    );
  }

  final String id;
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
      quantity: _intValue(json['quantity']),
      receivedQuantity: _intValue(
        json['received_quantity'] ?? json['received'],
      ),
      unitCost: _numValue(json['unit_cost']),
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

class PurchaseOrderContract {
  const PurchaseOrderContract({
    required this.id,
    required this.storeId,
    required this.supplierId,
    required this.supplierName,
    required this.locationId,
    required this.status,
    required this.expectedAt,
    required this.notes,
    required this.lines,
  });

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
  });

  factory InventoryTransferLineContract.fromJson(Map<String, dynamic> json) {
    final product = json['product'];
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
      quantity: _intValue(json['quantity']),
      receivedQuantity: _intValue(
        json['received_quantity'] ?? json['received'],
      ),
    );
  }

  final String id;
  final String productId;
  final String variantId;
  final String sku;
  final String productName;
  final int quantity;
  final int receivedQuantity;

  int get remainingQuantity => (quantity - receivedQuantity).clamp(0, quantity);
}

class InventoryTransferContract {
  const InventoryTransferContract({
    required this.id,
    required this.storeId,
    required this.sourceLocationId,
    required this.destinationLocationId,
    required this.status,
    required this.notes,
    required this.lines,
  });

  factory InventoryTransferContract.fromJson(Map<String, dynamic> json) {
    final command = json;
    if (command['transfer'] is Map) {
      json = {..._mapValue(command['transfer']), 'lines': command['lines']};
    }
    final rawLines = json['lines'];
    return InventoryTransferContract(
      id: _stringValue(json['id']),
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

class InventoryService extends ChangeNotifier {
  InventoryService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  List<InventoryLevel> _levels = [];
  List<InventoryLevel> get levels => List.unmodifiable(_levels);

  List<InventoryLocationContract> _locations = [];
  List<InventoryLocationContract> get locations =>
      List.unmodifiable(_locations);

  List<InventorySupplierContract> _suppliers = [];
  List<InventorySupplierContract> get suppliers =>
      List.unmodifiable(_suppliers);

  List<PurchaseOrderContract> _purchaseOrders = [];
  List<PurchaseOrderContract> get purchaseOrders =>
      List.unmodifiable(_purchaseOrders);

  List<InventoryTransferContract> _transfers = [];
  List<InventoryTransferContract> get transfers =>
      List.unmodifiable(_transfers);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Future<List<InventoryLevel>> fetchLevels(
    String storeId, {
    bool lowStockOnly = false,
    int page = 1,
    int limit = 50,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final pageResult = await _api.inventory.levels(
        query: {
          'store_id': storeId,
          'page': page,
          'limit': limit,
          if (lowStockOnly) 'low_stock': true,
        },
      );
      _levels = pageResult.data
          .map(InventoryLevel.fromJson)
          .toList(growable: false);
      return _levels;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<InventoryLevel> adjustStock({
    required String storeId,
    required InventoryLevel level,
    required int delta,
    required String reason,
    String? note,
  }) async {
    final adjusted = InventoryLevel.fromJson(
      await _api.inventory.adjust({
        'store_id': storeId,
        'product_id': level.productId,
        if (level.variantId.isNotEmpty) 'variant_id': level.variantId,
        if (level.locationId.isNotEmpty) 'location_id': level.locationId,
        'sku': level.sku,
        'adjustment': delta,
        'reason': reason,
        if (note != null && note.trim().isNotEmpty) 'notes': note.trim(),
      }),
    );

    final index = _levels.indexWhere((item) => item.id == level.id);
    if (index == -1) {
      _levels = [adjusted, ..._levels];
    } else {
      final next = List<InventoryLevel>.from(_levels);
      next[index] = adjusted;
      _levels = next;
    }
    notifyListeners();
    return adjusted;
  }

  Future<InventoryLevel> adjustScannedStock({
    required String storeId,
    required InventoryBarcodeLookup lookup,
    required int delta,
    required String reason,
    String? locationId,
    String? note,
  }) async {
    final adjusted = InventoryLevel.fromJson(
      await _api.inventory.adjust({
        'store_id': storeId,
        'product_id': lookup.productId,
        if (lookup.variantId.isNotEmpty) 'variant_id': lookup.variantId,
        if (locationId != null && locationId.trim().isNotEmpty)
          'location_id': locationId.trim(),
        if (lookup.sku.isNotEmpty) 'sku': lookup.sku,
        'adjustment': delta,
        'reason': reason,
        if (note != null && note.trim().isNotEmpty) 'notes': note.trim(),
      }),
    );

    final index = _levels.indexWhere((item) => item.id == adjusted.id);
    if (index == -1) {
      _levels = [adjusted, ..._levels];
    } else {
      final next = List<InventoryLevel>.from(_levels);
      next[index] = adjusted;
      _levels = next;
    }
    notifyListeners();
    return adjusted;
  }

  Future<InventoryBarcodeLookup?> lookupBarcode({
    required String storeId,
    required String barcode,
  }) async {
    final normalized = barcode.trim();
    if (normalized.isEmpty) return null;
    try {
      return InventoryBarcodeLookup.fromJson(
        await _api.products.lookupBarcode(
          storeId: storeId,
          barcode: normalized,
        ),
      );
    } on ApiException catch (error) {
      if (error.statusCode == 404 || error.code == 'NOT_FOUND') return null;
      rethrow;
    }
  }

  Future<List<InventoryLocationContract>> fetchLocations(String storeId) async {
    final rows = await _api.inventory.locations(storeId: storeId);
    _locations = rows
        .map(InventoryLocationContract.fromJson)
        .toList(growable: false);
    notifyListeners();
    return _locations;
  }

  Future<InventoryLocationContract> createLocation(
    InventoryLocationInput input,
  ) async {
    final location = InventoryLocationContract.fromJson(
      await _api.inventory.createLocation(input.toJson()),
    );
    _locations = [location, ..._locations];
    notifyListeners();
    return location;
  }

  Future<List<InventorySupplierContract>> fetchSuppliers(String storeId) async {
    final rows = await _api.inventory.suppliers(storeId: storeId);
    _suppliers = rows
        .map(InventorySupplierContract.fromJson)
        .toList(growable: false);
    notifyListeners();
    return _suppliers;
  }

  Future<InventorySupplierContract> createSupplier(
    InventorySupplierInput input,
  ) async {
    final supplier = InventorySupplierContract.fromJson(
      await _api.inventory.createSupplier(input.toJson()),
    );
    _suppliers = [supplier, ..._suppliers];
    notifyListeners();
    return supplier;
  }

  Future<List<PurchaseOrderContract>> fetchPurchaseOrders(
    String storeId,
  ) async {
    final rows = await _api.inventory.purchaseOrders(storeId: storeId);
    _purchaseOrders = rows
        .map(PurchaseOrderContract.fromJson)
        .toList(growable: false);
    notifyListeners();
    return _purchaseOrders;
  }

  Future<PurchaseOrderContract> createPurchaseOrder(
    PurchaseOrderInput input,
  ) async {
    final purchaseOrder = PurchaseOrderContract.fromJson(
      await _api.inventory.createPurchaseOrder(input.toJson()),
    );
    _purchaseOrders = [purchaseOrder, ..._purchaseOrders];
    notifyListeners();
    return purchaseOrder;
  }

  Future<PurchaseOrderContract> receivePurchaseOrder(
    PurchaseOrderContract purchaseOrder, {
    required String idempotencyKey,
  }) async {
    final received = PurchaseOrderContract.fromJson(
      await _api.inventory.receivePurchaseOrder(purchaseOrder.id, {
        'idempotency_key': idempotencyKey,
      }),
    );
    _purchaseOrders = _replaceById(_purchaseOrders, received);
    notifyListeners();
    return received;
  }

  Future<List<InventoryTransferContract>> fetchTransfers(String storeId) async {
    final rows = await _api.inventory.transfers(storeId: storeId);
    _transfers = rows
        .map(InventoryTransferContract.fromJson)
        .toList(growable: false);
    notifyListeners();
    return _transfers;
  }

  Future<InventoryTransferContract> createTransfer(
    InventoryTransferInput input,
  ) async {
    final transfer = InventoryTransferContract.fromJson(
      await _api.inventory.createTransfer(input.toJson()),
    );
    _transfers = [transfer, ..._transfers];
    notifyListeners();
    return transfer;
  }

  Future<InventoryTransferContract> shipTransfer(
    InventoryTransferContract transfer, {
    required String idempotencyKey,
  }) async {
    final shipped = InventoryTransferContract.fromJson(
      await _api.inventory.shipTransfer(transfer.id, {
        'idempotency_key': idempotencyKey,
      }),
    );
    _transfers = _replaceById(_transfers, shipped);
    notifyListeners();
    return shipped;
  }

  Future<InventoryTransferContract> receiveTransfer(
    InventoryTransferContract transfer, {
    required String idempotencyKey,
  }) async {
    final received = InventoryTransferContract.fromJson(
      await _api.inventory.receiveTransfer(transfer.id, {
        'idempotency_key': idempotencyKey,
      }),
    );
    _transfers = _replaceById(_transfers, received);
    notifyListeners();
    return received;
  }

  String makeIdempotencyKey(String scope) {
    final timestamp = DateTime.now().microsecondsSinceEpoch;
    return 'mobile-$scope-$timestamp';
  }

  List<T> _replaceById<T>(List<T> items, T replacement) {
    final replacementId = switch (replacement) {
      PurchaseOrderContract item => item.id,
      InventoryTransferContract item => item.id,
      _ => '',
    };
    return items
        .map((item) {
          final id = switch (item) {
            PurchaseOrderContract item => item.id,
            InventoryTransferContract item => item.id,
            _ => '',
          };
          return id == replacementId ? replacement : item;
        })
        .cast<T>()
        .toList(growable: false);
  }
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
