import 'package:equatable/equatable.dart';

// Base failure class
abstract class Failure extends Equatable {
  final String message;
  final String? code;
  
  const Failure(this.message, {this.code});
  
  @override
  List<Object?> get props => [message, code];
}

// Network failures
class NetworkFailure extends Failure {
  const NetworkFailure([super.message = 'Network failure'])
      : super(code: 'NETWORK_FAILURE');
}

class NoInternetFailure extends Failure {
  const NoInternetFailure([super.message = 'No internet connection'])
      : super(code: 'NO_INTERNET');
}

// Authentication failures
class AuthFailure extends Failure {
  const AuthFailure(super.message, {String? code})
      : super(code: code ?? 'AUTH_FAILURE');
}

class InvalidCredentialsFailure extends AuthFailure {
  const InvalidCredentialsFailure([super.message = 'Invalid credentials'])
      : super(code: 'INVALID_CREDENTIALS');
}

// Database failures
class DatabaseFailure extends Failure {
  const DatabaseFailure(super.message, {String? code})
      : super(code: code ?? 'DATABASE_FAILURE');
}

// Storage failures
class StorageFailure extends Failure {
  const StorageFailure(super.message, {String? code})
      : super(code: code ?? 'STORAGE_FAILURE');
}

// Payment failures
class PaymentFailure extends Failure {
  const PaymentFailure(super.message, {String? code})
      : super(code: code ?? 'PAYMENT_FAILURE');
}

// Validation failures
class ValidationFailure extends Failure {
  const ValidationFailure(super.message)
      : super(code: 'VALIDATION_FAILURE');
}

// Cache failures
class CacheFailure extends Failure {
  const CacheFailure([super.message = 'Cache failure'])
      : super(code: 'CACHE_FAILURE');
}

// Server failures
class ServerFailure extends Failure {
  const ServerFailure([super.message = 'Server failure'])
      : super(code: 'SERVER_FAILURE');
}

// Unknown failures
class UnknownFailure extends Failure {
  const UnknownFailure([super.message = 'Unknown error occurred'])
      : super(code: 'UNKNOWN_FAILURE');
}
