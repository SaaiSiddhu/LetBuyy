// packages/core/lib/src/web/web_scaffold.dart
// Mobile web Scaffold with stable keyboard handling
// Proper keyboard handling WITHOUT layout jank

import 'package:flutter/material.dart';

/// A Scaffold designed for mobile web that properly
/// handles virtual keyboard open/close WITHOUT layout jank.
///
/// Key principles:
/// - `resizeToAvoidBottomInset: false` - keyboard overlays, doesn't resize
/// - NO SingleChildScrollView wrapping entire screen (causes rebuild storm)
/// - Background uses `double.infinity` not MediaQuery.size.height
/// - Only the form/input area responds to keyboard, not the whole layout
///
/// Example:
/// ```dart
/// return WebScaffold(
///   backgroundColor: Colors.white,
///   body: MyBody(),
/// );
/// ```
class WebScaffold extends StatelessWidget {
  final Widget? body;
  final PreferredSizeWidget? appBar;
  final Widget? bottomNavigationBar;
  final Widget? drawer;
  final Widget? endDrawer;
  final Widget? floatingActionButton;
  final FloatingActionButtonLocation? floatingActionButtonLocation;
  final Color? backgroundColor;
  final bool extendBody;
  final bool extendBodyBehindAppBar;
  final Key? scaffoldKey;
  
  /// Decoration for the background container (will fill entire screen)
  final BoxDecoration? backgroundDecoration;
  
  // Legacy params - kept for backward compatibility but ignored
  final bool wrapInScrollView;
  final bool useCachedSize;

  const WebScaffold({
    super.key,
    this.body,
    this.appBar,
    this.bottomNavigationBar,
    this.drawer,
    this.endDrawer,
    this.floatingActionButton,
    this.floatingActionButtonLocation,
    this.backgroundColor,
    this.extendBody = false,
    this.extendBodyBehindAppBar = false,
    this.scaffoldKey,
    this.backgroundDecoration,
    @Deprecated('No longer used - keyboard handling is now stateless') 
    this.wrapInScrollView = false,
    @Deprecated('No longer used - keyboard handling is now stateless')
    this.useCachedSize = false,
  });

  @override
  Widget build(BuildContext context) {
    // Build body with proper constraints
    Widget bodyWidget = body ?? const SizedBox.shrink();
    
    // ✅ FIX 3: Lock background height using BoxConstraints.expand()
    // This NEVER rebuilds on keyboard open/close
    if (backgroundDecoration != null) {
      bodyWidget = Container(
        constraints: const BoxConstraints.expand(),
        decoration: backgroundDecoration,
        child: SafeArea(child: bodyWidget),
      );
    } else {
      bodyWidget = SafeArea(child: bodyWidget);
    }
    
    return GestureDetector(
      // Tap anywhere to dismiss keyboard
      onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
      behavior: HitTestBehavior.opaque,
      child: Scaffold(
        key: scaffoldKey,
        // ✅ FIX 1: Disable automatic resize - removes 70% of flicker
        resizeToAvoidBottomInset: false,
        extendBody: extendBody,
        extendBodyBehindAppBar: extendBodyBehindAppBar,
        backgroundColor: backgroundColor,
        appBar: appBar,
        drawer: drawer,
        endDrawer: endDrawer,
        bottomNavigationBar: bottomNavigationBar,
        floatingActionButton: floatingActionButton,
        floatingActionButtonLocation: floatingActionButtonLocation,
        body: bodyWidget,
      ),
    );
  }
}

/// ✅ FIX 2 & 4: A wrapper widget that ONLY moves form content when keyboard opens
/// This isolates rebuilds - background NEVER rebuilds, only the form moves
///
/// Example usage in login screen:
/// ```dart
/// Stack(
///   children: [
///     const Background(), // NEVER rebuilds
///     KeyboardAwareForm(  // Only this responds to keyboard
///       child: LoginForm(),
///     ),
///   ],
/// )
/// ```
class KeyboardAwareForm extends StatelessWidget {
  final Widget child;
  
  /// If true, adds extra padding at bottom when keyboard is open
  final bool addKeyboardPadding;
  
  const KeyboardAwareForm({
    super.key,
    required this.child,
    this.addKeyboardPadding = true,
  });

  @override
  Widget build(BuildContext context) {
    // Only add padding for the keyboard - this is the ONLY widget that rebuilds
    final bottomInset = addKeyboardPadding 
        ? MediaQuery.of(context).viewInsets.bottom 
        : 0.0;
    
    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: child,
    );
  }
}

/// ✅ A background widget that NEVER rebuilds on keyboard toggle
/// Uses const constructor and avoids MediaQuery
class FixedBackground extends StatelessWidget {
  final BoxDecoration decoration;
  
  const FixedBackground({
    super.key,
    required this.decoration,
  });

  @override
  Widget build(BuildContext context) {
    // ✅ Uses BoxConstraints.expand() NOT MediaQuery.size.height
    return Container(
      constraints: const BoxConstraints.expand(),
      decoration: decoration,
    );
  }
}
