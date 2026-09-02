import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:test/test.dart';

import 'fakes/fake_auth_repository.dart';

void main() {
  test('VerifyOtp use case returns an auth session through repository contract',
      () async {
    final useCase = VerifyOtp(FakeAuthRepository());
    final result = await useCase(
      VerifyOtpInput(
        phone: '+919999999999',
        otp: '123456',
        traceId: TraceId('trace-verify-1'),
      ),
    );

    expect(result.isOk, isTrue);
    expect(
        result.fold(
            ok: (session) => session.hasRole(UserRole.customer),
            err: (_) => false),
        isTrue);
  });
}
