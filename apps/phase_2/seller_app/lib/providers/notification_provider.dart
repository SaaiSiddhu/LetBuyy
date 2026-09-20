// apps/seller/lib/providers/notification_provider.dart
// Provider for managing seller notifications

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

  NotificationModel({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    this.icon,
    required this.read,
    required this.createdAt,
    this.data,
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
    );
  }

  IconData get iconData {
    switch (icon ?? type) {
      case 'order':
      case 'new_order':
        return Icons.shopping_bag;
      case 'kyc_submitted':
      case 'kyc_approved':
      case 'verification':
      case 'verified':
        return Icons.verified_user;
      case 'kyc_rejected':
      case 'error':
        return Icons.error;
      case 'payment':
      case 'wallet_credit':
      case 'payout_completed':
        return Icons.account_balance_wallet;
      case 'withdrawal':
      case 'withdrawal_requested':
      case 'auto_payout':
        return Icons.payments;
      case 'payout_failed':
        return Icons.money_off;
      case 'login':
        return Icons.login;
      case 'product':
        return Icons.inventory;
      default:
        return Icons.notifications;
    }
  }

  Color get iconColor {
    switch (type) {
      case 'new_order':
        return Colors.blue;
      case 'kyc_approved':
        return Colors.green;
      case 'kyc_rejected':
      case 'payout_failed':
        return Colors.red;
      case 'payment':
      case 'wallet_credit':
      case 'payout_completed':
        return Colors.green;
      case 'withdrawal':
      case 'withdrawal_requested':
      case 'auto_payout':
        return Colors.orange;
      case 'login':
        return Colors.purple;
      default:
        return Colors.grey;
    }
  }
}

class NotificationProvider extends ChangeNotifier {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  List<NotificationModel> _notifications = [];
  bool _isLoading = false;
  int _unreadCount = 0;
  StreamSubscription? _notificationSubscription;

  List<NotificationModel> get notifications => _notifications;
  bool get isLoading => _isLoading;
  int get unreadCount => _unreadCount;

  String? get _sellerId => _auth.currentUser?.uid;

  // Initialize and listen to notifications
  void initNotifications() {
    debugPrint('🔔 NotificationProvider.initNotifications called');
    if (_sellerId == null) {
      debugPrint('🔔 No seller ID - skipping notifications');
      return;
    }

    debugPrint('🔔 Setting up notification listener for sellerId: $_sellerId');
    _notificationSubscription?.cancel();
    
    // Simplified query - just filter by userId, filter userType locally
    _notificationSubscription = _firestore
        .collection('notifications')
        .where('userId', isEqualTo: _sellerId)
        .orderBy('createdAt', descending: true)
        .limit(50)
        .snapshots()
        .listen((snapshot) {
          debugPrint('🔔 Received ${snapshot.docs.length} notifications from Firestore');
          _notifications = snapshot.docs
              .map((doc) => NotificationModel.fromFirestore(doc))
              .where((n) => true) // Accept all types
              .toList();
          _unreadCount = _notifications.where((n) => !n.read).length;
          debugPrint('🔔 Unread count: $_unreadCount');
          notifyListeners();
        }, onError: (e) {
          debugPrint('🔔 Notification stream error: $e');
        });
  }

  // Load notifications manually
  Future<void> loadNotifications() async {
    debugPrint('🔔 loadNotifications called for sellerId: $_sellerId');
    if (_sellerId == null) return;

    _isLoading = true;
    notifyListeners();

    try {
      final snapshot = await _firestore
          .collection('notifications')
          .where('userId', isEqualTo: _sellerId)
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
      
      // Update local state
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
    if (_sellerId == null) return;

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
    if (_sellerId == null) return;

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
