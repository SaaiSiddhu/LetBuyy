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
      storeId: _stringValue(json['store_id']),
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

  static int _intValue(Object? value, {int fallback = 0}) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? fallback;
  }

  static String _stringValue(Object? value, {String fallback = ''}) {
    final text = value?.toString().trim();
    return text == null || text.isEmpty ? fallback : text;
  }
}

class InventoryService extends ChangeNotifier {
  InventoryService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  List<InventoryLevel> _levels = [];
  List<InventoryLevel> get levels => List.unmodifiable(_levels);

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
        'inventory_level_id': level.id,
        'product_id': level.productId,
        'variant_id': level.variantId,
        'location_id': level.locationId,
        'sku': level.sku,
        'delta': delta,
        'reason': reason,
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
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
}
