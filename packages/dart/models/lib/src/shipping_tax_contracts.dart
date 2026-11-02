// Dart mirrors of the canonical shipping/tax contracts. Business rules remain server-owned.
import 'shared_contracts.dart';

/// Exact mirror of checkout-core's handling-charge parser (no sub-paise rounding).
int? parseShippingHandlingFeeMinor(String input) {
  if (!RegExp(r'^(0|[1-9]\d{0,6})(\.\d{1,2})?$').hasMatch(input)) return null;
  final parts = input.split('.');
  final minor =
      int.parse(parts[0]) * 100 +
      int.parse((parts.length == 1 ? '' : parts[1]).padRight(2, '0'));
  return minor <= 100000000 ? minor : null;
}

class ShippingProfileContract extends SharedTypeContract {
  ShippingProfileContract(super.json);
  factory ShippingProfileContract.fromJson(JsonMap json) {
    final fee = json['handling_fee_minor'];
    bool id(Object? value) =>
        value is String &&
        RegExp(
          r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
        ).hasMatch(value);
    if (!id(json['id']) ||
        !id(json['site_id']) ||
        json['name'] is! String ||
        json['is_default'] is! bool ||
        json['cod_enabled'] is! bool ||
        fee is! num ||
        !fee.isFinite ||
        fee < 0 ||
        fee > 100000000 ||
        fee != fee.roundToDouble() ||
        json['updated_at'] is! String ||
        DateTime.tryParse(json['updated_at'] as String) == null)
      throw const FormatException(
        'The shipping profile could not be confirmed.',
      );
    return ShippingProfileContract(json);
  }
  String get id => toJson()['id'] as String;
  String get storeId => toJson()['site_id'] as String;
  String get name => toJson()['name'] as String;
  bool get isDefault => toJson()['is_default'] as bool;
  bool get codEnabled => toJson()['cod_enabled'] as bool;
  int get handlingFeeMinor => (toJson()['handling_fee_minor'] as num).toInt();
  // Preserve the server's timestamp precision for optimistic concurrency.
  String get revision => toJson()['updated_at'] as String;
}

class ShippingProfileInput {
  const ShippingProfileInput({
    required this.storeId,
    required this.id,
    required this.name,
    required this.handlingFeeMinor,
    required this.codEnabled,
  });
  final String storeId, id, name;
  final int handlingFeeMinor;
  final bool codEnabled;
  JsonMap toJson() => {
    'store_id': storeId,
    'id': id,
    'name': name.trim(),
    'handling_fee_minor': handlingFeeMinor,
    'cod_enabled': codEnabled,
  };
}

class ShippingProfilePatch {
  const ShippingProfilePatch({
    required this.expectedRevision,
    this.name,
    this.handlingFeeMinor,
    this.codEnabled,
    this.makeDefault = false,
  });
  final String expectedRevision;
  final String? name;
  final int? handlingFeeMinor;
  final bool? codEnabled;
  final bool makeDefault;
  JsonMap toJson() => {
    'expected_revision': expectedRevision,
    if (name != null) 'name': name!.trim(),
    if (handlingFeeMinor != null) 'handling_fee_minor': handlingFeeMinor,
    if (codEnabled != null) 'cod_enabled': codEnabled,
    if (makeDefault) 'is_default': true,
  };
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
  String? get profileId => _optionalString('profile_id');
  bool? get codEnabled =>
      toJson()['cod_enabled'] is bool ? toJson()['cod_enabled'] as bool : null;
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
  bool? get codEnabled =>
      toJson()['cod_enabled'] is bool ? toJson()['cod_enabled'] as bool : null;
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
    this.profileId,
    this.profileChanged = false,
    this.codEnabled,
  });

  final String storeId;
  final String name;
  final List<String> countries;
  final List<String> states;
  final List<String> zipCodes;
  final String? profileId;
  final bool profileChanged;
  final bool? codEnabled;

  Map<String, dynamic> toJson({required bool includeStoreId}) {
    return {
      if (includeStoreId) 'store_id': storeId,
      'name': name.trim(),
      'countries': _cleanList(countries),
      'states': _cleanList(states),
      'zip_codes': _cleanList(zipCodes),
      if (profileChanged) 'profile_id': profileId,
      if (codEnabled != null) 'cod_enabled': codEnabled,
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
    this.codEnabled,
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
  final bool? codEnabled;

  Map<String, dynamic> toJson({bool forUpdate = false}) {
    return {
      if (!forUpdate) 'zone_id': zoneId,
      'name': name.trim(),
      'type': type.trim().isEmpty ? 'flat' : type.trim(),
      'price': price,
      if (forUpdate || minWeightGrams != null)
        'min_weight_grams': minWeightGrams,
      if (forUpdate || maxWeightGrams != null)
        'max_weight_grams': maxWeightGrams,
      if (forUpdate || minOrderAmount != null)
        'min_order_amount': minOrderAmount,
      if (forUpdate || maxOrderAmount != null)
        'max_order_amount': maxOrderAmount,
      if (forUpdate || estimatedDaysMin != null)
        'estimated_days_min': estimatedDaysMin,
      if (forUpdate || estimatedDaysMax != null)
        'estimated_days_max': estimatedDaysMax,
      'is_active': isActive,
      if (codEnabled != null) 'cod_enabled': codEnabled,
    };
  }
}

class TaxRateContract extends SharedTypeContract {
  TaxRateContract(super.json);

  factory TaxRateContract.fromJson(JsonMap json) => TaxRateContract(json);

  String get id => _string('id');
  String get storeId => _string('store_id');
  String get name => _string('name', fallback: 'Tax rate');
  double get rate => _number('rate');
  String get country => _string('country', fallback: 'IN');
  String? get state => _optionalString('state');
  String? get hsnCode => _optionalString('hsn_code');
  String get appliesTo => _string('applies_to', fallback: 'all');
  bool get isCompound => _bool('is_compound');
  bool get isShipping => _bool('is_shipping');
  int get priority => _int('priority');
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

  double _number(String key) {
    final value = toJson()[key];
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }

  int _int(String key) {
    final value = toJson()[key];
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }
}

class TaxRateInput {
  const TaxRateInput({
    required this.storeId,
    required this.name,
    required this.rate,
    this.country = 'IN',
    this.state,
    this.hsnCode,
    this.appliesTo = 'all',
    this.isCompound = false,
    this.isShipping = false,
    this.priority = 0,
    this.isActive = true,
  });

  final String storeId;
  final String name;
  final double rate;
  final String country;
  final String? state;
  final String? hsnCode;
  final String appliesTo;
  final bool isCompound;
  final bool isShipping;
  final int priority;
  final bool isActive;

  Map<String, dynamic> toJson({required bool includeStoreId}) {
    return {
      if (includeStoreId) 'store_id': storeId,
      'name': name.trim(),
      'rate': rate,
      'country': country.trim().isEmpty ? 'IN' : country.trim().toUpperCase(),
      if (!includeStoreId || state != null && state!.trim().isNotEmpty)
        'state': state == null || state!.trim().isEmpty ? null : state!.trim(),
      if (!includeStoreId || hsnCode != null && hsnCode!.trim().isNotEmpty)
        'hsn_code': hsnCode == null || hsnCode!.trim().isEmpty
            ? null
            : hsnCode!.trim(),
      'applies_to': appliesTo.trim().isEmpty ? 'all' : appliesTo.trim(),
      'is_compound': isCompound,
      'is_shipping': isShipping,
      'priority': priority,
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
