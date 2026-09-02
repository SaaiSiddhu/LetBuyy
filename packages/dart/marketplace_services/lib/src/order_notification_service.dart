// lib/services/order_notification_service.dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';  // ✅ ADDED: For push notifications
import 'package:flutter/material.dart';

class OrderNotificationService {
  static final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  static final FirebaseFunctions _functions = FirebaseFunctions.instance;  // ✅ ADDED: For push notifications
  
  // ✅ Deep link base URL
  static const String _baseUrl = 'https://letbuy-y.web.app';

  // ============================================
  // ✅ SEND ORDER CREATION NOTIFICATION
  // ============================================
  static Future<void> sendOrderNotification({
    required String userId,
    required String orderId,
    required String orderNumber,
    required String title,
    required String body,
    String? imageUrl,
  }) async {
    try {
      debugPrint('📤 Sending order notification - Order: $orderId');

      // Generate deep link
      final deepLink = '$_baseUrl/orders/$orderId';

      // Save notification to Firestore
      await _firestore.collection('notifications').add({
        'userId': userId,
        'orderId': orderId,
        'orderNumber': orderNumber,
        'title': title,
        'body': body,
        'type': 'order',
        'actionUrl': deepLink,
        'imageUrl': imageUrl,
        'timestamp': FieldValue.serverTimestamp(),
        'read': false,
      });

      debugPrint('✅ Order notification saved');
    } catch (e) {
      debugPrint('❌ Error sending notification: $e');
    }
  }

  // ============================================
  // ✅ SEND ORDER STATUS UPDATE NOTIFICATION
  // ============================================
  static Future<void> sendOrderStatusNotification({
    required String userId,
    required String orderId,
    required String orderNumber,
    required String status,
    required String statusMessage,
  }) async {
    try {
      debugPrint('📤 Order status update - Order: $orderId, Status: $status');

      final titleMap = {
        'pending': '📦 Order Pending',
        'confirmed': '✅ Order Confirmed',
        'processing': '⚙️ Processing',
        'shipped': '🚚 Shipped',
        'outfordelivery': '📍 Out for Delivery',
        'delivered': '✅ Delivered',
        'cancelled': '❌ Cancelled',
        'refunded': '💰 Refunded',
        'returned': '↩️ Return Initiated',
      };

      final title = titleMap[status.toLowerCase()] ?? 'Order Update';
      final deepLink = '$_baseUrl/orders/$orderId';

      await _firestore.collection('notifications').add({
        'userId': userId,
        'orderId': orderId,
        'orderNumber': orderNumber,
        'title': title,
        'body': statusMessage,
        'type': 'order_update',
        'status': status,
        'actionUrl': deepLink,
        'timestamp': FieldValue.serverTimestamp(),
        'read': false,
      });

      debugPrint('✅ Status notification saved');
    } catch (e) {
      debugPrint('❌ Error: $e');
    }
  }

  // ============================================
  // ✅ SEND TRACKING UPDATE NOTIFICATION
  // ============================================
  static Future<void> sendTrackingNotification({
    required String userId,
    required String orderId,
    required String title,
    required String message,
    String? trackingNumber,
    String? carrier,
  }) async {
    try {
      debugPrint('📤 Tracking notification - Order: $orderId');

      final deepLink = '$_baseUrl/track/$orderId';

      await _firestore.collection('notifications').add({
        'userId': userId,
        'orderId': orderId,
        'title': title,
        'body': message,
        'type': 'tracking',
        'trackingNumber': trackingNumber,
        'carrier': carrier,
        'actionUrl': deepLink,
        'timestamp': FieldValue.serverTimestamp(),
        'read': false,
      });

      debugPrint('✅ Tracking notification saved');
    } catch (e) {
      debugPrint('❌ Error: $e');
    }
  }

  // ============================================
  // ✅ SEND DELIVERY NOTIFICATION
  // ============================================
  static Future<void> sendDeliveryNotification({
    required String userId,
    required String orderId,
    required String orderNumber,
  }) async {
    try {
      debugPrint('📤 Delivery notification - Order: $orderId');

      final deepLink = '$_baseUrl/orders/$orderId';

      await _firestore.collection('notifications').add({
        'userId': userId,
        'orderId': orderId,
        'orderNumber': orderNumber,
        'title': '✅ Order Delivered',
        'body': 'Your order #$orderNumber has been delivered successfully! Thank you for shopping with us.',
        'type': 'delivered',
        'actionUrl': deepLink,
        'timestamp': FieldValue.serverTimestamp(),
        'read': false,
      });

      debugPrint('✅ Delivery notification saved');
    } catch (e) {
      debugPrint('❌ Error: $e');
    }
  }

