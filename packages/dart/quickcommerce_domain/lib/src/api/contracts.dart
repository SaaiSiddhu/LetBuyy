import '../common/failures.dart';
import '../common/value_objects.dart';

final class CommandMetadata {
  const CommandMetadata({
    required this.traceId,
    required this.idempotencyKey,
  });

  final TraceId traceId;
  final IdempotencyKey idempotencyKey;

  Map<String, Object?> toJson() => {
        'traceId': traceId.value,
        'idempotencyKey': idempotencyKey.value,
      };
}

final class RequestEnvelope<T> {
  const RequestEnvelope({
    required this.traceId,
    required this.payload,
    this.idempotencyKey,
  });

  final TraceId traceId;
  final IdempotencyKey? idempotencyKey;
  final T payload;
}

final class ApiErrorEnvelope {
  const ApiErrorEnvelope({
    required this.code,
    required this.message,
    required this.retryable,
    this.details = const {},
  });

  final String code;
  final String message;
  final bool retryable;
  final Map<String, Object?> details;

  AppFailure toFailure() => failureFromApiError(toJson());

  Map<String, Object?> toJson() => {
        'code': code,
        'message': message,
        'retryable': retryable,
        'details': details,
      };
}

sealed class ApiResponse<T> {
  const ApiResponse({required this.traceId});

  final TraceId traceId;
}

final class ApiSuccess<T> extends ApiResponse<T> {
  const ApiSuccess({
    required super.traceId,
    required this.data,
  });

  final T data;
}

final class ApiFailure<T> extends ApiResponse<T> {
  const ApiFailure({
    required super.traceId,
    required this.error,
  });

  final ApiErrorEnvelope error;
}
