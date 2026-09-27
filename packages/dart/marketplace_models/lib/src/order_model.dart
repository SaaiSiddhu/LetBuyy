// lib/models/order_model.dart
//
// C3 (Firebase SDK removal, 27 September 2026 review continuation): fromJson/fromMap/toMap/toJson
// (and the Timestamp/FieldValue.serverTimestamp parsing they used) deleted outright -- grepping
// every real caller anywhere in the app found none. OrderModel is still a live plain value type
// (orders_screen.dart, order_details_screen.dart, order_tracking_screen.dart, order_card.dart,
// order_success_screen.dart all hold/render one), but nothing constructs it from raw Firestore/JSON
// data any more: OrderProvider, the only thing that ever called OrderModel.fromMap, was itself
// retired in R1 corrective C2 (entirely FirebaseFirestore-backed, no canonical successor).
import 'cart_item_model.dart';
import 'address_model.dart';

class OrderModel {
  final String id;
  final String userId;
  final String? sellerId;          // ✅ ADDED: Seller ID for multi-seller
  final String? sellerName;        // ✅ ADDED: Seller name for display
  final String orderNumber;
  final List<CartItemModel> items;
  final AddressModel deliveryAddress;
  final double subtotal;
  final double discount;
  final double deliveryCharge;
  final double tax;
  final double total;
  final String paymentMethod;
  final String paymentStatus;
  final String orderStatus;
  final String? razorpayOrderId;
  final String? razorpayPaymentId;
  final String? razorpaySignature;
  final String? couponCode;
  final String? notes;
  final DateTime createdAt;
  final DateTime? updatedAt;
  final DateTime? deliveryDate;
  
  // ══════════════════════════════════════════════════════════════
  // RETURN/EXCHANGE TRACKING
  // ══════════════════════════════════════════════════════════════
  final bool hasReturnRequest;        // True if any return/exchange exists
  final bool hasExchangeRequest;      // Specifically exchange type
  final String? returnRequestId;      // Primary return request ID
  final String? returnStatus;         // Cached return status
  final String? returnType;           // 'refund' | 'exchange'
  final String? exchangeOrderId;      // New order created for exchange
  final List<String>? returnRequestIds; // All return IDs for multi-item

  OrderModel({
    required this.id,
    required this.userId,
    this.sellerId,
    this.sellerName,
    required this.orderNumber,
    required this.items,
    required this.deliveryAddress,
    required this.subtotal,
    this.discount = 0,
    this.deliveryCharge = 0,
    this.tax = 0,
    required this.total,
    required this.paymentMethod,
    this.paymentStatus = 'pending',
    this.orderStatus = 'pending',
    this.razorpayOrderId,
    this.razorpayPaymentId,
    this.razorpaySignature,
    this.couponCode,
    this.notes,
    DateTime? createdAt,
    this.updatedAt,
    this.deliveryDate,
    // Return/Exchange fields
    this.hasReturnRequest = false,
    this.hasExchangeRequest = false,
    this.returnRequestId,
    this.returnStatus,
    this.returnType,
    this.exchangeOrderId,
    this.returnRequestIds,
  }) : createdAt = createdAt ?? DateTime.now();

  // ============================================
  // GETTERS & UTILITIES
  // ============================================
  int get itemCount => items.fold(0, (sum, item) => sum + item.quantity);

  String get status => orderStatus;

  bool get isDelivered =>
      orderStatus.toLowerCase() == 'delivered' ||
      orderStatus.toLowerCase() == 'completed';

  bool get isCancelled => orderStatus.toLowerCase() == 'cancelled';

  bool get isPending =>
      orderStatus.toLowerCase() == 'pending' ||
      orderStatus.toLowerCase() == 'confirmed';

  bool get isInTransit =>
      orderStatus.toLowerCase() == 'shipped' ||
      orderStatus.toLowerCase() == 'processing';

  String getStatusDisplay() {
    switch (orderStatus.toLowerCase()) {
      case 'pending':
        return 'Pending';
      case 'confirmed':
        return 'Confirmed';
      case 'processing':
        return 'Processing';
      case 'shipped':
        return 'Shipped';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      case 'refunded':
        return 'Refunded';
      case 'returned':
        return 'Returned';
      default:
        return orderStatus;
    }
  }

  static String generateOrderNumber() {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    return 'ORD${timestamp.toString().substring(5)}';
  }

  OrderModel copyWith({
    String? id,
    String? userId,
    String? sellerId,
    String? sellerName,
    String? orderNumber,
    List<CartItemModel>? items,
    AddressModel? deliveryAddress,
    double? subtotal,
    double? discount,
    double? deliveryCharge,
    double? tax,
    double? total,
    String? paymentMethod,
    String? paymentStatus,
    String? orderStatus,
    String? razorpayOrderId,
    String? razorpayPaymentId,
    String? razorpaySignature,
    String? couponCode,
    String? notes,
    DateTime? createdAt,
    DateTime? updatedAt,
    DateTime? deliveryDate,
    // Return/Exchange fields
    bool? hasReturnRequest,
    bool? hasExchangeRequest,
    String? returnRequestId,
    String? returnStatus,
    String? returnType,
    String? exchangeOrderId,
    List<String>? returnRequestIds,
  }) {
    return OrderModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      sellerId: sellerId ?? this.sellerId,
      sellerName: sellerName ?? this.sellerName,
      orderNumber: orderNumber ?? this.orderNumber,
      items: items ?? this.items,
      deliveryAddress: deliveryAddress ?? this.deliveryAddress,
      subtotal: subtotal ?? this.subtotal,
      discount: discount ?? this.discount,
      deliveryCharge: deliveryCharge ?? this.deliveryCharge,
      tax: tax ?? this.tax,
      total: total ?? this.total,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      orderStatus: orderStatus ?? this.orderStatus,
      razorpayOrderId: razorpayOrderId ?? this.razorpayOrderId,
      razorpayPaymentId: razorpayPaymentId ?? this.razorpayPaymentId,
      razorpaySignature: razorpaySignature ?? this.razorpaySignature,
      couponCode: couponCode ?? this.couponCode,
      notes: notes ?? this.notes,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      deliveryDate: deliveryDate ?? this.deliveryDate,
      // Return/Exchange fields
      hasReturnRequest: hasReturnRequest ?? this.hasReturnRequest,
      hasExchangeRequest: hasExchangeRequest ?? this.hasExchangeRequest,
      returnRequestId: returnRequestId ?? this.returnRequestId,
      returnStatus: returnStatus ?? this.returnStatus,
      returnType: returnType ?? this.returnType,
      exchangeOrderId: exchangeOrderId ?? this.exchangeOrderId,
      returnRequestIds: returnRequestIds ?? this.returnRequestIds,
    );
  }

  @override
  String toString() {
    return 'OrderModel(id: $id, orderNumber: $orderNumber, sellerId: $sellerId, status: $orderStatus, total: $total, items: ${items.length})';
  }
}