// Desktop Checkout Screen - macOS/Windows
import 'package:flutter/material.dart';
import 'web_checkout_screen.dart';

/// Desktop Checkout Screen - Shares layout with web
class DesktopCheckoutScreen extends StatelessWidget {
  const DesktopCheckoutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const WebCheckoutScreen();
  }
}
