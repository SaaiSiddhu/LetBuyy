final class ErrorCodes {
  const ErrorCodes._();

  static const authUnauthenticated = 'auth.unauthenticated';
  static const authPermissionDenied = 'auth.permission_denied';
  static const requestValidationFailed = 'request.validation_failed';
  static const requestConflict = 'request.conflict';
  static const checkoutQuoteExpired = 'checkout.quote_expired';
  static const checkoutPriceChanged = 'checkout.price_changed';
  static const inventoryOutOfStock = 'inventory.out_of_stock';
  static const inventoryReservationConflict = 'inventory.reservation_conflict';
  static const paymentIntentFailed = 'payment.intent_failed';
  static const paymentWebhookPending = 'payment.webhook_pending';
  static const deliveryAssignmentExpired = 'delivery.assignment_expired';
  static const deliveryInvalidTransition = 'delivery.invalid_transition';
  static const rateLimitExceeded = 'rate.limit_exceeded';
  static const networkUnavailable = 'network.unavailable';
  static const offlineUnavailable = 'offline.unavailable';
  static const unknown = 'internal.unknown';
}

sealed class AppFailure {
  const AppFailure({
    required this.code,
    required this.message,
    this.retryable = false,
    this.details = const {},
    this.cause,
  });

  final String code;
  final String message;
  final bool retryable;
  final Map<String, Object?> details;
  final Object? cause;

  Map<String, Object?> toJson() => {
        'code': code,
        'message': message,
        'retryable': retryable,
        'details': details,
      };
}

final class NetworkFailure extends AppFailure {
  const NetworkFailure({
    super.code = ErrorCodes.networkUnavailable,
    super.message = 'Network unavailable.',
    super.retryable = true,
    super.details,
    super.cause,
  });
}

final class AuthFailure extends AppFailure {
  const AuthFailure({
    super.code = ErrorCodes.authUnauthenticated,
    super.message = 'Authentication required.',
    super.retryable,
    super.details,
    super.cause,
  });
}

final class PermissionFailure extends AppFailure {
  const PermissionFailure({
    super.code = ErrorCodes.authPermissionDenied,
    super.message = 'Permission denied.',
    super.retryable,
    super.details,
    super.cause,
  });
}

final class ValidationFailure extends AppFailure {
  const ValidationFailure({
    super.code = ErrorCodes.requestValidationFailed,
    super.message = 'Validation failed.',
    super.retryable,
    super.details,
    super.cause,
  });
}

final class ConflictFailure extends AppFailure {
  const ConflictFailure({
    super.code = ErrorCodes.requestConflict,
    super.message = 'Conflict detected.',
    super.retryable = true,
    super.details,
    super.cause,
  });
}

final class InventoryFailure extends AppFailure {
  const InventoryFailure({
    super.code = ErrorCodes.inventoryOutOfStock,
    super.message = 'Inventory unavailable.',
    super.retryable,
    super.details,
    super.cause,
  });
}

final class PaymentFailure extends AppFailure {
  const PaymentFailure({
    super.code = ErrorCodes.paymentIntentFailed,
    super.message = 'Payment failed.',
    super.retryable = true,
    super.details,
    super.cause,
  });
}

final class DeliveryFailure extends AppFailure {
  const DeliveryFailure({
    super.code = ErrorCodes.deliveryInvalidTransition,
    super.message = 'Delivery command failed.',
    super.retryable,
    super.details,
    super.cause,
  });
}

final class RateLimitFailure extends AppFailure {
  const RateLimitFailure({
    super.code = ErrorCodes.rateLimitExceeded,
    super.message = 'Rate limit exceeded.',
    super.retryable = true,
    super.details,
    super.cause,
  });
}

final class OfflineFailure extends AppFailure {
  const OfflineFailure({
    super.code = ErrorCodes.offlineUnavailable,
    super.message = 'Offline operation unavailable.',
    super.retryable = true,
    super.details,
    super.cause,
  });
}

final class UnknownFailure extends AppFailure {
  const UnknownFailure({
    super.code = ErrorCodes.unknown,
    super.message = 'Unexpected failure.',
    super.retryable,
    super.details,
    super.cause,
  });
}

AppFailure failureFromApiError(Map<String, Object?> error) {
  final code = error['code'] as String? ?? ErrorCodes.unknown;
  final message = error['message'] as String? ?? 'Unexpected failure.';
  final retryable = error['retryable'] as bool? ?? false;
  final details = (error['details'] as Map?)?.cast<String, Object?>() ??
      const <String, Object?>{};

  if (code.startsWith('auth.permission')) {
    return PermissionFailure(
        code: code, message: message, retryable: retryable, details: details);
  }
  if (code.startsWith('auth.')) {
    return AuthFailure(
        code: code, message: message, retryable: retryable, details: details);
  }
  if (code.startsWith('inventory.')) {
    return InventoryFailure(
        code: code, message: message, retryable: retryable, details: details);
  }
  if (code.startsWith('payment.')) {
    return PaymentFailure(
        code: code, message: message, retryable: retryable, details: details);
  }
  if (code.startsWith('delivery.')) {
    return DeliveryFailure(
        code: code, message: message, retryable: retryable, details: details);
  }
  if (code.startsWith('rate.')) {
    return RateLimitFailure(
        code: code, message: message, retryable: retryable, details: details);
  }
  if (code.contains('conflict')) {
    return ConflictFailure(
        code: code, message: message, retryable: retryable, details: details);
  }
  if (code.startsWith('request.')) {
    return ValidationFailure(
        code: code, message: message, retryable: retryable, details: details);
  }
  return UnknownFailure(
      code: code, message: message, retryable: retryable, details: details);
}