  // ============================================
  // ✅ SEND CANCELLATION NOTIFICATION
  // ============================================
  static Future<void> sendCancellationNotification({
    required String userId,
    required String orderId,
    required String orderNumber,
    required String reason,
  }) async {
    try {
      debugPrint('📤 Cancellation notification - Order: $orderId');

      final deepLink = '$_baseUrl/orders/$orderId';

      await _firestore.collection('notifications').add({
        'userId': userId,
        'orderId': orderId,
        'orderNumber': orderNumber,
        'title': '❌ Order Cancelled',
        'body': 'Your order #$orderNumber has been cancelled. Reason: $reason',
        'type': 'cancelled',
        'reason': reason,
        'actionUrl': deepLink,
        'timestamp': FieldValue.serverTimestamp(),
        'read': false,
      });

      debugPrint('✅ Cancellation notification saved');
    } catch (e) {
      debugPrint('❌ Error: $e');
    }
  }

  // ============================================
  // ✅ SEND REFUND NOTIFICATION
  // ============================================
  static Future<void> sendRefundNotification({
    required String userId,
    required String orderId,
    required String orderNumber,
    required double refundAmount,
  }) async {
    try {
      debugPrint('📤 Refund notification - Order: $orderId');

      final deepLink = '$_baseUrl/orders/$orderId';

      await _firestore.collection('notifications').add({
        'userId': userId,
        'orderId': orderId,
        'orderNumber': orderNumber,
        'title': '💰 Refund Processed',
        'body': 'Refund of ₹${refundAmount.toStringAsFixed(2)} for order #$orderNumber has been initiated to your account.',
        'type': 'refund',
        'refundAmount': refundAmount,
        'actionUrl': deepLink,
        'timestamp': FieldValue.serverTimestamp(),
        'read': false,
      });

      debugPrint('✅ Refund notification saved');
    } catch (e) {
      debugPrint('❌ Error: $e');
    }
  }

  // ============================================
  // ✅ SEND SHIPPING NOTIFICATION
  // ============================================
  static Future<void> sendShippingNotification({
    required String userId,
    required String orderId,
    required String orderNumber,
    String? trackingNumber,
    String? carrier,
    String? estimatedDelivery,
  }) async {
    try {
      debugPrint('📤 Shipping notification - Order: $orderId');

      String body = 'Your order #$orderNumber has been shipped and is on its way!';
      if (trackingNumber != null && trackingNumber.isNotEmpty) {
        body += '\n\nTracking Number: $trackingNumber';
      }
      if (carrier != null && carrier.isNotEmpty) {
        body += '\nCarrier: $carrier';
      }
      if (estimatedDelivery != null && estimatedDelivery.isNotEmpty) {
        body += '\nEstimated Delivery: $estimatedDelivery';
      }

      final deepLink = '$_baseUrl/track/$orderId';

      await _firestore.collection('notifications').add({
        'userId': userId,
        'orderId': orderId,
        'orderNumber': orderNumber,
        'title': '🚚 Order Shipped!',
        'body': body,
        'type': 'shipped',
        'trackingNumber': trackingNumber,
        'carrier': carrier,
        'estimatedDelivery': estimatedDelivery,
        'actionUrl': deepLink,
        'timestamp': FieldValue.serverTimestamp(),
        'read': false,
      });

      debugPrint('✅ Shipping notification saved');
    } catch (e) {
      debugPrint('❌ Error: $e');
    }
  }

