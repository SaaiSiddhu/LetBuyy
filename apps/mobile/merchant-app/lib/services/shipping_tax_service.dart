import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import 'api_client.dart' hide JsonMap;

class ShippingTaxService extends ChangeNotifier {
  ShippingTaxService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  List<ShippingZoneContract> _zones = [];
  List<ShippingZoneContract> get zones => List.unmodifiable(_zones);

  List<ShippingRateContract> _rates = [];
  List<ShippingRateContract> get rates => List.unmodifiable(_rates);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Future<ShippingSummary> fetchShipping(String storeId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final results = await Future.wait([
        _api.shipping.zones.list(storeId),
        _api.shipping.rates.list(storeId),
      ]);
      _zones = results[0]
          .map(ShippingZoneContract.fromJson)
          .toList(growable: false);
      _rates = results[1]
          .map(ShippingRateContract.fromJson)
          .toList(growable: false);
      return ShippingSummary(zones: _zones, rates: _rates);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<List<ShippingZoneContract>> fetchZones(String storeId) async {
    final rows = await _api.shipping.zones.list(storeId);
    _zones = rows.map(ShippingZoneContract.fromJson).toList(growable: false);
    notifyListeners();
    return _zones;
  }

  Future<List<ShippingRateContract>> fetchRates(String storeId) async {
    final rows = await _api.shipping.rates.list(storeId);
    _rates = rows.map(ShippingRateContract.fromJson).toList(growable: false);
    notifyListeners();
    return _rates;
  }

  Future<ShippingZoneContract> createZone(ShippingZoneInput input) async {
    final created = ShippingZoneContract.fromJson(
      await _api.shipping.zones.create(input.toJson(includeStoreId: true)),
    );
    _zones = [..._zones, created];
    notifyListeners();
    return created;
  }

  Future<ShippingZoneContract> updateZone(
    String id,
    ShippingZoneInput input,
  ) async {
    final updated = ShippingZoneContract.fromJson(
      await _api.shipping.zones.update(id, input.toJson(includeStoreId: false)),
    );
    final index = _zones.indexWhere((zone) => zone.id == id);
    if (index == -1) {
      _zones = [..._zones, updated];
    } else {
      final next = List<ShippingZoneContract>.from(_zones);
      next[index] = updated;
      _zones = next;
    }
    notifyListeners();
    return updated;
  }

  Future<void> deleteZone(String id) async {
    await _api.shipping.zones.remove(id);
    _zones = _zones.where((zone) => zone.id != id).toList();
    _rates = _rates.where((rate) => rate.zoneId != id).toList();
    notifyListeners();
  }

  Future<ShippingRateContract> createRate(ShippingRateInput input) async {
    final created = ShippingRateContract.fromJson(
      await _api.shipping.rates.create(input.toJson()),
    );
    _rates = [..._rates, created];
    notifyListeners();
    return created;
  }

  Future<ShippingRateContract> updateRate(
    String id,
    ShippingRateInput input,
  ) async {
    final updated = ShippingRateContract.fromJson(
      await _api.shipping.rates.update(id, input.toJson()),
    );
    final index = _rates.indexWhere((rate) => rate.id == id);
    if (index == -1) {
      _rates = [..._rates, updated];
    } else {
      final next = List<ShippingRateContract>.from(_rates);
      next[index] = updated;
      _rates = next;
    }
    notifyListeners();
    return updated;
  }

  Future<void> deleteRate(String id) async {
    await _api.shipping.rates.remove(id);
    _rates = _rates.where((rate) => rate.id != id).toList();
    notifyListeners();
  }
}

class ShippingSummary {
  const ShippingSummary({required this.zones, required this.rates});

  final List<ShippingZoneContract> zones;
  final List<ShippingRateContract> rates;
}

class ShippingZoneContract extends SharedTypeContract {
  ShippingZoneContract(super.json);

  factory ShippingZoneContract.fromJson(JsonMap json) =>
      ShippingZoneContract(json);

  String get id => _string('id');
  String get storeId => _string('store_id');
  String get name => _string('name', fallback: 'Shipping zone');
  List<String> get countries => _stringList('countries');
  List<String> get states => _stringList('states');
  List<String> get zipCodes => _stringList('zip_codes');
  String? get createdAt => _optionalString('created_at');
  String? get updatedAt => _optionalString('updated_at');

