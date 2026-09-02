// Desktop Notification Screen - macOS/Windows
import 'package:flutter/material.dart';
import 'web_notification_screen.dart';

/// Desktop Notification Screen - Shares layout with web
class DesktopNotificationScreen extends StatelessWidget {
  const DesktopNotificationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const WebNotificationScreen();
  }
}
