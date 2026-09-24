// Web Support Screen
import 'package:flutter/material.dart';
import 'support_chat_screen.dart';

class WebSupportScreen extends StatelessWidget {
  final String? conversationId;
  const WebSupportScreen({super.key, this.conversationId});
  @override
  Widget build(BuildContext context) => SupportChatScreen(conversationId: conversationId);
}

