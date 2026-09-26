// ============================================================
// FILE 5: lib/providers/order_provider.dart - UPDATED
// ============================================================

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../firebase_safety.dart';
import 'package:letbuyy_marketplace_models/src/order_model.dart';
import 'package:letbuyy_marketplace_models/src/order_timeline_model.dart';
import 'package:letbuyy_marketplace_models/src/cart_item_model.dart'; // ✅ ADDED: For groupBySeller() extension
import 'package:letbuyy_marketplace_models/src/analytics_event.dart'; // ✅ ADDED: For TrafficSource enum
import '../database_service.dart';
import '../auth_service.dart';
import '../order_notification_service.dart';
import '../stock_service.dart';
import '../seller_analytics_service.dart'; // ✅ ADDED: For order tracking


class OrderProvider with ChangeNotifier {
  final DatabaseService _databaseService = DatabaseService();
  final AuthService _authService = AuthService();
  FirebaseFirestore get _firestore => FirebaseFirestore.instance;
  final StockService _stockService = StockService();

  List<OrderModel> _orders = [];
  OrderModel? _selectedOrder;
  List<OrderTimelineModel> _selectedOrderTimeline = [];
  bool _isLoading = false;
  bool _isLoadingTimeline = false;
  String? _error;
  StreamSubscription? _ordersSubscription;

  List<OrderModel> get orders => _orders;
  OrderModel? get selectedOrder => _selectedOrder;
  List<OrderTimelineModel> get selectedOrderTimeline => _selectedOrderTimeline;
  bool get isLoading => _isLoading;
  bool get isLoadingTimeline => _isLoadingTimeline;
  String? get error => _error;
  int get orderCount => _orders.length;
  bool get hasOrders => _orders.isNotEmpty;

  void loadUserOrders() {
    try {
      final userId = _authService.currentUserId ?? 
                     safeFirebaseUserId();
      
      if (userId == null) {
        _error = '❌ User not authenticated';
        notifyListeners();
        return;
      }

      debugPrint('📦 Loading orders for user: $userId');
      _ordersSubscription?.cancel();

      _ordersSubscription = _firestore
          .collection('orders')
          .where('userId', isEqualTo: userId)
          .orderBy('createdAt', descending: true)
          .snapshots()
          .listen(
        (snapshot) {
          try {
            _orders = snapshot.docs
                .map((doc) => OrderModel.fromMap(doc.data(), doc.id))
                .toList();
            _error = null;
            debugPrint('✅ Loaded ${_orders.length} orders');
            notifyListeners();
          } catch (e) {
            debugPrint('❌ Error parsing orders: $e');
            _error = 'Failed to load orders';
            notifyListeners();
          }
        },
        onError: (error) {
          debugPrint('❌ Error: $error');
          _error = error.toString();
          notifyListeners();
        },
      );
    } catch (e) {
      debugPrint('❌ Error: $e');
      _error = e.toString();
      notifyListeners();
    }
  }

  void loadAllOrders() {
    try {
      debugPrint('📦 Loading ALL orders for Admin');
      _ordersSubscription?.cancel();

      _ordersSubscription = _firestore
          .collection('orders')
          .orderBy('createdAt', descending: true)
          .snapshots()
          .listen(
        (snapshot) {
          try {
            _orders = snapshot.docs
                .map((doc) => OrderModel.fromMap(doc.data(), doc.id))
                .toList();
            _error = null;
            debugPrint('✅ Loaded ${_orders.length} orders');
            notifyListeners();
          } catch (e) {
            debugPrint('❌ Error: $e');
            _error = 'Failed to load orders';
            notifyListeners();
          }
        },
        onError: (error) {
          debugPrint('❌ Error: $error');
          _error = error.toString();
          notifyListeners();
        },
      );
    } catch (e) {
      debugPrint('❌ Error: $e');
      _error = e.toString();
      notifyListeners();
    }
  }

  Future<String?> createOrder(OrderModel order) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      debugPrint('📦 Creating order: ${order.orderNumber}');

      // 1️⃣ REDUCE STOCK ATOMICALLY (NEW)
      debugPrint('📉 Reducing stock for ${order.items.length} items...');
      final stockResult = await _stockService.reduceStock(order.items);
      
