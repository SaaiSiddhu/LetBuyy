// packages/core/lib/src/web/keyboard_handler.dart
// ⌨️ Mobile Web Keyboard Handler
// Detects keyboard open/close and provides callbacks for UI updates
// Uses WidgetsBindingObserver pattern with forced repaint on dismiss

import 'dart:async';
import 'dart:ui';
import 'package:flutter/widgets.dart';
import 'web_utils.dart';

/// Mixin that provides mobile web keyboard handling capabilities.
/// 
/// Use this mixin in StatefulWidget States that need to respond to
/// keyboard visibility changes on mobile web browsers.
/// 
/// Example:
/// ```dart
/// class _MyScreenState extends State<MyScreen> with MobileWebKeyboardHandler {
///   @override
///   void onKeyboardVisibilityChanged(bool isVisible) {
///     // Update UI when keyboard opens/closes
///     setState(() {});
///   }
/// }
/// ```
mixin MobileWebKeyboardHandler<T extends StatefulWidget> on State<T> implements WidgetsBindingObserver {
  
  // Cached screen size (captured before keyboard opens)
  Size? _cachedFullScreenSize;
  
  // Current keyboard visibility state
  bool _isKeyboardVisible = false;
  
  // Debounce timer for keyboard state changes
  Timer? _keyboardDebounceTimer;
  
  // ScrollController for forced repaint
  ScrollController? _keyboardScrollController;
  
  /// Get the cached full screen size (unaffected by keyboard)
  Size? get cachedFullScreenSize => _cachedFullScreenSize;
  
  /// Check if keyboard is currently visible
  bool get isKeyboardVisible => _isKeyboardVisible;
  
  /// Override this to respond to keyboard visibility changes
  void onKeyboardVisibilityChanged(bool isVisible) {
    // Default: trigger rebuild
    if (mounted) setState(() {});
  }
  
  /// Set the scroll controller that should be used for forced repaint
  /// Call this in initState with your scroll controller
  void setKeyboardScrollController(ScrollController controller) {
    _keyboardScrollController = controller;
  }
  
  /// Call this in initState
  void initKeyboardHandler() {
    if (WebUtils.isWebMobile) {
      WidgetsBinding.instance.addObserver(this);
    }
  }
  
  /// Call this in dispose
  void disposeKeyboardHandler() {
    if (WebUtils.isWebMobile) {
      WidgetsBinding.instance.removeObserver(this);
    }
    _keyboardDebounceTimer?.cancel();
  }
  
  /// Cache the full screen size on first build
  /// Call this at the start of your build method
  void cacheScreenSize(BuildContext context) {
    final view = View.of(context);
    final currentSize = WebUtils.getFullScreenSize(view);
    
    // Update cache if this is the first time or if we're seeing a larger size
    // (larger size = keyboard is closed)
    if (_cachedFullScreenSize == null || currentSize.height > _cachedFullScreenSize!.height) {
      _cachedFullScreenSize = currentSize;
    }
  }
  
  @override
  void didChangeMetrics() {
    // Only handle on mobile web
    if (!WebUtils.isWebMobile) return;
    
    // Debounce to prevent rapid state changes
    _keyboardDebounceTimer?.cancel();
    _keyboardDebounceTimer = Timer(const Duration(milliseconds: 100), () {
      if (!mounted) return;
      
      // Get keyboard state using View API (doesn't trigger rebuilds)
      final view = View.of(context);
      final keyboardHeight = WebUtils.getKeyboardHeight(view);
      final wasKeyboardVisible = _isKeyboardVisible;
      _isKeyboardVisible = keyboardHeight > 0;
      
      // Only trigger updates when visibility actually changes
      if (wasKeyboardVisible != _isKeyboardVisible) {
        debugPrint('🔥 Keyboard ${_isKeyboardVisible ? "OPENED" : "CLOSED"}');
        
        // Notify subclass
        onKeyboardVisibilityChanged(_isKeyboardVisible);
        
        // Force repaint when keyboard CLOSES to fix Flutter Web blank space bug
        if (!_isKeyboardVisible) {
          _forceRepaint();
        }
      }
    });
  }
  
  /// Force a repaint by simulating scroll (fixes Flutter Web blank space bug)
  void _forceRepaint() {
    if (_keyboardScrollController != null && _keyboardScrollController!.hasClients) {
      final currentOffset = _keyboardScrollController!.offset;
      _keyboardScrollController!.jumpTo(currentOffset + 1);
      Future.delayed(const Duration(milliseconds: 50), () {
        if (mounted && _keyboardScrollController!.hasClients) {
          _keyboardScrollController!.jumpTo(currentOffset);
        }
      });
    }
  }
  
  // WidgetsBindingObserver - other callbacks (required by interface)
  @override
  void didChangeAccessibilityFeatures() {}
  
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {}
  
  @override
  void didChangeLocales(List<Locale>? locales) {}
  
  @override
  void didChangePlatformBrightness() {}
  
  @override
  void didChangeTextScaleFactor() {}
  
  @override
  void didHaveMemoryPressure() {}
  
  @override
  Future<bool> didPopRoute() => Future.value(false);
  
  @override
  Future<bool> didPushRoute(String route) => Future.value(false);
  
  @override
  Future<bool> didPushRouteInformation(RouteInformation routeInformation) => Future.value(false);
  
  @override
  Future<AppExitResponse> didRequestAppExit() => Future.value(AppExitResponse.exit);
  
  @override
  void didChangeViewFocus(ViewFocusEvent event) {}
}
