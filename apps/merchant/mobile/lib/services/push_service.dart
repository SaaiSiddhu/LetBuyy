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

class PushPermissionDenied implements Exception {
  const PushPermissionDenied();
}

enum PushRegistrationState {
  unavailable,
  permissionDenied,
  registering,
  registered,
  failed,
}

class PushService extends ChangeNotifier {
  PushService({required ApiClient api, PushTokenProvider? tokenProvider})
    : _api = api,
      _tokenProvider = tokenProvider;

  final ApiClient _api;
  final PushTokenProvider? _tokenProvider;

  PushRegistrationState _registrationState = PushRegistrationState.unavailable;
  PushRegistrationState get registrationState => _registrationState;

  final Set<String> _staleTokens = {};
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

    final previousToken = _lastAttempt?.token;
    _lastAttempt = PushDeviceRegistration(
      token: normalizedToken,
      platform: platform ?? currentPlatform(),
      deviceName: deviceName,
    );
    _registrationState = PushRegistrationState.registering;
    notifyListeners();
    try {
      await _api.notifications.registerDeviceToken(_lastAttempt!.toJson());
      if (previousToken != null && previousToken != normalizedToken)
        _staleTokens.add(previousToken);
      for (final stale in _staleTokens.toList()) {
        await _api.notifications.unregisterDeviceToken(stale);
        _staleTokens.remove(stale);
      }
      _registrationState = PushRegistrationState.registered;
    } catch (_) {
      _registrationState = PushRegistrationState.failed;
      rethrow;
    } finally {
      notifyListeners();
    }
  }

  Future<void> unregisterDeviceToken(String token) async {
    if (token.trim().isEmpty) return;

    await _api.notifications.unregisterDeviceToken(token.trim());
    if (_lastAttempt?.token == token.trim()) {
      _registrationState = PushRegistrationState.unavailable;
      notifyListeners();
    }
  }

  Future<bool> registerCurrentDeviceToken({String? deviceName}) async {
    try {
      final token = (await _tokenProvider?.call())?.trim();
      if (token == null || token.isEmpty) {
        _lastCurrentDeviceRegistrationSkipped = true;
        _registrationState = PushRegistrationState.unavailable;
        notifyListeners();
        return false;
      }
      _lastCurrentDeviceRegistrationSkipped = false;
      await registerDeviceToken(token: token, deviceName: deviceName);
      return true;
    } on PushPermissionDenied {
      _registrationState = PushRegistrationState.permissionDenied;
      notifyListeners();
      return false;
    } catch (_) {
      // Background registration must never become an uncaught sign-in error.
      _registrationState = PushRegistrationState.failed;
      notifyListeners();
      return false;
    }
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
