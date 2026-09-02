// packages/core/lib/src/web/web_utils.dart
// 🌐 Web-specific utilities for mobile keyboard handling and platform detection

import 'dart:ui';
import 'package:flutter/foundation.dart' show kIsWeb, defaultTargetPlatform, TargetPlatform;

// Conditional import for JS interop
import 'web_utils_stub.dart' if (dart.library.js_interop) 'web_utils_js.dart' as js;

/// Web platform detection utilities
class WebUtils {
  WebUtils._();
  
  /// Check if running on web
  static bool get isWeb => kIsWeb;
  
  /// Check if running on mobile web (Android/iOS browser)
  static bool get isWebMobile {
    if (!kIsWeb) return false;
    return defaultTargetPlatform == TargetPlatform.iOS ||
           defaultTargetPlatform == TargetPlatform.android;
  }
  
  /// Check if running on desktop web (Windows/macOS/Linux browser)
  static bool get isWebDesktop {
    if (!kIsWeb) return false;
    return defaultTargetPlatform == TargetPlatform.windows ||
           defaultTargetPlatform == TargetPlatform.macOS ||
           defaultTargetPlatform == TargetPlatform.linux;
  }
  
  /// Get the full screen size from FlutterView (not affected by keyboard)
  /// This uses the physical size divided by device pixel ratio
  static Size getFullScreenSize(FlutterView view) {
    return view.physicalSize / view.devicePixelRatio;
  }
  
  /// Check if keyboard is currently visible
  static bool isKeyboardVisible(FlutterView view) {
    return view.viewInsets.bottom > 0;
  }
  
  /// Get keyboard height in logical pixels
  static double getKeyboardHeight(FlutterView view) {
    return view.viewInsets.bottom / view.devicePixelRatio;
  }
  
  /// Dispatch a resize event to force Flutter to recalculate layout
  /// This is useful for mobile web keyboard dismiss issues
  static void dispatchResizeEvent() {
    if (kIsWeb) {
      js.dispatchResizeEvent();
    }
  }
}