  // ============================================
  // ✅ NOTIFY SELLER OF NEW ORDER
  // ============================================
  static Future<void> notifySellerNewOrder({
    required String sellerId,
    required String orderId,
    required String orderNumber,
    required double total,
    required int itemCount,
    String? customerName,
  }) async {
    try {
      debugPrint('📤 Notifying seller $sellerId of new order $orderNumber');

      final deepLink = '$_baseUrl/seller/orders/$orderId';

      String body = 'You have a new order #$orderNumber worth ₹${total.toStringAsFixed(2)} with $itemCount item(s).';
      if (customerName != null && customerName.isNotEmpty) {
        body += '\nCustomer: $customerName';
      }

      // ✅ 1. Save notification to Firestore (for in-app notification)
      await _firestore.collection('notifications').add({
        'userId': sellerId,
        'orderId': orderId,
        'orderNumber': orderNumber,
        'title': '🛒 New Order Received!',
        'body': body,
        'type': 'new_order',
        'total': total,
        'itemCount': itemCount,
        'customerName': customerName,
        'actionUrl': deepLink,
        'timestamp': FieldValue.serverTimestamp(),
        'read': false,
      });

      debugPrint('✅ Seller notification saved to Firestore');

      // ✅ 2. Call Firebase Function for push notification
      try {
        final callable = _functions.httpsCallable('sendNewOrderNotificationToSeller');
        final result = await callable.call({
          'sellerId': sellerId,
          'orderId': orderId,
          'orderNumber': orderNumber,
          'orderTotal': total,
          'itemCount': itemCount,
          'customerName': customerName,
        });
        
        final data = result.data as Map<String, dynamic>;
        debugPrint('📱 Push notification sent: ${data['successCount']} success, ${data['failureCount']} failed');
      } catch (pushError) {
        // Don't fail the order if push notification fails
        debugPrint('⚠️ Push notification failed (non-critical): $pushError');
      }
    } catch (e) {
      debugPrint('❌ Error notifying seller: $e');
    }
  }

  // ============================================
  // ✅ NOTIFY SELLER OF ORDER CANCELLATION
  // ============================================
  static Future<void> notifySellerOrderCancelled({
    required String sellerId,
    required String orderId,
    required String orderNumber,
    required String reason,
    required double total,
  }) async {
    try {
      debugPrint('📤 Notifying seller $sellerId of cancelled order $orderNumber');

      final deepLink = '$_baseUrl/seller/orders/$orderId';

      await _firestore.collection('notifications').add({
        'userId': sellerId,
        'orderId': orderId,
        'orderNumber': orderNumber,
        'title': '❌ Order Cancelled',
        'body': 'Order #$orderNumber (₹${total.toStringAsFixed(2)}) has been cancelled. Reason: $reason',
        'type': 'order_cancelled',
        'reason': reason,
        'total': total,
        'actionUrl': deepLink,
        'timestamp': FieldValue.serverTimestamp(),
        'read': false,
      });

      debugPrint('✅ Seller cancellation notification saved');
    } catch (e) {
      debugPrint('❌ Error: $e');
    }
  }

  // ============================================
  // ✅ NOTIFY SELLER OF RETURN REQUEST
  // ============================================
  static Future<void> notifySellerReturnRequest({
    required String sellerId,
    required String orderId,
    required String orderNumber,
    required String reason,
    required int itemCount,
  }) async {
    try {
      debugPrint('📤 Notifying seller $sellerId of return request for $orderNumber');

      final deepLink = '$_baseUrl/seller/orders/$orderId';

      await _firestore.collection('notifications').add({
        'userId': sellerId,
        'orderId': orderId,
        'orderNumber': orderNumber,
        'title': '↩️ Return Request',
        'body': 'Customer has requested a return for $itemCount item(s) from order #$orderNumber. Reason: $reason',
        'type': 'return_request',
        'reason': reason,
        'itemCount': itemCount,
        'actionUrl': deepLink,
        'timestamp': FieldValue.serverTimestamp(),
        'read': false,
      });

      debugPrint('✅ Seller return notification saved');
    } catch (e) {
      debugPrint('❌ Error: $e');
    }
  }

  // ============================================
  // ✅ MARK NOTIFICATION AS READ
  // ============================================
  static Future<void> markNotificationAsRead(String notificationId) async {
    try {
      await _firestore.collection('notifications').doc(notificationId).update({
        'read': true,
        'readAt': FieldValue.serverTimestamp(),
      });
      debugPrint('✅ Notification marked as read');
    } catch (e) {
      debugPrint('❌ Error: $e');
    }
  }