      if (!stockResult.success) {
        debugPrint('❌ Stock reduction failed: ${stockResult.error}');
        _error = 'Stock unavailable: ${stockResult.failedItems.map((i) => i.message).join(', ')}';
        _isLoading = false;
        notifyListeners();
        return null;
      }
      debugPrint('✅ Stock reduced successfully');

      // 2️⃣ Create order document
      String? orderId;
      try {
        orderId = await _databaseService.createOrder(order);
      } catch (orderError) {
        // ROLLBACK: Restore stock if order creation fails
        debugPrint('❌ Order creation failed, rolling back stock...');
        await _stockService.restoreStock(order.items);
        rethrow;
      }

      _orders.insert(0, order);
      
      // 3️⃣ SEND ORDER CREATION NOTIFICATION TO BUYER
      await OrderNotificationService.sendOrderNotification(
        userId: order.userId,
        orderId: orderId,
        orderNumber: order.orderNumber,
        title: 'Order Created',
        body: 'Your order #${order.orderNumber} has been created successfully!',
      );

      // 4️⃣ NOTIFY EACH SELLER ABOUT THEIR PORTION OF THE ORDER
      try {
        final sellerGroups = order.items.groupBySeller();
        
        for (final entry in sellerGroups.entries) {
          final sellerId = entry.key;
          final sellerItems = entry.value;
          
          // Skip if seller ID is unknown or empty
          if (sellerId == 'unknown' || sellerId.isEmpty) {
            debugPrint('⚠️ Skipping notification for unknown seller');
            continue;
          }
          
          // Calculate seller-specific totals
          final sellerTotal = sellerItems.fold(0.0, (sum, item) => sum + item.subtotal);
          final sellerItemCount = sellerItems.fold(0, (sum, item) => sum + item.quantity);
          
          // Get customer name from delivery address
          final customerName = order.deliveryAddress.name;
          
          debugPrint('📤 Notifying seller: $sellerId for $sellerItemCount items, total: ₹$sellerTotal');
          
          await OrderNotificationService.notifySellerNewOrder(
            sellerId: sellerId,
            orderId: orderId,
            orderNumber: order.orderNumber,
            total: sellerTotal,
            itemCount: sellerItemCount,
            customerName: customerName,
          );
        }
        
        debugPrint('✅ All seller notifications sent');
      } catch (sellerError) {
        // Don't fail the order if seller notification fails
        debugPrint('⚠️ Error notifying sellers: $sellerError');
      }

      // 5️⃣ TRACK SELLER ANALYTICS FOR EACH ITEM
      try {
        for (final item in order.items) {
          final sellerId = item.sellerId ?? order.sellerId;
          if (sellerId != null && sellerId.isNotEmpty && sellerId != 'unknown') {
            await SellerAnalyticsService.trackOrder(
              sellerId: sellerId,
              productId: item.productId,
              source: TrafficSource.organic,
              userId: order.userId,
              quantity: item.quantity,
              revenue: item.price * item.quantity,
            );
          }
        }
        debugPrint('📊 SellerAnalytics: Tracked order for ${order.items.length} items');
      } catch (analyticsError) {
        // Don't fail the order if analytics fails
        debugPrint('⚠️ Error tracking analytics: $analyticsError');
      }

      debugPrint('✅ Order created: $orderId (stock reduced, analytics tracked)');

