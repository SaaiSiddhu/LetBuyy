// apps/marketplace/lib/screens/support/support_conversations_screen.dart
// 📬 SUPPORT CONVERSATIONS SCREEN

import 'package:flutter/material.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

// Phase 1R (Firebase removal, final pass): this screen's own build() was already an honest
// "Support chat isn't available yet" stub -- a prior pass had already neutered the FirebaseAuth-
// gated code path that would have reached SupportChatService (entirely FirebaseFirestore-backed,
// no canonical successor; not among services/api-gateway's owned domains). What remained was
// ~350 lines of now-unreachable code built to consume it: the SupportChatService field, a live
// conversation-list StreamBuilder, new-chat-request handling, a ticket-type picker sheet and a
// conversation-card widget -- all dead, all still importing Firebase transitively through
// SupportConversation/SupportChatService. Deleted; only the real, reachable stub remains.
class SupportConversationsScreen extends StatefulWidget {
  final bool showNewChatButton;
  final SupportTicketType? newChatType;
  final String? newChatSubject;
  final String? newChatMessage;
  final Map<String, dynamic>? newChatMetadata;

  const SupportConversationsScreen({
    super.key,
    this.showNewChatButton = true,
    this.newChatType,
    this.newChatSubject,
    this.newChatMessage,
    this.newChatMetadata,
  });

  @override
  State<SupportConversationsScreen> createState() => _SupportConversationsScreenState();
}

class _SupportConversationsScreenState extends State<SupportConversationsScreen> {
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0A0E14) : const Color(0xFFF5F7FA),
      appBar: AppBar(title: const Text('Support')),
      body: const Center(child: Text('Support chat isn\'t available in this build yet')),
    );
  }
}
