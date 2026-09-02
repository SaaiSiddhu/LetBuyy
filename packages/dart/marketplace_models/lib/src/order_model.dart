// lib/models/order_model.dart
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
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
  // HELPER: Convert Timestamp/DateTime to DateTime
  // ============================================
  static DateTime _parseDateTime(dynamic value) {
    try {
      if (value == null) return DateTime.now();

      if (value is Timestamp) {
        return value.toDate();
      }

      if (value is DateTime) {
        return value;
      }

      if (value.runtimeType.toString().contains('Timestamp')) {
        try {
          return value.toDate();
        } catch (_) {}
      }

      if (value is int) {
        if (value > 10000000000) {
          return DateTime.fromMillisecondsSinceEpoch(value);
        }
        return DateTime.fromMillisecondsSinceEpoch(value * 1000);
      }

      if (value is double) {
        return DateTime.fromMillisecondsSinceEpoch((value * 1000).toInt());
      }

      return DateTime.now();
    } catch (e) {
      debugPrint('⚠️ DateTime parse failed for value: $value, error: $e');
      return DateTime.now();
    }
  }

  // ============================================
  // FROM JSON/MAP FACTORY
  // ============================================
  factory OrderModel.fromJson(Map<String, dynamic> json) {
    return OrderModel.fromMap(json, json['id'] ?? '');
  }

  factory OrderModel.fromMap(Map<String, dynamic> map, String id) {
    try {
      debugPrint('🔍 Parsing OrderModel: $id');

      // Parse items safely
      List<CartItemModel> parsedItems = [];
      try {
        if (map['items'] != null && map['items'] is List) {
          parsedItems = (map['items'] as List<dynamic>)
              .map((item) {
                try {
                  return CartItemModel.fromMap(item as Map<String, dynamic>);
                } catch (e) {
                  debugPrint('⚠️ Error parsing item: $e');
                  return null;
                }
              })
              .whereType<CartItemModel>()
              .toList();
        }
      } catch (e) {
        debugPrint('⚠️ Error parsing items list: $e');
      }

      // Parse delivery address safely
      AddressModel deliveryAddress = AddressModel.fromMap({});
      try {
        if (map['deliveryAddress'] != null &&
            map['deliveryAddress'] is Map<String, dynamic>) {
          deliveryAddress =
              AddressModel.fromMap(map['deliveryAddress'] as Map<String, dynamic>);
        }
      } catch (e) {
        debugPrint('⚠️ Error parsing delivery address: $e');
      }

      final order = OrderModel(
        id: id,
        userId: map['userId'] ?? '',
        sellerId: map['sellerId'] as String?,
        sellerName: map['sellerName'] as String?,
        orderNumber: map['orderNumber'] ?? 'ORD${DateTime.now().millisecondsSinceEpoch}',
        items: parsedItems,
        deliveryAddress: deliveryAddress,
        subtotal: (map['subtotal'] as num?)?.toDouble() ?? 0.0,
        discount: (map['discount'] as num?)?.toDouble() ?? 0.0,
        deliveryCharge: (map['deliveryCharge'] as num?)?.toDouble() ?? 0.0,
        tax: (map['tax'] as num?)?.toDouble() ?? 0.0,
        total: (map['total'] as num?)?.toDouble() ?? 0.0,
        paymentMethod: map['paymentMethod'] ?? 'cod',
        paymentStatus: map['paymentStatus'] ?? 'pending',
        orderStatus: map['orderStatus'] ?? 'pending',
        razorpayOrderId: map['razorpayOrderId'] as String?,
        razorpayPaymentId: map['razorpayPaymentId'] as String?,
        razorpaySignature: map['razorpaySignature'] as String?,
        couponCode: map['couponCode'] as String?,
        notes: map['notes'] as String?,
        createdAt: _parseDateTime(map['createdAt']),
        updatedAt: map['updatedAt'] != null ? _parseDateTime(map['updatedAt']) : null,
        deliveryDate: map['deliveryDate'] != null ? _parseDateTime(map['deliveryDate']) : null,
        // Return/Exchange fields
        hasReturnRequest: map['hasReturnRequest'] ?? false,
        hasExchangeRequest: map['hasExchangeRequest'] ?? false,
        returnRequestId: map['returnRequestId'] as String?,
        returnStatus: map['returnStatus'] as String?,
        returnType: map['returnType'] as String?,
        exchangeOrderId: map['exchangeOrderId'] as String?,
        returnRequestIds: map['returnRequestIds'] != null 
            ? List<String>.from(map['returnRequestIds']) 
            : null,
      );

      debugPrint('✅ OrderModel parsed: ${order.orderNumber}, sellerId: ${order.sellerId}, items: ${order.items.length}');
      return order;
    } catch (e) {
      debugPrint('❌ Error parsing OrderModel: $e');
      rethrow;
    }
  }

  // ============================================
  // TO MAP/JSON
  // ============================================
  Map<String, dynamic> toMap() {
    return {
      'userId': userId,
      'sellerId': sellerId,
      'sellerName': sellerName,
      'orderNumber': orderNumber,
      'items': items.map((item) => item.toMap()).toList(),
      'deliveryAddress': deliveryAddress.toMap(),
      'subtotal': subtotal,
      'discount': discount,
      'deliveryCharge': deliveryCharge,
      'tax': tax,
      'total': total,
      'paymentMethod': paymentMethod,
      'paymentStatus': paymentStatus,
      'orderStatus': orderStatus,
      'razorpayOrderId': razorpayOrderId,
      'razorpayPaymentId': razorpayPaymentId,
      'razorpaySignature': razorpaySignature,
      'couponCode': couponCode,
      'notes': notes,
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
      'deliveryDate': deliveryDate?.millisecondsSinceEpoch,
      // Return/Exchange fields
      'hasReturnRequest': hasReturnRequest,
      'hasExchangeRequest': hasExchangeRequest,
      'returnRequestId': returnRequestId,
      'returnStatus': returnStatus,
      'returnType': returnType,
      'exchangeOrderId': exchangeOrderId,
      'returnRequestIds': returnRequestIds,
    };
  }

  Map<String, dynamic> toJson() => toMap();

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