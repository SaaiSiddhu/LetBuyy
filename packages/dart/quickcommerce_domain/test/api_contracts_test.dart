import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:test/test.dart';

void main() {
  test('command metadata serializes trace and idempotency values', () {
    final metadata = CommandMetadata(
      traceId: TraceId('trace-0001'),
      idempotencyKey: IdempotencyKey('idempotency-0001'),
    );

    expect(metadata.toJson(), {
      'traceId': 'trace-0001',
      'idempotencyKey': 'idempotency-0001',
    });
  });

  test('API error envelope maps back to typed failure', () {
    const envelope = ApiErrorEnvelope(
      code: ErrorCodes.paymentIntentFailed,
      message: 'Payment failed',
      retryable: true,
    );

    expect(envelope.toFailure(), isA<PaymentFailure>());
  });
}
