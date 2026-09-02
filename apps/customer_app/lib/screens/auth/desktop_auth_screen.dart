// Desktop Auth Screen - macOS/Windows
import 'package:flutter/material.dart';
import 'web_auth_screen.dart';

/// Desktop Auth Screen - Shares layout with web
class DesktopAuthScreen extends StatelessWidget {
  const DesktopAuthScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const WebAuthScreen();
  }
}
