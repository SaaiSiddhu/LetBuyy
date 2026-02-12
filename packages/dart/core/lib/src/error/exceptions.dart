// Base Exception
class AppException implements Exception {
  final String message;
  final String? code;

  AppException(this.message, {this.code});

  @override
  String toString() => message;
}

// Auth Exceptions
class AuthException extends AppException {
  AuthException(super.message, {super.code});
}

class UserNotFoundException extends AuthException {
  UserNotFoundException(super.message) : super(code: 'USER_NOT_FOUND');
}

class UnauthorizedException extends AuthException {
  UnauthorizedException([super.message = 'Unauthorized']) : super(code: 'UNAUTHORIZED');
}

class WeakPasswordException extends AuthException {
  WeakPasswordException(super.message) : super(code: 'WEAK_PASSWORD');
}

class EmailAlreadyExistsException extends AuthException {
  EmailAlreadyExistsException(super.message) : super(code: 'EMAIL_EXISTS');
}

class InvalidCredentialsException extends AuthException {
  InvalidCredentialsException(super.message) : super(code: 'INVALID_CREDENTIALS');
}

class ValidationException extends AppException {
  ValidationException(super.message) : super(code: 'VALIDATION_ERROR');
}

// Network Exceptions
class NetworkException extends AppException {
  NetworkException(super.message) : super(code: 'NETWORK_ERROR');
}

// Database Exceptions
class DatabaseException extends AppException {
  DatabaseException(super.message) : super(code: 'DATABASE_ERROR');
}

class DataNotFoundException extends DatabaseException {
  DataNotFoundException(super.message);
}

// Server Exceptions
class ServerException extends AppException {
  ServerException(super.message, {super.code});
}

class BadRequestException extends ServerException {
  BadRequestException(super.message) : super(code: 'BAD_REQUEST');
}

class ForbiddenException extends ServerException {
  ForbiddenException(super.message) : super(code: 'FORBIDDEN');
}

class NotFoundException extends ServerException {
  NotFoundException(super.message) : super(code: 'NOT_FOUND');
}

class InternalServerException extends ServerException {
  InternalServerException(super.message) : super(code: 'INTERNAL_SERVER_ERROR');
}

// Cache Exception
class CacheException extends AppException {
  CacheException(super.message) : super(code: 'CACHE_ERROR');
}

// Storage Exception
class StorageException extends AppException {
  StorageException(super.message) : super(code: 'STORAGE_ERROR');
}

// Payment Exceptions
class PaymentException extends AppException {
  PaymentException(super.message, {super.code});
}

class PaymentCancelledException extends PaymentException {
  PaymentCancelledException(super.message) : super(code: 'PAYMENT_CANCELLED');
}
