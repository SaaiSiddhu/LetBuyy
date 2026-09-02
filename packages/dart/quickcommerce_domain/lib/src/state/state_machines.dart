import '../common/failures.dart';
import '../common/result.dart';
import '../entities/entities.dart';

final class OrderStateMachine {
  const OrderStateMachine._();

  static const Map<OrderStatus, Set<OrderStatus>> _allowed = {
    OrderStatus.draft: {OrderStatus.quoteCreated, OrderStatus.cancelled},
    OrderStatus.quoteCreated: {
      OrderStatus.paymentPending,
      OrderStatus.cancelled
    },
    OrderStatus.paymentPending: {
      OrderStatus.confirmed,
      OrderStatus.cancelled,
      OrderStatus.failed
    },
    OrderStatus.confirmed: {OrderStatus.picking, OrderStatus.cancelled},
    OrderStatus.picking: {
      OrderStatus.packing,
      OrderStatus.cancelled,
      OrderStatus.failed
    },
    OrderStatus.packing: {
      OrderStatus.readyForPickup,
      OrderStatus.cancelled,
      OrderStatus.failed
    },
    OrderStatus.readyForPickup: {
      OrderStatus.riderAssigned,
      OrderStatus.cancelled
    },
    OrderStatus.riderAssigned: {
      OrderStatus.pickedUp,
      OrderStatus.cancelled,
      OrderStatus.failed
    },
    OrderStatus.pickedUp: {OrderStatus.arriving, OrderStatus.failed},
    OrderStatus.arriving: {OrderStatus.delivered, OrderStatus.failed},
    OrderStatus.delivered: {OrderStatus.returned},
    OrderStatus.cancelled: {OrderStatus.refunded},
    OrderStatus.failed: {OrderStatus.returned, OrderStatus.refunded},
    OrderStatus.returned: {OrderStatus.refunded},
    OrderStatus.refunded: {},
  };

  static bool canTransition(OrderStatus from, OrderStatus to) {
    return from == to || (_allowed[from]?.contains(to) ?? false);
  }

  static Result<void, AppFailure> validate(OrderStatus from, OrderStatus to) {
    if (canTransition(from, to)) {
      return const Ok(null);
    }
    return Err(
      ConflictFailure(
        code: 'order.invalid_transition',
        message:
            'Invalid order transition: ${from.toJson()} -> ${to.toJson()}.',
        details: {'from': from.toJson(), 'to': to.toJson()},
      ),
    );
  }
}

final class DeliveryStateMachine {
  const DeliveryStateMachine._();

  static const Map<DeliveryStatus, Set<DeliveryStatus>> _allowed = {
    DeliveryStatus.pendingAssignment: {DeliveryStatus.assigned},
    DeliveryStatus.assigned: {DeliveryStatus.accepted, DeliveryStatus.rejected},
    DeliveryStatus.accepted: {DeliveryStatus.arrivingAtStore},
    DeliveryStatus.rejected: {DeliveryStatus.assigned},
    DeliveryStatus.arrivingAtStore: {DeliveryStatus.pickedUp},
    DeliveryStatus.pickedUp: {
      DeliveryStatus.arrivingAtCustomer,
      DeliveryStatus.failed
    },
    DeliveryStatus.arrivingAtCustomer: {
      DeliveryStatus.delivered,
      DeliveryStatus.failed
    },
    DeliveryStatus.delivered: {},
    DeliveryStatus.failed: {DeliveryStatus.returned},
    DeliveryStatus.returned: {},
  };

  static bool canTransition(DeliveryStatus from, DeliveryStatus to) {
    return from == to || (_allowed[from]?.contains(to) ?? false);
  }

  static Result<void, AppFailure> validate(
      DeliveryStatus from, DeliveryStatus to) {
    if (canTransition(from, to)) {
      return const Ok(null);
    }
    return Err(
      DeliveryFailure(
        code: ErrorCodes.deliveryInvalidTransition,
        message:
            'Invalid delivery transition: ${from.toJson()} -> ${to.toJson()}.',
        details: {'from': from.toJson(), 'to': to.toJson()},
      ),
    );
  }
}

final class RiderStateMachine {
  const RiderStateMachine._();

  static const Map<RiderStatus, Set<RiderStatus>> _allowed = {
    RiderStatus.offline: {RiderStatus.available, RiderStatus.blocked},
    RiderStatus.available: {
      RiderStatus.assigned,
      RiderStatus.paused,
      RiderStatus.offline,
      RiderStatus.blocked
    },
    RiderStatus.assigned: {
      RiderStatus.onTrip,
      RiderStatus.available,
      RiderStatus.blocked
    },
    RiderStatus.onTrip: {
      RiderStatus.available,
      RiderStatus.paused,
      RiderStatus.blocked
    },
    RiderStatus.paused: {
      RiderStatus.available,
      RiderStatus.offline,
      RiderStatus.blocked
    },
    RiderStatus.blocked: {},
  };

  static bool canTransition(RiderStatus from, RiderStatus to) {
    return from == to || (_allowed[from]?.contains(to) ?? false);
  }

  static Result<void, AppFailure> validate(RiderStatus from, RiderStatus to) {
    if (canTransition(from, to)) {
      return const Ok(null);
    }
    return Err(
      ConflictFailure(
        code: 'rider.invalid_transition',
        message:
            'Invalid rider transition: ${from.toJson()} -> ${to.toJson()}.',
        details: {'from': from.toJson(), 'to': to.toJson()},
      ),
    );
  }
}