  // ============================================
  // ✅ MARK ALL NOTIFICATIONS AS READ
  // ============================================
  static Future<void> markAllAsRead(String userId) async {
    try {
      final batch = _firestore.batch();
      
      final notifications = await _firestore
          .collection('notifications')
          .where('userId', isEqualTo: userId)
          .where('read', isEqualTo: false)
          .get();

      for (final doc in notifications.docs) {
        batch.update(doc.reference, {
          'read': true,
          'readAt': FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();
      debugPrint('✅ All notifications marked as read (${notifications.docs.length})');
    } catch (e) {
      debugPrint('❌ Error marking all as read: $e');
    }
  }

  // ============================================
  // ✅ DELETE NOTIFICATION
  // ============================================
  static Future<void> deleteNotification(String notificationId) async {
    try {
      await _firestore.collection('notifications').doc(notificationId).delete();
      debugPrint('✅ Notification deleted');
    } catch (e) {
      debugPrint('❌ Error deleting notification: $e');
    }
  }

  // ============================================
  // ✅ DELETE ALL NOTIFICATIONS FOR USER
  // ============================================
  static Future<void> deleteAllNotifications(String userId) async {
    try {
      final batch = _firestore.batch();
      
      final notifications = await _firestore
          .collection('notifications')
          .where('userId', isEqualTo: userId)
          .get();

      for (final doc in notifications.docs) {
        batch.delete(doc.reference);
      }

      await batch.commit();
      debugPrint('✅ All notifications deleted (${notifications.docs.length})');
    } catch (e) {
      debugPrint('❌ Error deleting all notifications: $e');
    }
  }

  // ============================================
  // ✅ GET UNREAD COUNT
  // ============================================
  static Stream<int> getUnreadCount(String userId) {
    return _firestore
        .collection('notifications')
        .where('userId', isEqualTo: userId)
        .where('read', isEqualTo: false)
        .snapshots()
        .map((snapshot) => snapshot.docs.length);
  }

  // ============================================
  // ✅ GET USER NOTIFICATIONS
  // ============================================
  static Future<List<Map<String, dynamic>>> getUserNotifications(
    String userId, {
    int limit = 50,
  }) async {
    try {
      final query = await _firestore
          .collection('notifications')
          .where('userId', isEqualTo: userId)
          .orderBy('timestamp', descending: true)
          .limit(limit)
          .get();

      return query.docs.map((doc) {
        final data = doc.data();
        data['id'] = doc.id;
        return data;
      }).toList();
    } catch (e) {
      debugPrint('❌ Error fetching notifications: $e');
      return [];
    }
  }

  // ============================================
  // ✅ STREAM USER NOTIFICATIONS
  // ============================================
  static Stream<List<Map<String, dynamic>>> streamUserNotifications(
    String userId, {
    int limit = 50,
  }) {
    return _firestore
        .collection('notifications')
        .where('userId', isEqualTo: userId)
        .orderBy('timestamp', descending: true)
        .limit(limit)
        .snapshots()
        .map((query) => query.docs.map((doc) {
              final data = doc.data();
              data['id'] = doc.id;
              return data;
            }).toList());
  }

  // ============================================
  // ✅ GET ORDER NOTIFICATIONS
  // ============================================
  static Stream<List<Map<String, dynamic>>> streamOrderNotifications(
    String userId,
  ) {
    return _firestore
        .collection('notifications')
        .where('userId', isEqualTo: userId)
        .where('type', whereIn: [
          'order',
          'order_update',
          'shipped',
          'delivered',
          'cancelled',
          'refund',
          'tracking',
        ])
        .orderBy('timestamp', descending: true)
        .limit(30)
        .snapshots()
        .map((query) => query.docs.map((doc) {
              final data = doc.data();
              data['id'] = doc.id;
              return data;
            }).toList());
  }

  // ============================================
  // ✅ GET SELLER NOTIFICATIONS
  // ============================================
  static Stream<List<Map<String, dynamic>>> streamSellerNotifications(
    String sellerId,
  ) {
    return _firestore
        .collection('notifications')
        .where('userId', isEqualTo: sellerId)
        .where('type', whereIn: [
          'new_order',
          'order_cancelled',
          'return_request',
        ])
        .orderBy('timestamp', descending: true)
        .limit(50)
        .snapshots()
        .map((query) => query.docs.map((doc) {
              final data = doc.data();
              data['id'] = doc.id;
              return data;
            }).toList());
  }
}