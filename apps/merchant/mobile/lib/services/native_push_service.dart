import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/app_config.dart';
import 'push_service.dart';

const _actorKey = 'merchant_push_actor';
const _androidSettings = AndroidInitializationSettings(
  '@drawable/ic_merchant_notification',
);
const _notificationDetails = NotificationDetails(
  android: AndroidNotificationDetails(
    'merchant_alerts',
    'Merchant alerts',
    channelDescription: 'Orders and store alerts',
    importance: Importance.high,
    priority: Priority.high,
  ),
);
FirebaseOptions get _firebaseOptions => const FirebaseOptions(
  apiKey: AppConfig.pushApiKey,
  appId: AppConfig.pushAppId,
  messagingSenderId: AppConfig.pushSenderId,
  projectId: AppConfig.pushProjectId,
);

Future<void> _display(
  FlutterLocalNotificationsPlugin plugin, {
  required String id,
  required String userId,
  required String title,
  required String body,
}) async {
  await plugin.show(
    id.hashCode & 0x7fffffff,
    title,
    body,
    _notificationDetails,
    payload: jsonEncode({'user_id': userId}),
  );
}

@pragma('vm:entry-point')
Future<void> merchantBackgroundPush(RemoteMessage message) async {
  if (!AppConfig.hasAndroidPushConfiguration) return;
  if (Firebase.apps.isEmpty)
    await Firebase.initializeApp(options: _firebaseOptions);
  final actor = await SharedPreferencesAsync().getString(_actorKey);
  // Data-only messages prevent Android auto-displaying another account's alert.
  if (actor == null || message.data['user_id'] != actor) return;
  final plugin = FlutterLocalNotificationsPlugin();
  await plugin.initialize(
    const InitializationSettings(android: _androidSettings),
  );
  await _display(
    plugin,
    id: message.messageId ?? '',
    userId: actor,
    title: message.data['title'] ?? 'LetBuyy',
    body: message.data['body'] ?? '',
  );
}

/// FCM is delivery only. Identity, device registration and inbox stay on LetBuyy.
class NativePushService {
  NativePushService({required this.actorId, required this.openInbox});
  final String? Function() actorId;
  final void Function() openInbox;
  final _plugin = FlutterLocalNotificationsPlugin();
  final List<StreamSubscription<dynamic>> _subscriptions = [];
  bool _ready = false;

  Future<bool> initialize() async {
    if (!Platform.isAndroid) return false;
    await _plugin.initialize(
      const InitializationSettings(android: _androidSettings),
      onDidReceiveNotificationResponse: (response) =>
          handleNotificationTap(response.payload),
    );
    if (!AppConfig.hasAndroidPushConfiguration) return false;
    if (Firebase.apps.isEmpty)
      await Firebase.initializeApp(options: _firebaseOptions);
    FirebaseMessaging.onBackgroundMessage(merchantBackgroundPush);
    _ready = true;
    return true;
  }

  Future<void> bindActor(String? actor) async {
    if (actor == null) {
      await SharedPreferencesAsync().remove(_actorKey);
      if (Platform.isAndroid) await _plugin.cancelAll();
    } else {
      await SharedPreferencesAsync().setString(_actorKey, actor);
    }
  }

  void listen({required Future<bool> Function() registerToken}) {
    if (!_ready) return;
    _subscriptions.add(
      FirebaseMessaging.instance.onTokenRefresh.listen((_) {
        if (actorId() != null) unawaited(registerToken());
      }, onError: (_) {}),
    );
    _subscriptions.add(
      FirebaseMessaging.onMessage.listen((message) {
        final actor = actorId();
        if (actor == null || message.data['user_id'] != actor) return;
        unawaited(
          showAlert(
            id: message.messageId ?? '',
            userId: actor,
            title: message.data['title'] ?? 'LetBuyy',
            body: message.data['body'] ?? '',
          ).catchError((_) {}),
        );
      }),
    );
  }

  Future<void> openInitialNotification() async {
    if (!Platform.isAndroid) return;
    final details = await _plugin.getNotificationAppLaunchDetails();
    if (details?.didNotificationLaunchApp == true)
      handleNotificationTap(details?.notificationResponse?.payload);
  }

  void handleNotificationTap(String? payload) {
    if (payload == null) return;
    try {
      final data = jsonDecode(payload);
      if (data is Map && data['user_id'] == actorId() && actorId() != null)
        openInbox();
    } catch (_) {
      /* Ignore malformed or stale notification payloads. */
    }
  }

  Future<bool> requestPermission() async =>
      await _plugin
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >()
          ?.requestNotificationsPermission() ??
      false;

  Future<String?> acquireToken() async {
    if (!_ready || actorId() == null) return null;
    if (!await requestPermission()) throw const PushPermissionDenied();
    return FirebaseMessaging.instance.getToken();
  }

  Future<void> showAlert({
    required String id,
    required String userId,
    required String title,
    required String body,
  }) async {
    if (actorId() != userId) return;
    await _display(_plugin, id: id, userId: userId, title: title, body: body);
  }

  Future<void> clearDevice() async {
    await bindActor(null);
    if (_ready) await FirebaseMessaging.instance.deleteToken();
  }

  Future<void> dispose() async {
    for (final subscription in _subscriptions) {
      await subscription.cancel();
    }
  }
}