  String _string(String key, {String fallback = ''}) {
    return toJson()[key]?.toString() ?? fallback;
  }

  String? _optionalString(String key) {
    final value = toJson()[key]?.toString();
    return value == null || value.isEmpty ? null : value;
  }

  List<String> _stringList(String key) {
    final value = toJson()[key];
    if (value is List) return value.map((item) => '$item').toList();
    return const [];
  }
}

class ShippingRateContract extends SharedTypeContract {
  ShippingRateContract(super.json);

  factory ShippingRateContract.fromJson(JsonMap json) =>
      ShippingRateContract(json);

  String get id => _string('id');
  String get zoneId => _string('zone_id');
  String get name => _string('name', fallback: 'Shipping rate');
  String get type => _string('type', fallback: 'flat');
  double get price => _number('price');
  int? get minWeightGrams => _optionalInt('min_weight_grams');
  int? get maxWeightGrams => _optionalInt('max_weight_grams');
  double? get minOrderAmount => _optionalNumber('min_order_amount');
  double? get maxOrderAmount => _optionalNumber('max_order_amount');
  int? get estimatedDaysMin => _optionalInt('estimated_days_min');
  int? get estimatedDaysMax => _optionalInt('estimated_days_max');
  bool get isActive => _bool('is_active', fallback: true);
  String? get createdAt => _optionalString('created_at');
  String? get updatedAt => _optionalString('updated_at');

  String _string(String key, {String fallback = ''}) {
    return toJson()[key]?.toString() ?? fallback;
  }

  String? _optionalString(String key) {
    final value = toJson()[key]?.toString();
    return value == null || value.isEmpty ? null : value;
  }

  bool _bool(String key, {bool fallback = false}) {
    final value = toJson()[key];
    return value is bool ? value : fallback;
  }

  double _number(String key) => _optionalNumber(key) ?? 0;

  double? _optionalNumber(String key) {
    final value = toJson()[key];
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString());
  }

  int? _optionalInt(String key) {
    final value = toJson()[key];
    if (value == null) return null;
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString());
  }
}

class ShippingZoneInput {
  const ShippingZoneInput({
    required this.storeId,
    required this.name,
    required this.countries,
    this.states = const [],
    this.zipCodes = const [],
  });

  final String storeId;
  final String name;
  final List<String> countries;
  final List<String> states;
  final List<String> zipCodes;

  Map<String, dynamic> toJson({required bool includeStoreId}) {
    return {
      if (includeStoreId) 'store_id': storeId,
      'name': name.trim(),
      'countries': _cleanList(countries),
      'states': _cleanList(states),
      'zip_codes': _cleanList(zipCodes),
    };
  }
}

class ShippingRateInput {
  const ShippingRateInput({
    required this.zoneId,
    required this.name,
    required this.type,
    required this.price,
    this.minWeightGrams,
    this.maxWeightGrams,
    this.minOrderAmount,
    this.maxOrderAmount,
    this.estimatedDaysMin,
    this.estimatedDaysMax,
    this.isActive = true,
  });

  final String zoneId;
  final String name;
  final String type;
  final double price;
  final int? minWeightGrams;
  final int? maxWeightGrams;
  final double? minOrderAmount;
  final double? maxOrderAmount;
  final int? estimatedDaysMin;
  final int? estimatedDaysMax;
  final bool isActive;

  Map<String, dynamic> toJson() {
    return {
      'zone_id': zoneId,
      'name': name.trim(),
      'type': type.trim().isEmpty ? 'flat' : type.trim(),
      'price': price,
      if (minWeightGrams != null) 'min_weight_grams': minWeightGrams,
      if (maxWeightGrams != null) 'max_weight_grams': maxWeightGrams,
      if (minOrderAmount != null) 'min_order_amount': minOrderAmount,
      if (maxOrderAmount != null) 'max_order_amount': maxOrderAmount,
      if (estimatedDaysMin != null) 'estimated_days_min': estimatedDaysMin,
      if (estimatedDaysMax != null) 'estimated_days_max': estimatedDaysMax,
      'is_active': isActive,
    };
  }
}

List<String> _cleanList(List<String> values) {
  return values
      .map((value) => value.trim())
      .where((value) => value.isNotEmpty)
      .toList(growable: false);
}
