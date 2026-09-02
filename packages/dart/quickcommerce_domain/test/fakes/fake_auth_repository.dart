import 'package:quickcommerce_domain/quickcommerce_domain.dart';

final class FakeAuthRepository implements AuthRepository {
  FakeAuthRepository({AuthSession? session}) : _session = session;

  AuthSession? _session;

  @override
  Future<Result<void, AppFailure>> requestPhoneOtp({
    required String phone,
    required TraceId traceId,
  }) async {
    if (phone.trim().isEmpty) {
      return const Err(ValidationFailure(message: 'Phone is required.'));
    }
    return const Ok(null);
  }

  @override
  Future<Result<AuthSession, AppFailure>> signInWithPhoneOtp({
    required String phone,
    required String otp,
    required TraceId traceId,
  }) async {
    if (otp != '123456') {
      return const Err(
          AuthFailure(code: 'auth.invalid_otp', message: 'Invalid OTP.'));
    }
    _session = AuthSession(
      userId: EntityId('00000000-0000-4000-8000-000000000001'),
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: DateTime.now().add(const Duration(hours: 1)),
      roles: const [UserRole.customer],
    );
    return Ok(_session!);
  }

  @override
  Future<Result<AuthSession, AppFailure>> refreshSession() async {
    final session = _session;
    if (session == null) {
      return const Err(AuthFailure());
    }
    return Ok(session);
  }

  @override
  Future<Result<void, AppFailure>> signOut() async {
    _session = null;
    return const Ok(null);
  }

  @override
  Stream<AuthSession?> watchSession() async* {
    yield _session;
  }
}
