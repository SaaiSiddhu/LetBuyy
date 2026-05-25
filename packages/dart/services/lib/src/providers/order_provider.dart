// ============================================================
// FILE 5: lib/providers/order_provider.dart - UPDATED
// ============================================================

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:letbuyy_models/src/order_model.dart';
import 'package:letbuyy_models/src/order_timeline_model.dart';
import '../auth_service.dart';


class OrderProvider with ChangeNotifier {
  final AuthService _authService = AuthService();
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

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
                     FirebaseAuth.instance.currentUser?.uid;
      
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
    _error = 'Orders must be created through the backend checkout workflow.';
    _isLoading = false;
    notifyListeners();
    return null;
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

  bool _blockOrderMutation(String message) {
    _error = message;
    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<bool> cancelOrder(String orderId, String reason) async {
    return _blockOrderMutation(
      'Order cancellation must use the backend order state machine.',
    );
  }

  Future<bool> updateOrderStatus(
    String orderId,
    String newStatus, {
    String? description,
  }) async {
    return _blockOrderMutation(
      'Order status changes must use the backend order state machine.',
    );
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
    return _blockOrderMutation(
      'Returns must use the backend returns workflow.',
    );
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
