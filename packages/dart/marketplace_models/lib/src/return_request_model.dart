import 'return_status.dart';

// C3 (Firebase SDK removal, 27 September 2026 review continuation): fromMap/toMap (and the
// Firestore Timestamp/FieldValue.serverTimestamp parsing they used) deleted outright -- grepping
// every real caller anywhere in the app found none: ReturnService's stream/lookup methods (its
// only real constructors of this type) are now plain empty/null stubs. The qcResult field (and
// return_qc_model.dart's ReturnQCModel it referenced) is deleted alongside them -- `.qcResult` had
// zero readers anywhere in the app either.
class ReturnRequestModel {
  final String id;

  // Order & Item Info
  final String orderId;
  final String orderNumber;
  final String orderItemId; // Specific item being returned
  final String productId;
  final String productName;
  final String? productImage;
  final String? variantInfo; // e.g., "Size: L, Color: Blue"
  final int quantity;
  final double itemPrice;

  // Parties
  final String userId;
  final String userName;
  final String? userPhone;
  final String sellerId;
  final String sellerName;

  // Request Details
  final ReturnType type;
  final ReturnStatus status;
  final String reasonCode;
  final String reasonTitle;
  final String? customerNotes;

  // Evidence
  final List<String> customerImages;
  final String? customerVideo;

  // For Exchange
  final String? exchangeVariantId;
  final String? exchangeVariantInfo;
  final String? exchangeOrderId;

  // Pickup Info
  final DateTime? pickupScheduledAt;
  final String? pickupSlot; // e.g., "10 AM - 12 PM"
  final String? pickupAddress;
  final String? pickupAgentName;
  final String? pickupAgentPhone;
  final DateTime? pickupCompletedAt;

  // Refund Info
  final double refundAmount;
  final String? refundMethod; // 'original_source', 'bank', 'upi'
  final String? refundAccountDetails; // For COD orders
  final String? refundTransactionId;
  final DateTime? refundInitiatedAt;
  final DateTime? refundCompletedAt;

  // Seller Response
  final String? sellerNotes;
  final String? sellerRejectionReason;
  final DateTime? sellerRespondedAt;

  // Admin Override
  final bool isAdminOverride;
  final String? adminNotes;
  final String? adminId;

  // Appeal System (one appeal allowed, 24hr window after rejection)
  final bool hasAppealed;
  final DateTime? appealedAt;
  final String? appealChatId; // Link to support chat for appeal

  // Timestamps
  final DateTime createdAt;
  final DateTime? updatedAt;
  final DateTime? closedAt;

  ReturnRequestModel({
    required this.id,
    required this.orderId,
    required this.orderNumber,
    required this.orderItemId,
    required this.productId,
    required this.productName,
    this.productImage,
    this.variantInfo,
    required this.quantity,
    required this.itemPrice,
    required this.userId,
    required this.userName,
    this.userPhone,
    required this.sellerId,
    required this.sellerName,
    required this.type,
    required this.status,
    required this.reasonCode,
    required this.reasonTitle,
    this.customerNotes,
    this.customerImages = const [],
    this.customerVideo,
    this.exchangeVariantId,
    this.exchangeVariantInfo,
    this.exchangeOrderId,
    this.pickupScheduledAt,
    this.pickupSlot,
    this.pickupAddress,
    this.pickupAgentName,
    this.pickupAgentPhone,
    this.pickupCompletedAt,
    this.refundAmount = 0,
    this.refundMethod,
    this.refundAccountDetails,
    this.refundTransactionId,
    this.refundInitiatedAt,
    this.refundCompletedAt,
    this.sellerNotes,
    this.sellerRejectionReason,
    this.sellerRespondedAt,
    this.isAdminOverride = false,
    this.adminNotes,
    this.adminId,
    this.hasAppealed = false,
    this.appealedAt,
    this.appealChatId,
    DateTime? createdAt,
    this.updatedAt,
    this.closedAt,
  }) : createdAt = createdAt ?? DateTime.now();

  // ══════════════════════════════════════════════════════════════
  // COMPUTED PROPERTIES
  // ══════════════════════════════════════════════════════════════

  /// Total refund amount based on items
  double get calculatedRefundAmount => itemPrice * quantity;

  /// Whether request is pending seller action
  bool get isPendingSeller => status == ReturnStatus.requested;

  /// Whether pickup is scheduled
  bool get isPickupPending => status.isAwaitingPickup;

  /// Whether request is resolved
  bool get isResolved => status.isFinal;

  /// Whether customer can cancel
  bool get canCancel => status.canCancel;

  /// Whether this is an exchange request
  bool get isExchange => type == ReturnType.exchange;

  /// Whether refund is needed (not for exchange)
  bool get needsRefund => type == ReturnType.refund;

  /// Days since request was created
  int get daysSinceCreated => DateTime.now().difference(createdAt).inDays;

  // ══════════════════════════════════════════════════════════════
  // APPEAL SYSTEM PROPERTIES
  // ══════════════════════════════════════════════════════════════

  /// Hours since rejection (for appeal window)
  int get hoursSinceRejection {
    if (sellerRespondedAt == null) return 0;
    return DateTime.now().difference(sellerRespondedAt!).inHours;
  }

  /// Whether the 24hr appeal window has expired
  bool get isAppealExpired => hoursSinceRejection > 24;

