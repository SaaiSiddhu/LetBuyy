// Desktop Cart Screen - Optimized for macOS/Windows native apps
import 'package:flutter/material.dart';
import 'web_cart_screen.dart';

/// Desktop Cart Screen for native macOS/Windows/Linux apps
/// Shares layout with web as per user specification
class DesktopCartScreen extends StatelessWidget {
  const DesktopCartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const WebCartScreen();
  }
}
