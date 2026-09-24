import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';

/// Utility class for web-specific performance optimizations.
/// 
/// Flutter Web uses a canvas renderer that handles animations differently
/// than native platforms. This class provides helpers to conditionally
/// reduce animation complexity on web for better performance.
class WebOptimizations {
  /// Returns true if running on web platform
  static bool get isWeb => kIsWeb;
  
  /// Returns true if heavy animations should be reduced
  /// (Currently only on web, but could be extended for low-end devices)
  static bool get reduceAnimations => kIsWeb;
  
  /// Returns a reduced animation duration for web
  /// On web: instant or very short
  /// On mobile: full duration
  static Duration animationDuration(Duration normal) {
    if (kIsWeb) {
      // Very short duration for subtle feedback, not jarring instant
      return normal.inMilliseconds > 200 
          ? const Duration(milliseconds: 100) 
          : Duration.zero;
    }
    return normal;
  }
  
  /// Returns null duration for web (disables animation) 
  /// or the provided duration for mobile
  static Duration? optionalDuration(Duration mobile) {
    return kIsWeb ? null : mobile;
  }
  
  /// Conditionally applies flutter_animate extension
  /// Returns the widget as-is on web, animated on mobile
  static Widget conditionalAnimate(
    Widget widget,
    Widget Function(Widget) animator,
  ) {
    return kIsWeb ? widget : animator(widget);
  }
  
  /// Wraps a widget in RepaintBoundary for performance
  /// Essential for list items and animated elements
  static Widget repaintBoundary(Widget child) {
    return RepaintBoundary(child: child);
  }
  
  /// Returns optimized image dimensions for web
  /// Web doesn't need full resolution images
  static int? imageCacheWidth(int? original) {
    if (!kIsWeb || original == null) return original;
    return original > 400 ? 400 : original;
  }
}
