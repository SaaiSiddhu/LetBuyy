import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
// lib/services/order_service.dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'loyalty_service.dart';
import 'invoice_service.dart';

class OrderService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final LoyaltyService _loyaltyService = LoyaltyService();
  final InvoiceService _invoiceService = InvoiceService();
  final FirebaseFunctions _functions = FirebaseFunctions.instance;

  // ============================================
  // CREATE ORDER WITH STOCK REDUCTION + TIMELINE + COMMISSION
  // ============================================
  Future<String?> createOrder(OrderModel order, {bool isAdOrder = false}) async {
    throw UnsupportedError(
      'Orders must be created through the backend checkout workflow.',
    );
  }

  // ============================================
  // CALCULATE COMMISSION (Cloud Function Call)
  // ============================================
  Future<void> _calculateOrderCommission({
    required String orderId,
    required String sellerId,
    required String productId,
    required double orderTotal,
    required bool isAdOrder,
  }) async {
    try {
      if (sellerId.isEmpty) {
        debugPrint('⚠️ Skipping commission: missing sellerId');
        return;
      }

      debugPrint('💰 Calculating commission for order: $orderId');

      final callable = _functions.httpsCallable('calculateOrderCommission');
      final result = await callable.call({
        'orderId': orderId,
        'sellerId': sellerId,
        'productId': productId, // Cloud function will look up categoryId from product
        'orderTotal': orderTotal,
        'isAdOrder': isAdOrder,
      });

      if (result.data['success'] == true) {
        final snapshot = result.data['snapshot'];
        debugPrint('✅ Commission calculated: ${snapshot['finalPercent']}% = ₹${snapshot['commissionAmount']}');
      }
    } catch (e) {
      debugPrint('❌ Error calculating commission: $e');
      // Don't fail order creation if commission fails - can be recalculated
    }
  }

  // ============================================
  // PROCESS DELIVERED ORDER COMMISSION (Cloud Function)
  // ============================================
  Future<void> _processDeliveredOrderCommission(String orderId) async {
    try {
      debugPrint('💰 Processing commission for delivered order: $orderId');

      final callable = _functions.httpsCallable('processDeliveredOrderCommission');
      final result = await callable.call({'orderId': orderId});

      if (result.data['success'] == true) {
        debugPrint('✅ Commission processed: ₹${result.data['commissionDeducted']} deducted');
        debugPrint('💵 Seller earnings: ₹${result.data['sellerEarnings']}');
        debugPrint('📅 Release date: ${result.data['releaseDate']}');
      }
    } catch (e) {
      debugPrint('❌ Error processing commission: $e');
    }
  }

  // ============================================
  // ADD TIMELINE EVENT MANUALLY
  // ============================================
  Future<void> addTimelineEvent(
    String orderId, {
    required String status,
    required String title,
    required String description,
  }) async {
    throw UnsupportedError(
      'Order timeline writes must use the backend order state machine.',
    );
  }

  // ============================================
  // HELPER: Add timeline on status change
  // ============================================
  Future<void> updateOrderStatusWithTimeline(
    String orderId,
    String newStatus, {
    String? description,
  }) async {
    throw UnsupportedError(
      'Order status changes must use the backend order state machine.',
    );
  }

  // ============================================
  // GENERATE ORDER INVOICE (NEW)
  // ============================================
  Future<void> _generateOrderInvoice(String orderId) async {
    try {
      final orderDoc = await _firestore.collection('orders').doc(orderId).get();
      if (!orderDoc.exists) return;

      final order = OrderModel.fromMap(orderDoc.data()!, orderId);
      
      // Get delivery fee from order's delivery subcollection or default
      double deliveryFee = order.deliveryCharge;
      try {
        final deliveryDoc = await _firestore
            .collection('orders')
            .doc(orderId)
            .collection('delivery')
            .doc('info')
            .get();
        if (deliveryDoc.exists) {
          deliveryFee = (deliveryDoc.data()?['actualCost'] as num?)?.toDouble() ?? order.deliveryCharge;
        }
      } catch (_) {}

      // Get category commissions for each product
      final categoryCommissions = <String, double>{};
      for (final item in order.items) {
        // Try to get category commission, default to 10%
        try {
          final productDoc = await _firestore.collection('products').doc(item.productId).get();
          if (productDoc.exists) {
            final categoryId = productDoc.data()?['categoryId'] as String?;
            if (categoryId != null) {
              final categoryDoc = await _firestore.collection('categories').doc(categoryId).get();
              if (categoryDoc.exists) {
                final commission = categoryDoc.data()?['commission'] as Map<String, dynamic>?;
                categoryCommissions[item.productId] = (commission?['percent'] as num?)?.toDouble() ?? 10.0;
              }
            }
          }
        } catch (_) {
          categoryCommissions[item.productId] = 10.0; // Default
        }
      }

      // Get seller tier modifier
      double tierModifier = 0.0;
      if (order.sellerId != null) {
        try {
          final sellerDoc = await _firestore.collection('sellers').doc(order.sellerId).get();
          if (sellerDoc.exists) {
            final commission = sellerDoc.data()?['commission'] as Map<String, dynamic>?;
            tierModifier = (commission?['tierModifier'] as num?)?.toDouble() ?? 0.0;
          }
        } catch (_) {}
      }

      await _invoiceService.generateInvoice(
        order: order,
        deliveryFee: deliveryFee,
        categoryCommissions: categoryCommissions,
        sellerTierModifier: tierModifier,
      );
      
      debugPrint('✅ Invoice generated for order: $orderId');
    } catch (e) {
      debugPrint('❌ Error generating invoice: $e');
    }
  }

  // ============================================
  // LOYALTY POINTS AWARDING
  // ============================================
  Future<void> _awardLoyaltyPointsForOrder(String orderId) async {
    try {
      final orderDoc = await _firestore.collection('orders').doc(orderId).get();
      if (!orderDoc.exists) return;

      final orderData = orderDoc.data()!;
      final userId = orderData['userId'] as String?;
      final total = (orderData['total'] as num?)?.toDouble() ?? 0.0;

      if (userId == null || total <= 0) return;

      await _loyaltyService.awardPointsForOrder(
        userId: userId,
        orderId: orderId,
        orderTotal: total,
      );
    } catch (e) {
      debugPrint('❌ Error awarding loyalty points: $e');
    }
  }
}
