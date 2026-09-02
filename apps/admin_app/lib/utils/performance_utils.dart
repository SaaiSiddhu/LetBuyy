// lib/utils/performance_utils.dart
// 🚀 Cross-Browser Performance Optimization Utilities
// Provides centralized detection and configuration for browser-specific optimizations

import 'package:flutter/foundation.dart' show kIsWeb, defaultTargetPlatform, TargetPlatform;

/// Centralized utility class for performance optimizations across browsers.
/// 
/// This class provides detection for mobile web browsers and controls
/// animation behavior to prevent flickering and lag on different browsers.
class PerformanceUtils {
  // Private constructor to prevent instantiation
  PerformanceUtils._();
  
  /// Returns true if running on mobile web (iOS Safari, Chrome Mobile, etc.)
  /// This includes any mobile browser accessing the Flutter web app.
  static bool get isMobileWeb => kIsWeb && 
    (defaultTargetPlatform == TargetPlatform.iOS || 
     defaultTargetPlatform == TargetPlatform.android);
  
  /// Returns true if running on desktop web (Chrome, Firefox, Safari, Edge on desktop)
  static bool get isDesktopWeb => kIsWeb && 
    (defaultTargetPlatform != TargetPlatform.iOS && 
     defaultTargetPlatform != TargetPlatform.android);
  
  /// Returns true if animations should be reduced for performance
  /// This is true for mobile web browsers to prevent lag and flickering
  static bool get shouldReduceAnimations => isMobileWeb;
  
  /// Returns true if continuous/repeating animations should be disabled
  /// Continuous animations cause significant performance issues on mobile web
  static bool get shouldDisableContinuousAnimations => isMobileWeb;
  
  /// Returns animation duration multiplier
  /// - 1.0 = normal speed (desktop)
  /// - 0.5 = faster animations (mobile web - less time to render)
  /// - 0.0 = instant (for severely underpowered devices)
  static double get animationDurationMultiplier => isMobileWeb ? 0.5 : 1.0;
  
  /// Returns opacity for background decorative elements
  /// Lower opacity = less GPU work on mobile browsers
  static double get decorativeElementOpacity => isMobileWeb ? 0.5 : 1.0;
  
  /// Returns whether complex gradients should be simplified
  static bool get shouldSimplifyGradients => isMobileWeb;
  
  /// Returns whether box shadows should be reduced
  /// Heavy shadows cause rendering lag on some mobile browsers
  static bool get shouldReduceShadows => isMobileWeb;
  
  /// Returns the maximum number of animated elements to show on mobile
  static int get maxAnimatedElements => isMobileWeb ? 2 : 10;
  
  /// Helper to conditionally start an animation controller
  /// Only starts repeating animations on non-mobile-web platforms
  static void startAnimationIfAllowed(
    dynamic controller, {
    bool reverse = false,
  }) {
    if (!shouldDisableContinuousAnimations) {
      if (reverse) {
        controller.repeat(reverse: true);
      } else {
        controller.repeat();
      }
    }
  }
  
  /// Returns a Duration adjusted for the platform
  static Duration adjustDuration(Duration original) {
    return Duration(
      milliseconds: (original.inMilliseconds * animationDurationMultiplier).round(),
    );
  }
}
