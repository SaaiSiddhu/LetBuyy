import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:quickcommerce_observability/quickcommerce_observability.dart';
import 'package:dio/dio.dart';

import 'api_environment.dart';

abstract interface class ApiAuthTokenProvider {
  Future<String?> accessToken();
}

final class EmptyApiAuthTokenProvider implements ApiAuthTokenProvider {
  const EmptyApiAuthTokenProvider();

  @override
  Future<String?> accessToken() async => null;
}

final class QuickcommerceApiClient {
  QuickcommerceApiClient({
    required ApiEnvironment environment,
    required ApiAuthTokenProvider authTokenProvider,
    required StructuredLogger logger,
    Dio? dio,
  })  : _authTokenProvider = authTokenProvider,
        _logger = logger,
        _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: environment.apiBaseUrl.toString(),
                connectTimeout: const Duration(seconds: 10),
                receiveTimeout: const Duration(seconds: 15),
                sendTimeout: const Duration(seconds: 15),
                responseType: ResponseType.json,
              ),
            ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _authTokenProvider.accessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  final Dio _dio;
  final ApiAuthTokenProvider _authTokenProvider;
  final StructuredLogger _logger;

  Future<Result<Map<String, Object?>, AppFailure>> getMap(
    String path, {
    required TraceContext trace,
    Map<String, Object?> queryParameters = const {},
  }) async {
    try {
      final response = await _dio.get<Object?>(
        path,
        queryParameters: queryParameters,
        options: Options(headers: trace.toHeaders()),
      );
      return _decodeResponse(response);
    } on DioException catch (error) {
      return Err(_mapDioError(error, trace));
    } catch (error) {
      return Err(UnknownFailure(cause: error));
    }
  }

  Future<Result<Map<String, Object?>, AppFailure>> postCommand(
    String path, {
    required TraceContext trace,
    required IdempotencyKey idempotencyKey,
    required Map<String, Object?> payload,
  }) async {
    try {
      final response = await _dio.post<Object?>(
        path,
        data: {
          'traceId': trace.traceId,
          'idempotencyKey': idempotencyKey.value,
          'payload': payload,
        },
        options: Options(
          headers: {
            ...trace.toHeaders(),
            'idempotency-key': idempotencyKey.value,
          },
        ),
      );
      return _decodeResponse(response);
    } on DioException catch (error) {
      return Err(_mapDioError(error, trace));
    } catch (error) {
      return Err(UnknownFailure(cause: error));
    }
  }

  Future<Result<Map<String, Object?>, AppFailure>> putCommand(
    String path, {
    required TraceContext trace,
    required IdempotencyKey idempotencyKey,
    required Map<String, Object?> payload,
  }) {
    return _sendCommand(
      method: 'PUT',
      path: path,
      trace: trace,
      idempotencyKey: idempotencyKey,
      payload: payload,
    );
  }

  Future<Result<Map<String, Object?>, AppFailure>> patchCommand(
    String path, {
    required TraceContext trace,
    required IdempotencyKey idempotencyKey,
    required Map<String, Object?> payload,
  }) {
    return _sendCommand(
      method: 'PATCH',
      path: path,
      trace: trace,
      idempotencyKey: idempotencyKey,
      payload: payload,
    );
  }

  Future<Result<Map<String, Object?>, AppFailure>> deleteCommand(
    String path, {
    required TraceContext trace,
    required IdempotencyKey idempotencyKey,
    Map<String, Object?> payload = const {},
  }) {
    return _sendCommand(
      method: 'DELETE',
      path: path,
      trace: trace,
      idempotencyKey: idempotencyKey,
      payload: payload,
    );
  }

  Future<Result<Map<String, Object?>, AppFailure>> _sendCommand({
    required String method,
    required String path,
    required TraceContext trace,
    required IdempotencyKey idempotencyKey,
    required Map<String, Object?> payload,
  }) async {
    try {
      final response = await _dio.request<Object?>(
        path,
        data: {
          'traceId': trace.traceId,
          'idempotencyKey': idempotencyKey.value,
          'payload': payload,
        },
        options: Options(
          method: method,
          headers: {
            ...trace.toHeaders(),
            'idempotency-key': idempotencyKey.value,
          },
        ),
      );
      return _decodeResponse(response);
    } on DioException catch (error) {
      return Err(_mapDioError(error, trace));
    } catch (error) {
      return Err(UnknownFailure(cause: error));
    }
  }

  Result<Map<String, Object?>, AppFailure> _decodeResponse(
    Response<Object?> response,
  ) {
    final body = _asMap(response.data);
    if (body == null) {
      return const Err(UnknownFailure(message: 'Invalid API response.'));
    }
    if (body['success'] == false) {
      final error = _asMap(body['error']) ?? const <String, Object?>{};
      return Err(failureFromApiError(error));
    }
    final data = _asMap(body['data']) ?? body;
    return Ok(data);
  }

  AppFailure _mapDioError(DioException error, TraceContext trace) {
    final responseData = _asMap(error.response?.data);
    final envelopeError = _asMap(responseData?['error']);
    if (envelopeError != null) {
      return failureFromApiError(envelopeError);
    }

    final statusCode = error.response?.statusCode;
    _logger.write(
      StructuredLogEvent(
        level: LogLevel.warning,
        message: 'api_request_failed',
        timestamp: DateTime.now(),
        traceId: trace.traceId,
        requestId: trace.requestId,
        fields: {
          'status_code': statusCode,
          'dio_type': error.type.name,
        },
      ),
    );

    if (statusCode == 401) {
      return const AuthFailure();
    }
    if (statusCode == 403) {
      return const PermissionFailure();
    }
    if (statusCode == 409) {
      return const ConflictFailure();
    }
    if (statusCode == 429) {
      return const RateLimitFailure();
    }
    if (error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return NetworkFailure(cause: error);
    }
    return UnknownFailure(cause: error);
  }
}

Map<String, Object?>? _asMap(Object? value) {
  if (value is Map<String, Object?>) {
    return value;
  }
  if (value is Map) {
    return value.cast<String, Object?>();
  }
  return null;
}
