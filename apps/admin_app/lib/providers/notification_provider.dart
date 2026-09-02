// apps/admin/lib/providers/notification_provider.dart
// 🔔 Provider for managing admin notifications

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
      case 'return_alert':
      case 'return_status':
        return Icons.assignment_return;
      case 'new_seller':
      case 'seller_verified':
        return Icons.store;
      case 'kyc_submitted':
        return Icons.verified_user;
      case 'fraud_alert':
        return Icons.warning;
      case 'order_alert':
        return Icons.shopping_bag;
      case 'payment_alert':
        return Icons.payment;
      case 'system_alert':
        return Icons.settings;
      default:
        return Icons.notifications;
    }
  }

  Color get iconColor {
    switch (type) {
      case 'return_alert':
      case 'return_status':
        return Colors.orange;
      case 'fraud_alert':
        return Colors.red;
      case 'new_seller':
      case 'seller_verified':
        return Colors.green;
      case 'kyc_submitted':
        return Colors.blue;
      case 'payment_alert':
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

  String? get _adminId => _auth.currentUser?.uid;

  // Initialize and listen to notifications
  void initNotifications() {
    debugPrint('🔔 Admin NotificationProvider.initNotifications called');
    if (_adminId == null) {
      debugPrint('🔔 No admin ID - skipping notifications');
      return;
    }

    debugPrint('🔔 Setting up notification listener for adminId: $_adminId');
    _notificationSubscription?.cancel();
    
    _notificationSubscription = _firestore
        .collection('notifications')
        .where('userId', isEqualTo: _adminId)
        .where('userType', isEqualTo: 'admin')
        .orderBy('createdAt', descending: true)
        .limit(50)
        .snapshots()
        .listen((snapshot) {
          debugPrint('🔔 Received ${snapshot.docs.length} admin notifications');
          _notifications = snapshot.docs
              .map((doc) => NotificationModel.fromFirestore(doc))
              .toList();
          _unreadCount = _notifications.where((n) => !n.read).length;
          debugPrint('🔔 Admin unread count: $_unreadCount');
          notifyListeners();
        }, onError: (e) {
          debugPrint('🔔 Admin notification stream error: $e');
          _initFallbackListener();
        });
  }

  void _initFallbackListener() {
    _notificationSubscription = _firestore
        .collection('notifications')
        .where('userId', isEqualTo: _adminId)
        .orderBy('createdAt', descending: true)
        .limit(50)
        .snapshots()
        .listen((snapshot) {
          _notifications = snapshot.docs
              .map((doc) => NotificationModel.fromFirestore(doc))
              .where((n) => n.type.contains('admin') || n.type.contains('alert') || n.type.contains('return'))
              .toList();
          _unreadCount = _notifications.where((n) => !n.read).length;
          notifyListeners();
        });
  }

  // Load notifications manually
  Future<void> loadNotifications() async {
    if (_adminId == null) return;

    _isLoading = true;
    notifyListeners();

    try {
      final snapshot = await _firestore
          .collection('notifications')
          .where('userId', isEqualTo: _adminId)
          .orderBy('createdAt', descending: true)
          .limit(50)
          .get();

      _notifications = snapshot.docs
          .map((doc) => NotificationModel.fromFirestore(doc))
          .toList();
      _unreadCount = _notifications.where((n) => !n.read).length;
    } catch (e) {
      debugPrint('🔔 Error loading admin notifications: $e');
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
    if (_adminId == null) return;

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
    if (_adminId == null) return;

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

  @override
  void dispose() {
    _notificationSubscription?.cancel();
    super.dispose();
  }
}