      _isLoading = false;
      notifyListeners();
      return orderId;
    } catch (e) {
      debugPrint('❌ Error: $e');
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return null;
    }
  }

  Future<void> loadOrderById(String orderId) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      debugPrint('📦 Loading order: $orderId');

      final orderDoc = await _firestore
          .collection('orders')
          .doc(orderId)
          .get();

      if (orderDoc.exists) {
        _selectedOrder = OrderModel.fromMap(orderDoc.data()!, orderId);
        await _loadOrderTimeline(orderId);
        debugPrint('✅ Order loaded');
      } else {
        _error = '❌ Order not found';
      }

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      debugPrint('❌ Error: $e');
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _loadOrderTimeline(String orderId) async {
    try {
      _isLoadingTimeline = true;
      notifyListeners();

      final timelineQuery = await _firestore
          .collection('orders')
          .doc(orderId)
          .collection('timeline')
          .orderBy('timestamp', descending: true)
          .get();

      _selectedOrderTimeline = timelineQuery.docs
          .map((doc) => OrderTimelineModel.fromMap(doc.data()))
          .toList();

      debugPrint('✅ Loaded ${_selectedOrderTimeline.length} timeline events');
      _isLoadingTimeline = false;
      notifyListeners();
    } catch (e) {
      debugPrint('❌ Error: $e');
      _isLoadingTimeline = false;
      notifyListeners();
    }
  }

  List<OrderModel> getOrdersByStatus(String status) {
    return _orders
        .where((order) => order.orderStatus.toLowerCase() == status.toLowerCase())
        .toList();
  }

  List<OrderModel> get pendingOrders {
    return _orders
        .where((order) =>
            order.orderStatus == 'pending' ||
            order.orderStatus == 'confirmed' ||
            order.orderStatus == 'processing')
        .toList();
  }

  List<OrderModel> get activeOrders {
    return _orders
        .where((order) =>
            order.orderStatus != 'delivered' &&
            order.orderStatus != 'cancelled' &&
            order.orderStatus != 'refunded')
        .toList();
  }

  List<OrderModel> get completedOrders {
    return _orders
        .where((order) =>
            order.orderStatus == 'delivered' ||
            order.orderStatus == 'completed')
        .toList();
  }

  List<OrderModel> get cancelledOrders {
    return _orders
        .where((order) => order.orderStatus == 'cancelled')
        .toList();
  }

  List<OrderModel> get refundedOrders {
    return _orders.where((order) => order.orderStatus == 'refunded').toList();
  }

  Future<bool> cancelOrder(String orderId, String reason) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      debugPrint('❌ Cancelling order: $orderId');

      // 1️⃣ Get the order details first (for stock restoration)
      final orderDoc = await _firestore.collection('orders').doc(orderId).get();
      if (!orderDoc.exists) {
        throw Exception('Order not found');
      }
      final orderToCancel = OrderModel.fromMap(orderDoc.data()!, orderId);

      // 2️⃣ RESTORE STOCK (NEW)
      debugPrint('📈 Restoring stock for cancelled order...');
      final stockRestored = await _stockService.restoreStock(orderToCancel.items);
      if (stockRestored) {
        debugPrint('✅ Stock restored successfully');
      } else {
        debugPrint('⚠️ Stock restoration failed, continuing with cancellation');
      }

      // 3️⃣ Update order status
      await _firestore.collection('orders').doc(orderId).update({
        'orderStatus': 'cancelled',
        'updatedAt': FieldValue.serverTimestamp(),
        'cancellationReason': reason,
        'stockRestored': stockRestored,
      });

      // 4️⃣ Add timeline entry
      await _firestore
          .collection('orders')
          .doc(orderId)
          .collection('timeline')
          .add({
        'status': 'cancelled',
        'title': 'Order Cancelled',
        'description': reason,
        'timestamp': FieldValue.serverTimestamp(),
      });

      // 5️⃣ SEND CANCELLATION NOTIFICATION
      await OrderNotificationService.sendCancellationNotification(
        userId: orderToCancel.userId,
        orderId: orderId,
        orderNumber: orderToCancel.orderNumber,
        reason: reason,
      );

      await loadOrderById(orderId);

      debugPrint('✅ Order cancelled (stock restored: $stockRestored)');
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('❌ Error: $e');
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateOrderStatus(
    String orderId,
    String newStatus, {
    String? description,
  }) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      debugPrint('📦 Updating order status: $orderId -> $newStatus');

      await _firestore.collection('orders').doc(orderId).update({
        'orderStatus': newStatus,
        'updatedAt': FieldValue.serverTimestamp(),
      });

      final timelineData = {
        'status': newStatus,
        'title': _getStatusTitle(newStatus),
        'description': description ?? _getStatusDescription(newStatus),
        'timestamp': FieldValue.serverTimestamp(),
      };

      await _firestore
          .collection('orders')
          .doc(orderId)
          .collection('timeline')
          .add(timelineData);

      // ✅ SEND STATUS UPDATE NOTIFICATION
      final order = _selectedOrder;
      if (order != null) {
        await OrderNotificationService.sendOrderStatusNotification(
          userId: order.userId,
          orderId: orderId,
          orderNumber: order.orderNumber,
          status: newStatus,
          statusMessage: description ?? _getStatusDescription(newStatus),
        );
      }

      await loadOrderById(orderId);

      debugPrint('✅ Order status updated');
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('❌ Error: $e');
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  String _getStatusTitle(String status) {
    switch (status) {
      case 'pending':
        return 'Order Pending';
      case 'confirmed':
        return 'Order Confirmed';
      case 'processing':
        return 'Processing Order';
      case 'shipped':
        return 'Order Shipped';
      case 'delivered':
        return 'Order Delivered';
      case 'cancelled':
        return 'Order Cancelled';
      case 'refunded':
        return 'Refund Processed';
      default:
        return 'Order Updated';
    }
  }

  String _getStatusDescription(String status) {
    switch (status) {
      case 'pending':
        return 'Your order is awaiting confirmation.';
      case 'confirmed':
        return 'Your order has been confirmed by the seller.';
      case 'processing':
        return 'Your order is being prepared for shipment.';
      case 'shipped':
        return 'Your order has been shipped and is on the way.';
      case 'delivered':
        return 'Your order has been delivered successfully.';
      case 'cancelled':
        return 'Your order has been cancelled.';
      case 'refunded':
        return 'Your refund has been processed.';
      default:
        return 'Your order has been updated.';
    }
  }

  Future<bool> returnOrder(String orderId, String reason) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      debugPrint('🔄 Initiating return for order: $orderId');

      await _firestore.collection('orders').doc(orderId).update({
        'orderStatus': 'returned',
        'updatedAt': FieldValue.serverTimestamp(),
        'returnReason': reason,
        'returnInitiatedAt': FieldValue.serverTimestamp(),
      });

      await _firestore
          .collection('orders')
          .doc(orderId)
          .collection('timeline')
          .add({
        'status': 'returned',
        'title': 'Return Initiated',
        'description': reason,
        'timestamp': FieldValue.serverTimestamp(),
      });

      await loadOrderById(orderId);

      debugPrint('✅ Return initiated');
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('❌ Error: $e');
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  List<OrderModel> searchOrders(String query) {
    final lowerQuery = query.toLowerCase();
    return _orders
        .where((order) =>
            order.orderNumber.toLowerCase().contains(lowerQuery) ||
            order.id.toLowerCase().contains(lowerQuery))
        .toList();
  }

  Map<String, int> getOrderStatistics() {
    int pending = 0;
    int processing = 0;
    int shipped = 0;
    int delivered = 0;
    int cancelled = 0;

    for (var order in _orders) {
      switch (order.orderStatus.toLowerCase()) {
        case 'pending':
        case 'confirmed':
          pending++;
          break;
        case 'processing':
          processing++;
          break;
        case 'shipped':
        case 'outfordelivery':
          shipped++;
          break;
        case 'delivered':
        case 'completed':
          delivered++;
          break;
        case 'cancelled':
          cancelled++;
          break;
      }
    }

    return {
      'total': _orders.length,
      'pending': pending,
      'processing': processing,
      'shipped': shipped,
      'delivered': delivered,
      'cancelled': cancelled,
    };
  }

  double getTotalSales() {
    double total = 0.0;
    for (var order in _orders) {
      final status = order.orderStatus.toLowerCase();
      final paymentStatus = order.paymentStatus.toLowerCase();

      if (status == 'delivered' || status == 'completed') {
        total += order.total;
      } else if (status == 'refunded') {
        total -= order.total;
      } else if (status == 'cancelled' && paymentStatus == 'paid') {
        total -= order.total;
      }
    }
    return total;
  }

  void clearSelectedOrder() {
    _selectedOrder = null;
    _selectedOrderTimeline.clear();
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _ordersSubscription?.cancel();
    _orders.clear();
    _selectedOrder = null;
    _selectedOrderTimeline.clear();
    super.dispose();
  }
}