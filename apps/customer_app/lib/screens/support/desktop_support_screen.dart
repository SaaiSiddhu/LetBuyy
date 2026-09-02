// Desktop Support Screen
import 'package:flutter/material.dart';
import 'web_support_screen.dart';

class DesktopSupportScreen extends StatelessWidget {
  final String? conversationId;
  const DesktopSupportScreen({super.key, this.conversationId});
  @override
  Widget build(BuildContext context) => WebSupportScreen(conversationId: conversationId);
}

