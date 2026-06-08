import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/merchant_contracts.dart' hide JsonMap;

void main() {
  test('merchant telemetry event serializes sanitized metadata', () {
    final event = MerchantTelemetryEvent(
      id: 'event_1',
      name: MerchantTelemetryEventNames.screenViewed,
      occurredAt: DateTime.utc(2026, 6, 8, 12),
      storeId: 'store_1',
      route: '/products',
      metadata: {
        'product_id': 'prod_1',
        'authorization': 'Bearer secret',
        'long': List.filled(220, 'x').join(),
      },
    );

    final json = event.toJson();
    final parsed = MerchantTelemetryEvent.fromJson(json);

    expect(parsed.name, MerchantTelemetryEventNames.screenViewed);
    expect(parsed.storeId, 'store_1');
    expect(parsed.route, '/products');
    expect(parsed.metadata['product_id'], 'prod_1');
    expect(parsed.metadata.containsKey('authorization'), isFalse);
    expect((parsed.metadata['long'] as String).length, 180);
  });
}
