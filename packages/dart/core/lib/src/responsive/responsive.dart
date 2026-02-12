import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'dart:io' show Platform;

/// Standard responsive widget based on screen width breakpoints
class Responsive extends StatelessWidget {
  final Widget mobile;
  final Widget? tablet;
  final Widget desktop;

  const Responsive({
    super.key,
    required this.mobile,
    this.tablet,
    required this.desktop,
  });

  // Breakpoints
  static const double mobileBreakpoint = 768;
  static const double desktopBreakpoint = 1200;

  static bool isMobile(BuildContext context) =>
      MediaQuery.sizeOf(context).width < mobileBreakpoint;

  static bool isTablet(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= mobileBreakpoint &&
      MediaQuery.sizeOf(context).width < desktopBreakpoint;

  static bool isDesktop(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= desktopBreakpoint;

  // Get current screen type
  static ScreenType getScreenType(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width < mobileBreakpoint) return ScreenType.mobile;
    if (width < desktopBreakpoint) return ScreenType.tablet;
    return ScreenType.desktop;
  }

  @override
  Widget build(BuildContext context) {
    final Size size = MediaQuery.sizeOf(context);
    
    // Desktop (>= 1200px)
    if (size.width >= desktopBreakpoint) {
      return desktop;
    }
    // Tablet (>= 768px and < 1200px)
    else if (size.width >= mobileBreakpoint) {
      return tablet ?? desktop;
    }
    // Mobile (< 768px)
    else {
      return mobile;
    }
  }
}

/// Platform-aware responsive widget supporting:
/// - Mobile (Android/iOS apps)
/// - Web (Browser - responsive to screen size)
/// - Desktop (macOS/Windows/Linux native apps)
class PlatformResponsive extends StatelessWidget {
  /// Widget for mobile devices (Android/iOS) - screen width < 768px
  final Widget mobile;
  
  /// Widget for tablet-sized screens - screen width 768-1200px
  /// Falls back to [web] if not provided
  final Widget? tablet;
  
  /// Widget for web browser on large screens - screen width >= 1200px
  final Widget web;
  
  /// Widget for native desktop apps (macOS/Windows/Linux)
  /// Falls back to [web] if not provided (shares layout as per user preference)
  final Widget? desktop;

  const PlatformResponsive({
    super.key,
    required this.mobile,
    this.tablet,
    required this.web,
    this.desktop,
  });

  /// Check if running on native desktop (not web)
  static bool isNativeDesktop() {
    if (kIsWeb) return false;
    try {
      return Platform.isMacOS || Platform.isWindows || Platform.isLinux;
    } catch (e) {
      return false;
    }
  }

  /// Check if running on native mobile (not web)
  static bool isNativeMobile() {
    if (kIsWeb) return false;
    try {
      return Platform.isAndroid || Platform.isIOS;
    } catch (e) {
      return false;
    }
  }

  /// Get the current platform type
  static PlatformType getPlatformType(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    
    // Native desktop app
    if (isNativeDesktop()) {
      return PlatformType.nativeDesktop;
    }
    
    // Native mobile app
    if (isNativeMobile()) {
      return PlatformType.nativeMobile;
    }
    
    // Web - determine by screen size
    if (width >= Responsive.desktopBreakpoint) {
      return PlatformType.webDesktop;
    } else if (width >= Responsive.mobileBreakpoint) {
      return PlatformType.webTablet;
    } else {
      return PlatformType.webMobile;
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    
    // Native desktop apps use desktop widget (falls back to web)
    if (isNativeDesktop()) {
      return desktop ?? web;
    }
    
    // Native mobile apps always use mobile widget
    if (isNativeMobile()) {
      return mobile;
    }
    
    // Web - responsive based on screen size
    if (size.width >= Responsive.desktopBreakpoint) {
      return web;
    } else if (size.width >= Responsive.mobileBreakpoint) {
      return tablet ?? web;
    } else {
      return mobile;
    }
  }
}

// Screen type enum (size-based)
enum ScreenType {
  mobile,
  tablet,
  desktop,
}

// Platform type enum (platform + size based)
enum PlatformType {
  nativeMobile,   // Android/iOS native app
  nativeDesktop,  // macOS/Windows/Linux native app
  webMobile,      // Web browser on small screen
  webTablet,      // Web browser on medium screen
  webDesktop,     // Web browser on large screen
}

// Helper extension for BuildContext
extension ResponsiveExtension on BuildContext {
  bool get isMobile => Responsive.isMobile(this);
  bool get isTablet => Responsive.isTablet(this);
  bool get isDesktop => Responsive.isDesktop(this);
  ScreenType get screenType => Responsive.getScreenType(this);
  PlatformType get platformType => PlatformResponsive.getPlatformType(this);
  bool get isNativeDesktop => PlatformResponsive.isNativeDesktop();
  bool get isNativeMobile => PlatformResponsive.isNativeMobile();
  bool get isWeb => kIsWeb;
}
