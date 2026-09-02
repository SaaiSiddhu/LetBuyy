import 'package:quickcommerce_api/quickcommerce_api.dart';
import 'package:test/test.dart';

void main() {
  test('request metadata includes trace and idempotency headers', () {
    const metadata = RequestMetadata(
      traceId: 'trace-123456',
      idempotencyKey: 'cart-123456789',
      deviceId: 'device-a',
      appVersion: '1.0.0',
      platform: 'ios',
    );

    expect(metadata.toHeaders()['x-trace-id'], 'trace-123456');
    expect(metadata.toHeaders()['x-idempotency-key'], 'cart-123456789');
    expect(metadata.toHeaders()['x-device-id'], 'device-a');
  });
}
