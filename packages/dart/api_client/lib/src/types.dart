import 'dart:async';

typedef JsonMap = Map<String, dynamic>;
typedef JsonList = List<dynamic>;
typedef QueryParams = Map<String, Object?>;
typedef JsonDecoder<T> = T Function(Object? value);
typedef ApiTokenProvider = FutureOr<String?> Function();
typedef ApiStoreIdProvider = FutureOr<String?> Function();
typedef RequestIdFactory = String Function();
typedef ApiUnauthorizedHandler = FutureOr<bool> Function(
  ApiException exception,
);

enum HttpMethod {
  get('GET'),
  post('POST'),
  put('PUT'),
  patch('PATCH'),
  delete('DELETE');

  const HttpMethod(this.value);

  final String value;
}

class ApiRequestOptions {
  const ApiRequestOptions({
    this.method,
    this.query,
    this.body,
    this.headers,
    this.token,
    this.storeId,
    this.idempotencyKey,
    this.versioned = true,
    this.retryUnsafe = false,
    this.maxRetries,
    this.expectedContextVersion,
  });

  final HttpMethod? method;
  final QueryParams? query;
  final Object? body;
  final Map<String, String>? headers;
  final String? token;
  final String? storeId;
  final String? idempotencyKey;
  final bool versioned;
  final bool retryUnsafe;
  final int? maxRetries;

  /// Freeze the account/store context captured before awaiting local work.
  final Object? expectedContextVersion;

  ApiRequestOptions copyWith({
    HttpMethod? method,
    QueryParams? query,
    Object? body,
    Map<String, String>? headers,
    String? token,
    String? storeId,
    String? idempotencyKey,
    bool? versioned,
    bool? retryUnsafe,
    int? maxRetries,
    Object? expectedContextVersion,
  }) {
    return ApiRequestOptions(
      method: method ?? this.method,
      query: query ?? this.query,
      body: body ?? this.body,
      headers: headers ?? this.headers,
      token: token ?? this.token,
      storeId: storeId ?? this.storeId,
      idempotencyKey: idempotencyKey ?? this.idempotencyKey,
      versioned: versioned ?? this.versioned,
      retryUnsafe: retryUnsafe ?? this.retryUnsafe,
      maxRetries: maxRetries ?? this.maxRetries,
      expectedContextVersion:
          expectedContextVersion ?? this.expectedContextVersion,
    );
  }
}

class PaginatedResponse<T> {
  const PaginatedResponse({
    required this.data,
    required this.total,
    required this.page,
    required this.limit,
    required this.hasMore,
    this.totalPages,
    this.hasNext,
    this.hasPrev,
    this.nextCursor,
    this.meta = const {},
  });

  final List<T> data;
  final int total;
  final int page;
  final int limit;
  final bool hasMore;
  final int? totalPages;
  final bool? hasNext;
  final bool? hasPrev;
  final String? nextCursor;
  final JsonMap meta;
}

class HealthResponse {
  const HealthResponse({
    required this.status,
    required this.timestamp,
    required this.environment,
    required this.version,
  });

  final String status;
  final String timestamp;
  final String environment;
  final String version;

  factory HealthResponse.fromJson(Object? value) {
    final json = asJsonMap(value);
    return HealthResponse(
      status: stringValue(json['status']),
      timestamp: stringValue(json['timestamp']),
      environment: stringValue(json['environment']),
      version: stringValue(json['version']),
    );
  }
}

class ApiException implements Exception {
  const ApiException({
    required this.message,
    required this.statusCode,
    required this.code,
    this.requestId,
    this.body,
  });

  final String message;
  final int statusCode;
  final String code;
  final String? requestId;
  final Object? body;

  @override
  String toString() => message;
}

JsonMap asJsonMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, item) => MapEntry(key.toString(), item));
  }
  throw ApiException(
    message: 'Expected a JSON object response.',
    statusCode: 200,
    code: 'INVALID_RESPONSE',
    body: value,
  );
}

List<Object?> asJsonList(Object? value) {
  if (value is List) return value;
  throw ApiException(
    message: 'Expected a JSON array response.',
    statusCode: 200,
    code: 'INVALID_RESPONSE',
    body: value,
  );
}

String stringValue(Object? value, {String fallback = ''}) {
  return value is String ? value : fallback;
}

int intValue(Object? value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

bool boolValue(Object? value, {bool fallback = false}) {
  return value is bool ? value : fallback;
}
