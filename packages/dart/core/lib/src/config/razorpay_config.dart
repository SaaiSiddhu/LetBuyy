// lib/config/razorpay_config.dart
import 'package:flutter/foundation.dart';

class RazorpayConfig {
  static const String keyId = String.fromEnvironment('RAZORPAY_KEY_ID');
  
  static const String appName = 'LetBuyy';
  static const String currency = 'INR';
  static const int paymentTimeoutSeconds = 300;
  static const int maxRetries = 2;
  static const String themeColor = '#000000';
  
  static bool get isLiveMode => keyId.startsWith('rzp' '_live' '_');
  static String get paymentMode => isLiveMode ? 'LIVE' : 'TEST';
  
  static void logConfiguration() {
    if (kDebugMode) {
      debugPrint('Mode: $paymentMode');
      debugPrint('Key configured: ${keyId.isNotEmpty}');
    }
  }
}
