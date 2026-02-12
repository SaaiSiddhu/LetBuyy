import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
// lib/services/order_service.dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'loyalty_service.dart';
import 'invoice_service.dart';
import 'stock_service.dart';
import 'seller_analytics_service.dart';

class OrderService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final LoyaltyService _loyaltyService = LoyaltyService();
  final InvoiceService _invoiceService = InvoiceService();
  final StockService _stockService = StockService();
  final FirebaseFunctions _functions = FirebaseFunctions.instance;

  // ============================================
  // CREATE ORDER WITH STOCK REDUCTION + TIMELINE + COMMISSION
  // ============================================
  Future<String?> createOrder(OrderModel order, {bool isAdOrder = false}) async {
    try {
      debugPrint('📦 Creating order: ${order.orderNumber}');

      // 1️⃣ REDUCE STOCK ATOMICALLY (NEW)
      debugPrint('📉 Reducing stock for ${order.items.length} items...');
      final stockResult = await _stockService.reduceStock(order.items);
      
      if (!stockResult.success) {
        debugPrint('❌ Stock reduction failed: ${stockResult.error}');
        // Return null with error details (caller should show appropriate error)
        throw Exception('Stock unavailable: ${stockResult.failedItems.map((i) => i.message).join(", ")}');
      }
      debugPrint('✅ Stock reduced successfully');

      // 2️⃣ Create order document
      final orderId = _firestore.collection('orders').doc().id;
      
      try {
        await _firestore.collection('orders').doc(orderId).set(order.toMap());
      } catch (orderError) {
        // ROLLBACK: Restore stock if order creation fails
        debugPrint('❌ Order creation failed, rolling back stock...');
        await _stockService.restoreStock(order.items);
        rethrow;
      }

      // 3️⃣ Create initial timeline entry
      await _firestore
          .collection('orders')
          .doc(orderId)
          .collection('timeline')
          .add({
        'status': 'pending',
        'title': 'Order Placed',
        'description': 'Your order has been placed successfully.',
        'timestamp': FieldValue.serverTimestamp(),
        'icon': 'shopping_bag',
      });

      // 4️⃣ Calculate and store commission snapshot
      await _calculateOrderCommission(
        orderId: orderId,
        sellerId: order.sellerId ?? '',
        productId: order.items.isNotEmpty ? order.items.first.productId : '',
        orderTotal: order.total,
        isAdOrder: isAdOrder,
      );

      // 5️⃣ Track seller analytics for each item
      for (final item in order.items) {
        await SellerAnalyticsService.trackOrder(
          sellerId: order.sellerId ?? '',
          productId: item.productId,
          source: isAdOrder ? TrafficSource.ads : TrafficSource.organic,
          userId: order.userId,
          quantity: item.quantity,
          revenue: item.price * item.quantity,
        );
      }

      debugPrint('✅ Order created with ID: $orderId (stock reduced, analytics tracked)');
      return orderId;
    } catch (e) {
      debugPrint('❌ Error creating order: $e');
      return null;
    }
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
    try {
      await _firestore
          .collection('orders')
          .doc(orderId)
          .collection('timeline')
          .add({
        'status': status,
        'title': title,
        'description': description,
        'timestamp': FieldValue.serverTimestamp(),
      });

      debugPrint('✅ Timeline event added: $status');
    } catch (e) {
      debugPrint('❌ Error adding timeline event: $e');
    }
  }

  // ============================================
  // HELPER: Add timeline on status change
  // ============================================
  Future<void> updateOrderStatusWithTimeline(
    String orderId,
    String newStatus, {
    String? description,
  }) async {
    try {
      final titleMap = {
        'pending': 'Order Pending',
        'confirmed': 'Order Confirmed',
        'processing': 'Processing Order',
        'shipped': 'Order Shipped',
        'delivered': 'Order Delivered',
        'cancelled': 'Order Cancelled',
        'refunded': 'Refund Processed',
      };

      final descriptionMap = {
        'pending': 'Your order has been placed and is awaiting confirmation.',
        'confirmed': 'Your order has been confirmed by the seller.',
        'processing': 'Your order is being prepared for shipment.',
        'shipped': 'Your order has been shipped and is on the way.',
        'delivered': 'Your order has been delivered successfully.',
        'cancelled': 'Your order has been cancelled.',
        'refunded': 'Your refund has been processed.',
      };

      // Update order status
      await _firestore.collection('orders').doc(orderId).update({
        'orderStatus': newStatus,
        'updatedAt': FieldValue.serverTimestamp(),
      });

      // Add timeline event
      await _firestore
          .collection('orders')
          .doc(orderId)
          .collection('timeline')
          .add({
        'status': newStatus,
        'title': titleMap[newStatus] ?? 'Order Updated',
        'description':
            description ?? (descriptionMap[newStatus] ?? 'Order updated.'),
        'timestamp': FieldValue.serverTimestamp(),
      });

      // 💰 Process when order is delivered
      if (newStatus.toLowerCase() == 'delivered') {
        await _processDeliveredOrderCommission(orderId);
        await _awardLoyaltyPointsForOrder(orderId);
        await _generateOrderInvoice(orderId); // ✅ NEW: Generate invoice
      }

      debugPrint('✅ Order status updated and timeline added');
    } catch (e) {
      debugPrint('❌ Error updating order status: $e');
    }
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
