import 'dart:io';
import 'dart:async';

import 'package:flutter/foundation.dart';

import 'api_client.dart';

typedef PushTokenProvider = FutureOr<String?> Function();

enum PushDevicePlatform {
  android('android'),
  ios('ios'),
  web('web'),
  macos('macos'),
  windows('windows');

  const PushDevicePlatform(this.apiValue);

  final String apiValue;
}

class PushDeviceRegistration {
  const PushDeviceRegistration({
    required this.token,
    required this.platform,
    this.deviceName,
  });

  final String token;
  final PushDevicePlatform platform;
  final String? deviceName;

  Map<String, dynamic> toJson() => {
    'token': token,
    'platform': platform.apiValue,
    if (deviceName != null && deviceName!.trim().isNotEmpty)
      'device_name': deviceName!.trim(),
  };
}

class PushService extends ChangeNotifier {
  PushService({required ApiClient api, PushTokenProvider? tokenProvider})
    : _api = api,
      _tokenProvider = tokenProvider;

  final ApiClient _api;
  final PushTokenProvider? _tokenProvider;

  PushDeviceRegistration? _lastAttempt;
  PushDeviceRegistration? get lastAttempt => _lastAttempt;
  bool _lastCurrentDeviceRegistrationSkipped = false;
  bool get lastCurrentDeviceRegistrationSkipped =>
      _lastCurrentDeviceRegistrationSkipped;

  String get expectedRegistrationEndpoint =>
      '${_api.baseUrl}/notifications/device-tokens';

  Future<void> registerDeviceToken({
    required String token,
    PushDevicePlatform? platform,
    String? deviceName,
  }) async {
    final normalizedToken = token.trim();
    if (normalizedToken.isEmpty) {
      throw ArgumentError.value(token, 'token', 'Push token cannot be empty');
    }

    _lastAttempt = PushDeviceRegistration(
      token: normalizedToken,
      platform: platform ?? currentPlatform(),
      deviceName: deviceName,
    );
    notifyListeners();

    await _api.notifications.registerDeviceToken(_lastAttempt!.toJson());
  }

  Future<void> unregisterDeviceToken(String token) async {
    if (token.trim().isEmpty) return;

    await _api.notifications.unregisterDeviceToken(token.trim());
  }

  Future<bool> registerCurrentDeviceToken({String? deviceName}) async {
    final token = (await _tokenProvider?.call())?.trim();
    if (token == null || token.isEmpty) {
      _lastCurrentDeviceRegistrationSkipped = true;
      notifyListeners();
      return false;
    }

    _lastCurrentDeviceRegistrationSkipped = false;
    await registerDeviceToken(token: token, deviceName: deviceName);
    return true;
  }

  PushDevicePlatform currentPlatform() {
    if (kIsWeb) return PushDevicePlatform.web;
    if (Platform.isIOS) return PushDevicePlatform.ios;
    if (Platform.isAndroid) return PushDevicePlatform.android;
    if (Platform.isMacOS) return PushDevicePlatform.macos;
    if (Platform.isWindows) return PushDevicePlatform.windows;
    return PushDevicePlatform.android;
  }
}
