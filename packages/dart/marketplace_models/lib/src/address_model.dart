// C3 (Firebase SDK removal, 27 September 2026 review continuation): fromMap/fromFirestore/fromJson/
// toMap/toJson (and the Timestamp-parsing _parseDateTime they existed for) deleted outright, not
// just de-Firebased -- grepping every real (non-comment) caller anywhere in the app found none.
// This is purely a display-adapter value type now: every real address flow constructs it directly
// via the plain constructor below, converting from BuyerAddressApi's own canonical BuyerAddress
// (see checkout_screen.dart's/add_address_screen.dart's/address_selection_sheet.dart's own
// _toAddressModel/_addressModelFromBuyerAddress helpers) -- never serialized to/from a map.
class AddressModel {
  final String id;
  final String userId;
  final String name;
  final String phone;
  final String addressLine1;
  final String addressLine2;
  final String city;
  final String state;
  final String zipcode;
  final String country;
  final double? latitude;
  final double? longitude;
  final bool isDefault;
  final String? addressType; // home, work, other
  final String? landmark;
  final DateTime createdAt;

  AddressModel({
    required this.id,
    required this.userId,
    required this.name,
    required this.phone,
    required this.addressLine1,
    required this.addressLine2,
    required this.city,
    required this.state,
    required this.zipcode,
    this.country = 'India',
    this.latitude,
    this.longitude,
    this.isDefault = false,
    this.addressType,
    this.landmark,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  String get fullAddress {
    final parts = [
      addressLine1,
      if (addressLine2.isNotEmpty) addressLine2,
      if (landmark != null && landmark!.isNotEmpty) 'Near $landmark',
      city,
      state,
      zipcode,
      country,
    ];
    return parts.where((part) => part.isNotEmpty).join(', ');
  }

  String get shortAddress => '$addressLine1, $city';

  String get zipCode => zipcode; // ✅ Support both zipCode and zipcode

  AddressModel copyWith({
    String? id,
    String? userId,
    String? name,
    String? phone,
    String? addressLine1,
    String? addressLine2,
    String? city,
    String? state,
    String? zipcode,
    String? country,
    double? latitude,
    double? longitude,
    bool? isDefault,
    String? addressType,
    String? landmark,
    DateTime? createdAt,
  }) {
    return AddressModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      addressLine1: addressLine1 ?? this.addressLine1,
      addressLine2: addressLine2 ?? this.addressLine2,
      city: city ?? this.city,
      state: state ?? this.state,
      zipcode: zipcode ?? this.zipcode,
      country: country ?? this.country,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      isDefault: isDefault ?? this.isDefault,
      addressType: addressType ?? this.addressType,
      landmark: landmark ?? this.landmark,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AddressModel &&
          runtimeType == other.runtimeType &&
          id == other.id &&
          userId == other.userId;

  @override
  int get hashCode => id.hashCode ^ userId.hashCode;

  @override
  String toString() =>
      'AddressModel(id: $id, name: $name, city: $city, addressLine1: $addressLine1)';
}
