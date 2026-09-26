// apps/marketplace/lib/providers/notification_provider.dart
// 🔔 Provider for managing customer notifications

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class NotificationModel {
  final String id;
  final String type;
  final String title;
  final String body;
  final String? icon;
  final bool read;
  final DateTime createdAt;
  final Map<String, dynamic>? data;
  final String? actionUrl;

  NotificationModel({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    this.icon,
    required this.read,
    required this.createdAt,
    this.data,
    this.actionUrl,
  });

  factory NotificationModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return NotificationModel(
      id: doc.id,
      type: data['type'] ?? 'general',
      title: data['title'] ?? '',
      body: data['body'] ?? '',
      icon: data['icon'],
      read: data['read'] ?? false,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      data: data['data'],
      actionUrl: data['actionUrl'],
    );
  }

  IconData get iconData {
    switch (icon ?? type) {
      case 'order_update':
      case 'order_placed':
      case 'order_shipped':
        return Icons.local_shipping_outlined;
      case 'order_delivered':
        return Icons.check_circle_outline;
      case 'order_cancelled':
        return Icons.cancel_outlined;
      case 'return_status':
      case 'return_received':
      case 'return_approved':
        return Icons.assignment_return_outlined;
      case 'refund_completed':
        return Icons.account_balance_wallet_outlined;
      case 'exchange_shipped':
        return Icons.swap_horiz;
      case 'promotion':
      case 'offer':
        return Icons.local_offer_outlined;
      case 'wishlist':
        return Icons.favorite_outline;
      case 'review':
        return Icons.star_outline;
      default:
        return Icons.notifications_outlined;
    }
  }

  Color get iconColor {
    switch (type) {
      case 'order_delivered':
      case 'refund_completed':
      case 'return_approved':
        return Colors.green;
      case 'order_cancelled':
      case 'return_rejected':
        return Colors.red;
      case 'order_shipped':
      case 'exchange_shipped':
        return Colors.blue;
      case 'return_status':
      case 'return_received':
        return Colors.orange;
      case 'promotion':
      case 'offer':
        return Colors.purple;
      default:
        return Colors.grey;
    }
  }
}

class NotificationProvider extends ChangeNotifier {
  FirebaseFirestore get _firestore => FirebaseFirestore.instance;
  FirebaseAuth get _auth => FirebaseAuth.instance;

  List<NotificationModel> _notifications = [];
  bool _isLoading = false;
  int _unreadCount = 0;
  StreamSubscription? _notificationSubscription;

  List<NotificationModel> get notifications => _notifications;
  bool get isLoading => _isLoading;
  int get unreadCount => _unreadCount;

  String? get _userId => _auth.currentUser?.uid;

  // Initialize and listen to notifications
  void initNotifications() {
    debugPrint('🔔 NotificationProvider.initNotifications called');
    if (_userId == null) {
      debugPrint('🔔 No user ID - skipping notifications');
      return;
    }

    debugPrint('🔔 Setting up notification listener for userId: $_userId');
    _notificationSubscription?.cancel();
    
    _notificationSubscription = _firestore
        .collection('notifications')
        .where('userId', isEqualTo: _userId)
        .where('userType', isEqualTo: 'customer')
        .orderBy('createdAt', descending: true)
        .limit(50)
        .snapshots()
        .listen((snapshot) {
          debugPrint('🔔 Received ${snapshot.docs.length} notifications from Firestore');
          _notifications = snapshot.docs
              .map((doc) => NotificationModel.fromFirestore(doc))
              .toList();
          _unreadCount = _notifications.where((n) => !n.read).length;
          debugPrint('🔔 Unread count: $_unreadCount');
          notifyListeners();
        }, onError: (e) {
          debugPrint('🔔 Notification stream error: $e');
          // Fallback to simple query without userType filter
          _initFallbackListener();
        });
  }

  void _initFallbackListener() {
    _notificationSubscription = _firestore
        .collection('notifications')
        .where('userId', isEqualTo: _userId)
        .orderBy('createdAt', descending: true)
        .limit(50)
        .snapshots()
        .listen((snapshot) {
          _notifications = snapshot.docs
              .map((doc) => NotificationModel.fromFirestore(doc))
              .where((n) => true) // Accept all
              .toList();
          _unreadCount = _notifications.where((n) => !n.read).length;
          notifyListeners();
        });
  }

  // Load notifications manually
  Future<void> loadNotifications() async {
    debugPrint('🔔 loadNotifications called for userId: $_userId');
    if (_userId == null) return;

    _isLoading = true;
    notifyListeners();

    try {
      final snapshot = await _firestore
          .collection('notifications')
          .where('userId', isEqualTo: _userId)
          .orderBy('createdAt', descending: true)
          .limit(50)
          .get();

      debugPrint('🔔 Loaded ${snapshot.docs.length} notifications');
      _notifications = snapshot.docs
          .map((doc) => NotificationModel.fromFirestore(doc))
          .toList();
      _unreadCount = _notifications.where((n) => !n.read).length;
    } catch (e) {
      debugPrint('🔔 Error loading notifications: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Mark single notification as read
  Future<void> markAsRead(String notificationId) async {
    try {
      await _firestore.collection('notifications').doc(notificationId).update({
        'read': true,
      });
      
      final index = _notifications.indexWhere((n) => n.id == notificationId);
      if (index != -1 && !_notifications[index].read) {
        _unreadCount = (_unreadCount - 1).clamp(0, _notifications.length);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error marking notification as read: $e');
    }
  }

  // Mark all notifications as read
  Future<void> markAllAsRead() async {
    if (_userId == null) return;

    try {
      final batch = _firestore.batch();
      for (final notification in _notifications.where((n) => !n.read)) {
        batch.update(
          _firestore.collection('notifications').doc(notification.id),
          {'read': true},
        );
      }
      await batch.commit();
      
      _unreadCount = 0;
      notifyListeners();
    } catch (e) {
      debugPrint('Error marking all as read: $e');
    }
  }

  // Delete a notification
  Future<void> deleteNotification(String notificationId) async {
    try {
      await _firestore.collection('notifications').doc(notificationId).delete();
      _notifications.removeWhere((n) => n.id == notificationId);
      _unreadCount = _notifications.where((n) => !n.read).length;
      notifyListeners();
    } catch (e) {
      debugPrint('Error deleting notification: $e');
    }
  }

  // Clear all notifications
  Future<void> clearAllNotifications() async {
    if (_userId == null) return;

    try {
      final batch = _firestore.batch();
      for (final notification in _notifications) {
        batch.delete(_firestore.collection('notifications').doc(notification.id));
      }
      await batch.commit();
      
      _notifications.clear();
      _unreadCount = 0;
      notifyListeners();
    } catch (e) {
      debugPrint('Error clearing notifications: $e');
    }
  }

  // Filter notifications by type
  List<NotificationModel> filterByType(String type) {
    if (type == 'all') return _notifications;
    return _notifications.where((n) => n.type.contains(type)).toList();
  }

  @override
  void dispose() {
    _notificationSubscription?.cancel();
    super.dispose();
  }
}
