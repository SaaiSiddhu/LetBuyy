import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';

void main() {
  group('Failure equality (via Equatable)', () {
    test('two failures with the same message and code are equal', () {
      expect(NetworkFailure('timed out'), NetworkFailure('timed out'));
    });

    test('two failures with different messages are NOT equal', () {
      expect(
        NetworkFailure('timed out'),
        isNot(equals(NetworkFailure('connection refused'))),
      );
    });

    test('different Failure subtypes carrying the same message are not equal', () {
      // Equatable compares props (message, code); NetworkFailure and
      // CacheFailure default to different codes even with the same message,
      // and Equatable's default equality also checks runtimeType.
      expect(
        NetworkFailure('boom'),
        isNot(equals(CacheFailure('boom'))),
      );
    });
  });

  group('Default messages and codes', () {
    test('NetworkFailure default message and fixed code', () {
      const f = NetworkFailure();
      expect(f.message, 'Network failure');
      expect(f.code, 'NETWORK_FAILURE');
    });

    test('NoInternetFailure default message and fixed code', () {
      const f = NoInternetFailure();
      expect(f.message, 'No internet connection');
      expect(f.code, 'NO_INTERNET');
    });

    test('CacheFailure / ServerFailure / UnknownFailure defaults', () {
      expect(const CacheFailure().message, 'Cache failure');
      expect(const ServerFailure().message, 'Server failure');
      expect(const UnknownFailure().message, 'Unknown error occurred');
    });
  });

  group('Failures with an overridable code default', () {
    test('AuthFailure falls back to AUTH_FAILURE when no code is given', () {
      const f = AuthFailure('bad token');
      expect(f.code, 'AUTH_FAILURE');
    });

    test('AuthFailure accepts an explicit code override', () {
      const f = AuthFailure('bad token', code: 'TOKEN_EXPIRED');
      expect(f.code, 'TOKEN_EXPIRED');
    });

    test('InvalidCredentialsFailure always uses its fixed code, ignoring the default fallback', () {
      const f = InvalidCredentialsFailure();
      expect(f.message, 'Invalid credentials');
      expect(f.code, 'INVALID_CREDENTIALS');
    });

    test('DatabaseFailure / StorageFailure / PaymentFailure default-code fallback', () {
      expect(const DatabaseFailure('x').code, 'DATABASE_FAILURE');
      expect(const StorageFailure('x').code, 'STORAGE_FAILURE');
      expect(const PaymentFailure('x').code, 'PAYMENT_FAILURE');
    });

    test('DatabaseFailure / StorageFailure / PaymentFailure accept an override', () {
      expect(
        const DatabaseFailure('x', code: 'ROW_LOCKED').code,
        'ROW_LOCKED',
      );
    });
  });

  group('ValidationFailure', () {
    test('always uses the fixed VALIDATION_FAILURE code', () {
      const f = ValidationFailure('field is required');
      expect(f.code, 'VALIDATION_FAILURE');
      expect(f.message, 'field is required');
    });
  });
}
