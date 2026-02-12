import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

// Background message handler
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  print('📩 Background message: ${message.notification?.title}');
}

class FCMService {
  static final FCMService _instance = FCMService._internal();
  factory FCMService() => _instance;
  FCMService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  
  // Store the current token for later use
  String? _currentToken;
  String? get currentToken => _currentToken;

  // ✅ Your VAPID key
  static const String _vapidKey = 'BOe57aGDa_k374ps-OOGLibtGfUpFdYEpCbD-gfzOvXmSHkDIzm63T9N8u7bRxinGM8XpbwcE_dMbWyPd8J_QKY';

  Future<void> initialize() async {
    print('🔔 Initializing FCM...');

    // Request permission (iOS & Android 13+)
    NotificationSettings settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      print('✅ Notification permission granted');
    }

    // Initialize local notifications (for mobile)
    if (!kIsWeb) {
      const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosSettings = DarwinInitializationSettings();
      
      await _localNotifications.initialize(
        const InitializationSettings(
          android: androidSettings,
          iOS: iosSettings,
        ),
      );
    }

    // Get FCM token with VAPID key
    String? token;
    if (kIsWeb) {
      token = await _messaging.getToken(vapidKey: _vapidKey);
    } else {
      token = await _messaging.getToken();
    }
    
    _currentToken = token;
    print('🎫 FCM Token: $token');
    
    if (token != null) {
      await _saveTokenToFirestore(token);
    }

    // Listen for token refresh
    _messaging.onTokenRefresh.listen((newToken) {
      _currentToken = newToken;
      _saveTokenToFirestore(newToken);
    });

    // Handle background messages (mobile only)
    if (!kIsWeb) {
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    }

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('📬 Foreground message: ${message.notification?.title}');
      if (!kIsWeb) {
        _showLocalNotification(message);
      }
    });

    // Handle notification tap (app opened)
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      print('📱 Notification tapped: ${message.data}');
    });
  }

  Future<void> _saveTokenToFirestore(String token) async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) return;

      await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .set({
        'fcmTokens': FieldValue.arrayUnion([token]),
        'lastTokenUpdate': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));

      print('✅ Token saved to Firestore');
    } catch (e) {
      print('❌ Error saving token: $e');
    }
  }

  // ✅ NEW: Save FCM token for seller
  Future<void> saveSellerToken(String sellerId) async {
    try {
      // Get fresh token
      String? token;
      if (kIsWeb) {
        token = await _messaging.getToken(vapidKey: _vapidKey);
      } else {
        token = await _messaging.getToken();
      }
      
      if (token == null) {
        print('⚠️ No FCM token available for seller');
        return;
      }

      _currentToken = token;
      
      await FirebaseFirestore.instance
          .collection('sellers')
          .doc(sellerId)
          .set({
        'fcmTokens': FieldValue.arrayUnion([token]),
        'lastTokenUpdate': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));

      print('✅ Seller FCM token saved for: $sellerId');
    } catch (e) {
      print('❌ Error saving seller token: $e');
    }
  }

  // ✅ NEW: Remove seller token on logout
  Future<void> removeSellerToken(String sellerId) async {
    try {
      if (_currentToken == null) return;
      
      await FirebaseFirestore.instance
          .collection('sellers')
          .doc(sellerId)
          .update({
        'fcmTokens': FieldValue.arrayRemove([_currentToken]),
      });

      print('✅ Seller FCM token removed');
    } catch (e) {
      print('❌ Error removing seller token: $e');
    }
  }

  Future<void> _showLocalNotification(RemoteMessage message) async {
    const androidDetails = AndroidNotificationDetails(
      'default_channel',
      'Default Notifications',
      channelDescription: 'Default notification channel',
      importance: Importance.high,
      priority: Priority.high,
      showWhen: true,
    );

    const iosDetails = DarwinNotificationDetails();

    await _localNotifications.show(
      message.hashCode,
      message.notification?.title,
      message.notification?.body,
      const NotificationDetails(
        android: androidDetails,
        iOS: iosDetails,
      ),
    );
  }
}

