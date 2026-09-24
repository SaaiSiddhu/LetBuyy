// Desktop Home Screen - Optimized for macOS/Windows native apps
// Shares layout with web but with desktop-specific optimizations

import 'package:flutter/material.dart';
import 'web_home_screen.dart';

/// Desktop Home Screen for native macOS/Windows/Linux apps
/// 
/// Currently uses the same layout as [WebHomeScreen] since user confirmed
/// desktop should share layout with web/tablet views.
/// 
/// This file exists for future desktop-specific optimizations like:
/// - Native window controls integration
/// - Keyboard shortcuts
/// - Desktop-specific gestures
/// - Multi-window support
class DesktopHomeScreen extends StatelessWidget {
  const DesktopHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // For now, reuse WebHomeScreen as per user specification
    // Desktop shares layout with web/tablet
    return const WebHomeScreen();
  }
}
