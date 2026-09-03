import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';

void main() {
  group('AppException', () {
    test('toString returns the message, not the default "Exception: ..." wrapper', () {
      final e = AppException('boom');
      expect(e.toString(), 'boom');
    });

    test('code is optional and defaults to null', () {
      final e = AppException('boom');
      expect(e.code, isNull);
    });
  });

  group('Auth exception subtypes assign a stable machine-readable code', () {
    test('UserNotFoundException', () {
      final e = UserNotFoundException('no such user');
      expect(e.code, 'USER_NOT_FOUND');
      expect(e, isA<AuthException>());
      expect(e, isA<AppException>());
      expect(e, isA<Exception>());
    });

    test('UnauthorizedException defaults its message when none is given', () {
      final e = UnauthorizedException();
      expect(e.message, 'Unauthorized');
      expect(e.code, 'UNAUTHORIZED');
    });

    test('UnauthorizedException still accepts a custom message', () {
      final e = UnauthorizedException('session expired');
      expect(e.message, 'session expired');
      expect(e.code, 'UNAUTHORIZED');
    });

    test('WeakPasswordException / EmailAlreadyExistsException / InvalidCredentialsException', () {
      expect(WeakPasswordException('x').code, 'WEAK_PASSWORD');
      expect(EmailAlreadyExistsException('x').code, 'EMAIL_EXISTS');
      expect(InvalidCredentialsException('x').code, 'INVALID_CREDENTIALS');
    });

    test('ValidationException is an AppException, not an AuthException', () {
      final e = ValidationException('bad field');
      expect(e.code, 'VALIDATION_ERROR');
      expect(e, isNot(isA<AuthException>()));
    });
  });

  group('Network/Database/Server exception hierarchies carry the right code', () {
    test('NetworkException', () {
      expect(NetworkException('x').code, 'NETWORK_ERROR');
    });

    test('DataNotFoundException is a DatabaseException with the parent code', () {
      final e = DataNotFoundException('missing row');
      expect(e, isA<DatabaseException>());
      expect(e.code, 'DATABASE_ERROR');
    });

    test('ServerException subtypes each carry their own specific code', () {
      expect(BadRequestException('x').code, 'BAD_REQUEST');
      expect(ForbiddenException('x').code, 'FORBIDDEN');
      expect(NotFoundException('x').code, 'NOT_FOUND');
      expect(InternalServerException('x').code, 'INTERNAL_SERVER_ERROR');
    });

    test('CacheException / StorageException', () {
      expect(CacheException('x').code, 'CACHE_ERROR');
      expect(StorageException('x').code, 'STORAGE_ERROR');
    });
  });

  group('Payment exceptions', () {
    test('PaymentException allows an explicit code override', () {
      final e = PaymentException('declined', code: 'CARD_DECLINED');
      expect(e.code, 'CARD_DECLINED');
    });

    test('PaymentCancelledException always uses the fixed cancellation code', () {
      final e = PaymentCancelledException('user cancelled');
      expect(e.code, 'PAYMENT_CANCELLED');
      expect(e, isA<PaymentException>());
    });
  });
}
