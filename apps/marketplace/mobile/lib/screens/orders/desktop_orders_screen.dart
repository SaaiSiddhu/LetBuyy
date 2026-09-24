// Desktop Orders Screen - macOS/Windows
import 'package:flutter/material.dart';
import 'web_orders_screen.dart';

/// Desktop Orders Screen - Shares layout with web
class DesktopOrdersScreen extends StatelessWidget {
  const DesktopOrdersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const WebOrdersScreen();
  }
}
