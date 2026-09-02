import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:test/test.dart';

void main() {
  test('order state machine allows normal fulfillment path', () {
    expect(
        OrderStateMachine.canTransition(
            OrderStatus.confirmed, OrderStatus.picking),
        isTrue);
    expect(
        OrderStateMachine.canTransition(
            OrderStatus.readyForPickup, OrderStatus.riderAssigned),
        isTrue);
    expect(
        OrderStateMachine.canTransition(
            OrderStatus.arriving, OrderStatus.delivered),
        isTrue);
  });

  test('order state machine rejects invalid reverse transition', () {
    final result =
        OrderStateMachine.validate(OrderStatus.delivered, OrderStatus.picking);
    expect(result.isErr, isTrue);
  });

  test('delivery state machine rejects stale transition', () {
    expect(
      DeliveryStateMachine.canTransition(
          DeliveryStatus.delivered, DeliveryStatus.arrivingAtCustomer),
      isFalse,
    );
  });

  test('rider state machine prevents blocked rider from becoming available',
      () {
    final result =
        RiderStateMachine.validate(RiderStatus.blocked, RiderStatus.available);
    expect(result.isErr, isTrue);
  });
}
