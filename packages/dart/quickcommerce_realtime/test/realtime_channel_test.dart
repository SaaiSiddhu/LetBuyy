import 'package:quickcommerce_realtime/quickcommerce_realtime.dart';
import 'package:test/test.dart';

void main() {
  test('channel builders preserve runtime authorization namespaces', () {
    expect(
      RealtimeChannels.userOrders('user-1').name,
      'user.orders.user-1',
    );
    expect(
      RealtimeChannels.deliveryLive('delivery-1').scope,
      RealtimeChannelScope.delivery,
    );
  });
}
