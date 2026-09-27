enum OrderStatus {
  pending,
  confirmed,
  processing,
  shipped,
  outForDelivery,
  delivered,
  cancelled,
  returned,
  refunded,
}

class OrderTimelineModel {
  final OrderStatus status;
  final String title;
  final String description;
  final DateTime timestamp;
  final String? trackingNumber; // ✅ ADDED
  final String? location; // ✅ ADDED
  final String? updatedBy; // ✅ ADDED

  OrderTimelineModel({
    required this.status,
    required this.title,
    required this.description,
    required this.timestamp,
    this.trackingNumber,
    this.location,
    this.updatedBy,
  });

  // C3 (Firebase SDK removal, 27 September 2026 review continuation): fromMap(map)/toMap()
  // (Firestore document <-> model) deleted -- zero callers. order_details_screen.dart and
  // order_tracking_screen.dart both build OrderTimelineModel client-side from an already-loaded
  // OrderModel via the plain constructor above, never through these.

  // Get status display name
  String get statusDisplayName {
    switch (status) {
      case OrderStatus.pending:
        return 'Pending';
      case OrderStatus.confirmed:
        return 'Confirmed';
      case OrderStatus.processing:
        return 'Processing';
      case OrderStatus.shipped:
        return 'Shipped';
      case OrderStatus.outForDelivery:
        return 'Out for Delivery';
      case OrderStatus.delivered:
        return 'Delivered';
      case OrderStatus.cancelled:
        return 'Cancelled';
      case OrderStatus.returned:
        return 'Returned';
      case OrderStatus.refunded:
        return 'Refunded';
    }
  }

  @override
  String toString() {
    return 'OrderTimelineModel(status: $status, title: $title, timestamp: $timestamp)';
  }
}
