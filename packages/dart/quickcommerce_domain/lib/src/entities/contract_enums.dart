// GENERATED CODE - DO NOT EDIT BY HAND.
// Run `dart run scripts/gen_contracts.dart`.

final class ContractError implements FormatException {
  const ContractError(this.contract, this.value);

  final String contract;
  final Object? value;

  @override
  String get message => 'Unknown $contract value: $value';

  @override
  int? get offset => null;

  @override
  Object? get source => value;

  @override
  String toString() => message;
}

enum UserRole {
  customer('customer'),
  rider('rider'),
  storeOperator('store_operator'),
  seller('seller'),
  admin('admin'),
  superAdmin('super_admin');

  const UserRole(this.value);

  final String value;

  factory UserRole.fromJson(Object? value) {
    final text = value?.toString();
    return switch (text) {
      'customer' => UserRole.customer,
      'rider' => UserRole.rider,
      'store_operator' => UserRole.storeOperator,
      'seller' => UserRole.seller,
      'admin' => UserRole.admin,
      'super_admin' => UserRole.superAdmin,
      _ => throw ContractError('UserRole', value),
    };
  }

  String toJson() => value;
}

enum OrderStatus {
  draft('draft'),
  quoteCreated('quote_created'),
  paymentPending('payment_pending'),
  confirmed('confirmed'),
  picking('picking'),
  packing('packing'),
  readyForPickup('ready_for_pickup'),
  riderAssigned('rider_assigned'),
  pickedUp('picked_up'),
  arriving('arriving'),
  delivered('delivered'),
  cancelled('cancelled'),
  failed('failed'),
  returned('returned'),
  refunded('refunded');

  const OrderStatus(this.value);

  final String value;

  factory OrderStatus.fromJson(Object? value) {
    final text = value?.toString();
    return switch (text) {
      'draft' => OrderStatus.draft,
      'quote_created' => OrderStatus.quoteCreated,
      'payment_pending' => OrderStatus.paymentPending,
      'confirmed' => OrderStatus.confirmed,
      'picking' => OrderStatus.picking,
      'packing' => OrderStatus.packing,
      'ready_for_pickup' => OrderStatus.readyForPickup,
      'rider_assigned' => OrderStatus.riderAssigned,
      'picked_up' => OrderStatus.pickedUp,
      'arriving' => OrderStatus.arriving,
      'delivered' => OrderStatus.delivered,
      'cancelled' => OrderStatus.cancelled,
      'failed' => OrderStatus.failed,
      'returned' => OrderStatus.returned,
      'refunded' => OrderStatus.refunded,
      _ => throw ContractError('OrderStatus', value),
    };
  }

  String toJson() => value;
}

enum PaymentStatus {
  pending('pending'),
  authorized('authorized'),
  captured('captured'),
  failed('failed'),
  refunded('refunded'),
  partiallyRefunded('partially_refunded');

  const PaymentStatus(this.value);

  final String value;

  factory PaymentStatus.fromJson(Object? value) {
    final text = value?.toString();
    return switch (text) {
      'pending' => PaymentStatus.pending,
      'authorized' => PaymentStatus.authorized,
      'captured' => PaymentStatus.captured,
      'failed' => PaymentStatus.failed,
      'refunded' => PaymentStatus.refunded,
      'partially_refunded' => PaymentStatus.partiallyRefunded,
      _ => throw ContractError('PaymentStatus', value),
    };
  }

  String toJson() => value;
}

enum RiderStatus {
  offline('offline'),
  available('available'),
  assigned('assigned'),
  onTrip('on_trip'),
  paused('paused'),
  blocked('blocked');

  const RiderStatus(this.value);

  final String value;

  factory RiderStatus.fromJson(Object? value) {
    final text = value?.toString();
    return switch (text) {
      'offline' => RiderStatus.offline,
      'available' => RiderStatus.available,
      'assigned' => RiderStatus.assigned,
      'on_trip' => RiderStatus.onTrip,
      'paused' => RiderStatus.paused,
      'blocked' => RiderStatus.blocked,
      _ => throw ContractError('RiderStatus', value),
    };
  }

  String toJson() => value;
}

enum DeliveryStatus {
  pendingAssignment('pending_assignment'),
  assigned('assigned'),
  accepted('accepted'),
  rejected('rejected'),
  arrivingAtStore('arriving_at_store'),
  pickedUp('picked_up'),
  arrivingAtCustomer('arriving_at_customer'),
  delivered('delivered'),
  failed('failed'),
  returned('returned');

  const DeliveryStatus(this.value);

  final String value;

  factory DeliveryStatus.fromJson(Object? value) {
    final text = value?.toString();
    return switch (text) {
      'pending_assignment' => DeliveryStatus.pendingAssignment,
      'assigned' => DeliveryStatus.assigned,
      'accepted' => DeliveryStatus.accepted,
      'rejected' => DeliveryStatus.rejected,
      'arriving_at_store' => DeliveryStatus.arrivingAtStore,
      'picked_up' => DeliveryStatus.pickedUp,
      'arriving_at_customer' => DeliveryStatus.arrivingAtCustomer,
      'delivered' => DeliveryStatus.delivered,
      'failed' => DeliveryStatus.failed,
      'returned' => DeliveryStatus.returned,
      _ => throw ContractError('DeliveryStatus', value),
    };
  }

  String toJson() => value;
}
