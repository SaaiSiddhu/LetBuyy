// Desktop Profile Screen - macOS/Windows native app layout
import 'package:flutter/material.dart';
import 'web_profile_screen.dart';

/// Desktop Profile Screen - Shares layout with web as per user specification
class DesktopProfileScreen extends StatelessWidget {
  const DesktopProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const WebProfileScreen();
  }
}
