// lib/config/razorpay_config.dart
import 'package:flutter/foundation.dart';

class RazorpayConfig {
  // ✅ LIVE KEYS
  static const String keyId = String.fromEnvironment('RAZORPAY_KEY_ID');
  static const String keySecret = String.fromEnvironment('RAZORPAY_KEY_SECRET');
  
  static const String appName = 'AgriMate';
  static const String currency = 'INR';
  static const int paymentTimeoutSeconds = 300;
  static const int maxRetries = 2;
  static const String themeColor = '#2E7D32';
  
  static bool get isLiveMode => keyId.startsWith('rzp_live_');
  static String get paymentMode => isLiveMode ? '🔴 LIVE' : '🟡 TEST';
  
  static void logConfiguration() {
    if (kDebugMode) {
      debugPrint('═══════════════════════════════════');
      debugPrint('🔧 RAZORPAY CONFIGURATION');
      debugPrint('Mode: $paymentMode');
      debugPrint('Key: ${keyId.substring(0, 15)}...');
      debugPrint('═══════════════════════════════════');
    }
  }
}