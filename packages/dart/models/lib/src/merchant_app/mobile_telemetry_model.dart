typedef TelemetryMetadata = Map<String, Object?>;

class MerchantTelemetryEventNames {
  const MerchantTelemetryEventNames._();

  static const appOpened = 'app.opened';
  static const authSignedIn = 'auth.signed_in';
  static const authSessionRestored = 'auth.session_restored';
  static const authSignedOut = 'auth.signed_out';
  static const storeSelected = 'store.selected';
  static const screenViewed = 'screen.viewed';
  static const actionTriggered = 'action.triggered';

  static const coreEvents = <String>{
    appOpened,
    authSignedIn,
    authSessionRestored,
    authSignedOut,
    storeSelected,
    screenViewed,
    actionTriggered,
  };
}

class MerchantTelemetryEvent {
  MerchantTelemetryEvent({
    required this.id,
    required this.name,
    required this.occurredAt,
    this.storeId,
    this.userId,
    this.route,
    this.source = 'merchant_mobile',
    TelemetryMetadata metadata = const {},
  }) : metadata = sanitizeTelemetryMetadata(metadata);

  final String id;
  final String name;
  final DateTime occurredAt;
  final String? storeId;
  final String? userId;
  final String? route;
  final String source;
  final TelemetryMetadata metadata;

  Map<String, Object?> toJson() => {
    'id': id,
    'name': name,
    'occurred_at': occurredAt.toUtc().toIso8601String(),
    'store_id': storeId,
    'user_id': userId,
    'route': route,
    'source': source,
    'metadata': metadata,
  };

  factory MerchantTelemetryEvent.fromJson(Map<String, dynamic> json) {
    return MerchantTelemetryEvent(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      occurredAt:
          DateTime.tryParse(json['occurred_at']?.toString() ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      storeId: _optionalString(json['store_id']),
      userId: _optionalString(json['user_id']),
      route: _optionalString(json['route']),
      source: json['source']?.toString() ?? 'merchant_mobile',
      metadata: sanitizeTelemetryMetadata(
        Map<String, Object?>.from(json['metadata'] as Map? ?? const {}),
      ),
    );
  }
}

TelemetryMetadata sanitizeTelemetryMetadata(
  TelemetryMetadata input, {
  int maxKeys = 24,
  int maxStringLength = 180,
}) {
  final output = <String, Object?>{};
  for (final entry in input.entries) {
    if (output.length >= maxKeys) break;
    final key = _sanitizeMetadataKey(entry.key);
    if (key == null || _isSecretLikeKey(key)) continue;
    final value = _sanitizeMetadataValue(entry.value, maxStringLength);
    if (value != null) output[key] = value;
  }
  return Map<String, Object?>.unmodifiable(output);
}

String? _sanitizeMetadataKey(String key) {
  final normalized = key.trim().replaceAll(RegExp(r'[^A-Za-z0-9_.-]'), '_');
  if (normalized.isEmpty || normalized.length > 80) return null;
  return normalized;
}

bool _isSecretLikeKey(String key) {
  return RegExp(
    r'(token|secret|password|cookie|authorization|otp|csrf|private|session)',
    caseSensitive: false,
  ).hasMatch(key);
}

Object? _sanitizeMetadataValue(Object? value, int maxStringLength) {
  if (value == null || value is bool || value is num) return value;
  if (value is DateTime) return value.toUtc().toIso8601String();
  if (value is String) {
    final trimmed = value.trim();
    return trimmed.length <= maxStringLength
        ? trimmed
        : trimmed.substring(0, maxStringLength);
  }
  return value.toString().substring(
    0,
    value.toString().length.clamp(0, maxStringLength),
  );
}

String? _optionalString(Object? value) {
  final string = value?.toString();
  return string == null || string.isEmpty ? null : string;
}
