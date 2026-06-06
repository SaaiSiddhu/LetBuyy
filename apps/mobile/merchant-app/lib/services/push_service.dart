import 'dart:io';

import 'package:flutter/foundation.dart';

import 'api_client.dart';
import 'skip_needs_backend_exception.dart';

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
  PushService({required ApiClient api}) : _api = api;

  static const missingRegistrationRouteId =
      'MOBILE_PUSH_DEVICE_TOKEN_REGISTRATION';

  final ApiClient _api;

  PushDeviceRegistration? _lastAttempt;
  PushDeviceRegistration? get lastAttempt => _lastAttempt;

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

    // [SKIP-NEEDS-BACKEND: MOBILE_PUSH_DEVICE_TOKEN_REGISTRATION]
    throw const SkipNeedsBackendException(
      missingRegistrationRouteId,
      'Gateway route for inserting device_tokens is not implemented.',
    );
  }

  Future<void> unregisterDeviceToken(String token) async {
    if (token.trim().isEmpty) return;

    // [SKIP-NEEDS-BACKEND: MOBILE_PUSH_DEVICE_TOKEN_REGISTRATION]
    throw const SkipNeedsBackendException(
      missingRegistrationRouteId,
      'Gateway route for deleting device_tokens is not implemented.',
    );
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