  /// Whether user can still appeal (rejected, within 24hrs, hasn't appealed yet)
  bool get canAppeal =>
      status == ReturnStatus.rejected &&
      !hasAppealed &&
      !isAppealExpired;

  /// Remaining hours to appeal
  int get hoursRemainingToAppeal {
    if (!canAppeal) return 0;
    return 24 - hoursSinceRejection;
  }

  /// Generate a unique return number
  static String generateReturnNumber() {
    final timestamp = DateTime.now().millisecondsSinceEpoch.toString();
    return 'RET${timestamp.substring(timestamp.length - 10)}';
  }

  // ══════════════════════════════════════════════════════════════
  // COPY WITH
  // ══════════════════════════════════════════════════════════════

  ReturnRequestModel copyWith({
    String? id,
    String? orderId,
    String? orderNumber,
    String? orderItemId,
    String? productId,
    String? productName,
    String? productImage,
    String? variantInfo,
    int? quantity,
    double? itemPrice,
    String? userId,
    String? userName,
    String? userPhone,
    String? sellerId,
    String? sellerName,
    ReturnType? type,
    ReturnStatus? status,
    String? reasonCode,
    String? reasonTitle,
    String? customerNotes,
    List<String>? customerImages,
    String? customerVideo,
    String? exchangeVariantId,
    String? exchangeVariantInfo,
    String? exchangeOrderId,
    DateTime? pickupScheduledAt,
    String? pickupSlot,
    String? pickupAddress,
    String? pickupAgentName,
    String? pickupAgentPhone,
    DateTime? pickupCompletedAt,
    double? refundAmount,
    String? refundMethod,
    String? refundAccountDetails,
    String? refundTransactionId,
    DateTime? refundInitiatedAt,
    DateTime? refundCompletedAt,
    String? sellerNotes,
    String? sellerRejectionReason,
    DateTime? sellerRespondedAt,
    bool? isAdminOverride,
    String? adminNotes,
    String? adminId,
    bool? hasAppealed,
    DateTime? appealedAt,
    String? appealChatId,
    DateTime? createdAt,
    DateTime? updatedAt,
    DateTime? closedAt,
  }) {
    return ReturnRequestModel(
      id: id ?? this.id,
      orderId: orderId ?? this.orderId,
      orderNumber: orderNumber ?? this.orderNumber,
      orderItemId: orderItemId ?? this.orderItemId,
      productId: productId ?? this.productId,
      productName: productName ?? this.productName,
      productImage: productImage ?? this.productImage,
      variantInfo: variantInfo ?? this.variantInfo,
      quantity: quantity ?? this.quantity,
      itemPrice: itemPrice ?? this.itemPrice,
      userId: userId ?? this.userId,
      userName: userName ?? this.userName,
      userPhone: userPhone ?? this.userPhone,
      sellerId: sellerId ?? this.sellerId,
      sellerName: sellerName ?? this.sellerName,
      type: type ?? this.type,
      status: status ?? this.status,
      reasonCode: reasonCode ?? this.reasonCode,
      reasonTitle: reasonTitle ?? this.reasonTitle,
      customerNotes: customerNotes ?? this.customerNotes,
      customerImages: customerImages ?? this.customerImages,
      customerVideo: customerVideo ?? this.customerVideo,
      exchangeVariantId: exchangeVariantId ?? this.exchangeVariantId,
      exchangeVariantInfo: exchangeVariantInfo ?? this.exchangeVariantInfo,
      exchangeOrderId: exchangeOrderId ?? this.exchangeOrderId,
      pickupScheduledAt: pickupScheduledAt ?? this.pickupScheduledAt,
      pickupSlot: pickupSlot ?? this.pickupSlot,
      pickupAddress: pickupAddress ?? this.pickupAddress,
      pickupAgentName: pickupAgentName ?? this.pickupAgentName,
      pickupAgentPhone: pickupAgentPhone ?? this.pickupAgentPhone,
      pickupCompletedAt: pickupCompletedAt ?? this.pickupCompletedAt,
      refundAmount: refundAmount ?? this.refundAmount,
      refundMethod: refundMethod ?? this.refundMethod,
      refundAccountDetails: refundAccountDetails ?? this.refundAccountDetails,
      refundTransactionId: refundTransactionId ?? this.refundTransactionId,
      refundInitiatedAt: refundInitiatedAt ?? this.refundInitiatedAt,
      refundCompletedAt: refundCompletedAt ?? this.refundCompletedAt,
      sellerNotes: sellerNotes ?? this.sellerNotes,
      sellerRejectionReason: sellerRejectionReason ?? this.sellerRejectionReason,
      sellerRespondedAt: sellerRespondedAt ?? this.sellerRespondedAt,
      isAdminOverride: isAdminOverride ?? this.isAdminOverride,
      adminNotes: adminNotes ?? this.adminNotes,
      adminId: adminId ?? this.adminId,
      hasAppealed: hasAppealed ?? this.hasAppealed,
      appealedAt: appealedAt ?? this.appealedAt,
      appealChatId: appealChatId ?? this.appealChatId,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      closedAt: closedAt ?? this.closedAt,
    );
  }

  @override
  String toString() =>
      'ReturnRequestModel(id: $id, orderId: $orderId, type: ${type.name}, status: ${status.name})';
}
