// packages/models/lib/src/return_status.dart
// 📦 Return/Exchange Status Enum

/// Status lifecycle for return and exchange requests
enum ReturnStatus {
  /// Customer initiated the request
  requested,
  
  /// Seller approved the request
  approved,
  
  /// Seller rejected the request
  rejected,
  
  /// Pickup has been scheduled
  pickupScheduled,
  
  /// Pickup agent arrived, doing doorstep QC
  pickupInProgress,
  
  /// Doorstep QC passed, item picked up
  pickupCompleted,
  
  /// Doorstep QC failed (wrong/damaged item)
  qcFailed,
  
  /// Refund is being processed
  refundInitiated,
  
  /// Refund completed successfully
  refundCompleted,
  
  /// Exchange: New item has been shipped
  exchangeShipped,
  
  /// Exchange: New item delivered
  exchangeDelivered,
  
  /// Request is fully resolved
  closed,
  
  /// Customer cancelled the request
  cancelled,
}

extension ReturnStatusExtension on ReturnStatus {
  String get displayName {
    switch (this) {
      case ReturnStatus.requested:
        return 'Requested';
      case ReturnStatus.approved:
        return 'Approved';
      case ReturnStatus.rejected:
        return 'Rejected';
      case ReturnStatus.pickupScheduled:
        return 'Pickup Scheduled';
      case ReturnStatus.pickupInProgress:
        return 'Pickup In Progress';
      case ReturnStatus.pickupCompleted:
        return 'Picked Up';
      case ReturnStatus.qcFailed:
        return 'QC Failed';
      case ReturnStatus.refundInitiated:
        return 'Refund Processing';
      case ReturnStatus.refundCompleted:
        return 'Refunded';
      case ReturnStatus.exchangeShipped:
        return 'Exchange Shipped';
      case ReturnStatus.exchangeDelivered:
        return 'Exchange Delivered';
      case ReturnStatus.closed:
        return 'Closed';
      case ReturnStatus.cancelled:
        return 'Cancelled';
    }
  }

  String get description {
    switch (this) {
      case ReturnStatus.requested:
        return 'Your return request has been submitted';
      case ReturnStatus.approved:
        return 'Seller has approved your request';
      case ReturnStatus.rejected:
        return 'Seller has rejected your request';
      case ReturnStatus.pickupScheduled:
        return 'Pickup agent will arrive soon';
      case ReturnStatus.pickupInProgress:
        return 'Quality check in progress';
      case ReturnStatus.pickupCompleted:
        return 'Item has been picked up';
      case ReturnStatus.qcFailed:
        return 'Item did not pass quality check';
      case ReturnStatus.refundInitiated:
        return 'Your refund is being processed';
      case ReturnStatus.refundCompleted:
        return 'Refund has been credited';
      case ReturnStatus.exchangeShipped:
        return 'Your replacement is on the way';
      case ReturnStatus.exchangeDelivered:
        return 'Exchange completed successfully';
      case ReturnStatus.closed:
        return 'Request has been resolved';
      case ReturnStatus.cancelled:
        return 'Request was cancelled';
    }
  }

  /// Whether this status allows cancellation
  bool get canCancel {
    return this == ReturnStatus.requested || 
           this == ReturnStatus.approved ||
           this == ReturnStatus.pickupScheduled;
  }

  /// Whether this is a terminal/final status
  bool get isFinal {
    return this == ReturnStatus.refundCompleted ||
           this == ReturnStatus.exchangeDelivered ||
           this == ReturnStatus.closed ||
           this == ReturnStatus.cancelled ||
           this == ReturnStatus.rejected;
  }

  /// Whether pickup is pending
  bool get isAwaitingPickup {
    return this == ReturnStatus.approved ||
           this == ReturnStatus.pickupScheduled;
  }

  String toJson() => name;

  static ReturnStatus fromJson(String json) {
    return ReturnStatus.values.firstWhere(
      (status) => status.name == json,
      orElse: () => ReturnStatus.requested,
    );
  }
}

/// Type of return/exchange request
enum ReturnType {
  /// Customer wants money back
  refund,
  
  /// Customer wants a different size/variant
  exchange,
}

extension ReturnTypeExtension on ReturnType {
  String get displayName {
    switch (this) {
      case ReturnType.refund:
        return 'Refund';
      case ReturnType.exchange:
        return 'Exchange';
    }
  }

  String get description {
    switch (this) {
      case ReturnType.refund:
        return 'Get your money back';
      case ReturnType.exchange:
        return 'Get a different size or variant';
    }
  }

  String toJson() => name;

  static ReturnType fromJson(String json) {
    return ReturnType.values.firstWhere(
      (type) => type.name == json,
      orElse: () => ReturnType.refund,
    );
  }
}
