import 'dart:math' as math;

final class EntityId {
  EntityId(String value) : value = _validate(value, 'entity_id');

  final String value;

  static final _uuid = RegExp(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
  );

  static String _validate(String value, String fieldName) {
    final trimmed = value.trim();
    if (!_uuid.hasMatch(trimmed)) {
      throw ArgumentError.value(value, fieldName, 'must be a canonical UUID');
    }
    return trimmed.toLowerCase();
  }

  Map<String, Object?> toJson() => {'value': value};

  @override
  bool operator ==(Object other) => other is EntityId && other.value == value;

  @override
  int get hashCode => value.hashCode;

  @override
  String toString() => value;
}

final class IdempotencyKey {
  IdempotencyKey(String value) : value = _validate(value);

  final String value;

  static String _validate(String value) {
    final trimmed = value.trim();
    if (trimmed.length < 12 || trimmed.length > 160) {
      throw ArgumentError.value(
        value,
        'idempotencyKey',
        'must be 12 to 160 characters',
      );
    }
    return trimmed;
  }

  Map<String, Object?> toJson() => {'value': value};

  @override
  bool operator ==(Object other) =>
      other is IdempotencyKey && other.value == value;

  @override
  int get hashCode => value.hashCode;
}

final class TraceId {
  TraceId(String value) : value = _validate(value);

  final String value;

  static String _validate(String value) {
    final trimmed = value.trim();
    if (trimmed.length < 8 || trimmed.length > 128) {
      throw ArgumentError.value(
        value,
        'traceId',
        'must be 8 to 128 characters',
      );
    }
    return trimmed;
  }

  Map<String, Object?> toJson() => {'value': value};

  @override
  bool operator ==(Object other) => other is TraceId && other.value == value;

  @override
  int get hashCode => value.hashCode;
}

final class Money implements Comparable<Money> {
  const Money({required this.paise, this.currency = 'INR'});

  factory Money.zero([String currency = 'INR']) =>
      Money(paise: 0, currency: currency);

  factory Money.nonNegative({required int paise, String currency = 'INR'}) {
    if (paise < 0) {
      throw ArgumentError.value(paise, 'paise', 'must be non-negative');
    }
    return Money(paise: paise, currency: currency);
  }

  final int paise;
  final String currency;

  Money operator +(Money other) {
    _assertSameCurrency(other);
    return Money(paise: paise + other.paise, currency: currency);
  }

  Money operator -(Money other) {
    _assertSameCurrency(other);
    return Money(paise: paise - other.paise, currency: currency);
  }

  Money multiplyByQuantity(int quantity) {
    if (quantity < 0) {
      throw ArgumentError.value(quantity, 'quantity', 'must be non-negative');
    }
    return Money(paise: paise * quantity, currency: currency);
  }

  bool get isNegative => paise < 0;
  bool get isZero => paise == 0;
  bool get isPositive => paise > 0;

  void _assertSameCurrency(Money other) {
    if (currency != other.currency) {
      throw StateError('Currency mismatch: $currency != ${other.currency}');
    }
  }

  Map<String, Object?> toJson() => {'paise': paise, 'currency': currency};

  @override
  int compareTo(Money other) {
    _assertSameCurrency(other);
    return paise.compareTo(other.paise);
  }

  @override
  bool operator ==(Object other) {
    return other is Money && other.paise == paise && other.currency == currency;
  }

  @override
  int get hashCode => Object.hash(paise, currency);

  @override
  String toString() {
    final absolutePaise = paise.abs();
    final rupees = absolutePaise ~/ 100;
    final remainder = (absolutePaise % 100).toString().padLeft(2, '0');
    final sign = paise < 0 ? '-' : '';
    return '$sign$currency $rupees.$remainder';
  }
}

final class GeoPoint {
  GeoPoint({required double latitude, required double longitude})
    : latitude = _validateLatitude(latitude),
      longitude = _validateLongitude(longitude);

  final double latitude;
  final double longitude;

  static double _validateLatitude(double value) {
    if (value < -90 || value > 90 || value.isNaN) {
      throw ArgumentError.value(
        value,
        'latitude',
        'must be between -90 and 90',
      );
    }
    return value;
  }

  static double _validateLongitude(double value) {
    if (value < -180 || value > 180 || value.isNaN) {
      throw ArgumentError.value(
        value,
        'longitude',
        'must be between -180 and 180',
      );
    }
    return value;
  }

  double distanceToMeters(GeoPoint other) {
    const earthRadiusMeters = 6371000.0;
    final dLat = _degreesToRadians(other.latitude - latitude);
    final dLng = _degreesToRadians(other.longitude - longitude);
    final lat1 = _degreesToRadians(latitude);
    final lat2 = _degreesToRadians(other.latitude);
    final a =
        math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1) *
            math.cos(lat2) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return earthRadiusMeters * c;
  }

  static double _degreesToRadians(double degrees) => degrees * math.pi / 180;

  Map<String, Object?> toJson() => {
    'latitude': latitude,
    'longitude': longitude,
  };

  @override
  bool operator ==(Object other) {
    return other is GeoPoint &&
        other.latitude == latitude &&
        other.longitude == longitude;
  }

  @override
  int get hashCode => Object.hash(latitude, longitude);
}

final class DateRange {
  DateRange({required this.startsAt, required this.endsAt}) {
    if (!endsAt.isAfter(startsAt)) {
      throw ArgumentError.value(endsAt, 'endsAt', 'must be after startsAt');
    }
  }

  final DateTime startsAt;
  final DateTime endsAt;

  bool contains(DateTime value) {
    return !value.isBefore(startsAt) && value.isBefore(endsAt);
  }

  Map<String, Object?> toJson() => {
    'startsAt': startsAt.toIso8601String(),
    'endsAt': endsAt.toIso8601String(),
  };

  @override
  bool operator ==(Object other) {
    return other is DateRange &&
        other.startsAt == startsAt &&
        other.endsAt == endsAt;
  }

  @override
  int get hashCode => Object.hash(startsAt, endsAt);
}
